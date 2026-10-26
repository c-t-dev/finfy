import "server-only";
import { and, asc, eq, gte, isNotNull, isNull, sql } from "drizzle-orm";
import { accounts, creditCards, recurrences, transactions } from "@packages/shared/db/schema";
import { invoiceForDate } from "@packages/shared/cards";
import { deterministicId } from "@packages/shared/ids";
import {
  addDays,
  nthDate,
  occurrenceDates,
  RECURRENCE_HORIZON_DAYS,
  type CreateRecurrenceInput,
  type Frequency,
  type Recurrence,
  type RecurrenceStateInput,
  type UpdateRecurrenceInput,
} from "@packages/shared/recurrences";
import { lockCurrency } from "@/lib/server/accounts";
import { ensureInvoice } from "@/lib/server/cards";
import { usableCategory } from "@/lib/server/categories";
import { CommandError, requireRole, runCommand, type CommandResult } from "@/lib/server/commands";
import { applyTags, tagsByEntry } from "@/lib/server/tags";
import { diff, findApplied, recordMutation, type Actor, type Change, type Tx } from "@/lib/server/write";

/**
 * Recurrences (wiki/finfy/data-model.md, decision 0005 "Recorrências sem
 * duplicar"). Each occurrence is a pending entry with a deterministic ID and
 * (`recurrence_id`, `occurrence_date`) unique, so generating twice, or on two
 * devices, never duplicates. Occurrences exist up to 90 days ahead.
 */

type RecurrenceRow = typeof recurrences.$inferSelect;
const now = sql`now()`;
const today = () => new Date().toISOString().slice(0, 10);
const horizon = () => addDays(today(), RECURRENCE_HORIZON_DAYS);
export const occurrenceId = (recurrenceId: string, date: string) => deterministicId("occurrence", recurrenceId, date);

function nextDate(row: RecurrenceRow): string | null {
  if (row.archivedAt) return null;
  const from = today();
  for (let n = 0; n < 2000; n++) {
    const date = nthDate(row.startDate, row.frequency as Frequency, n);
    if (row.endDate && date > row.endDate) return null;
    if (date >= from) return date;
  }
  return null;
}

const toRecurrence = (row: RecurrenceRow): Recurrence => ({
  id: row.id,
  type: row.type,
  description: row.description,
  amountMinor: row.amountMinor,
  accountId: row.accountId,
  creditCardId: row.creditCardId,
  categoryId: row.categoryId,
  frequency: row.frequency,
  startDate: row.startDate,
  endDate: row.endDate,
  nextDate: nextDate(row),
  archived: row.archivedAt !== null,
  version: row.version,
});

async function applied(tx: Tx, actor: Actor, mutationId: string): Promise<boolean> {
  const state = await findApplied(tx, mutationId, actor.userId);
  if (state === "foreign") throw new CommandError("invalidInput");
  return state === "applied";
}

/** Checks account or card, and the category's kind. */
async function checkSource(tx: Tx, walletId: string, input: { accountId?: string | null; creditCardId?: string | null; categoryId?: string; type: "INCOME" | "EXPENSE" }) {
  if (input.accountId) {
    const [row] = await tx
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.walletId, walletId), eq(accounts.id, input.accountId), isNull(accounts.archivedAt)))
      .limit(1);
    if (!row) throw new CommandError("invalidInput");
  }
  if (input.creditCardId) {
    if (input.type === "INCOME") throw new CommandError("invalidInput");
    const [row] = await tx
      .select({ id: creditCards.id })
      .from(creditCards)
      .where(and(eq(creditCards.walletId, walletId), eq(creditCards.id, input.creditCardId), isNull(creditCards.archivedAt)))
      .limit(1);
    if (!row) throw new CommandError("invalidInput");
  }
  if (input.categoryId) {
    const category = await usableCategory(tx, walletId, input.categoryId);
    if (category.kind !== input.type && category.kind !== "BOTH") throw new CommandError("invalidInput");
  }
}

/**
 * Creates the missing occurrences from `from` to the horizon. An existing
 * row for a date (live, paid or archived by a user) is left alone, so a
 * deleted occurrence does not come back. Card occurrences on a paid invoice
 * are skipped. Returns the audit changes.
 */
async function generate(tx: Tx, actor: Actor, row: RecurrenceRow, from: string, tagIds: string[] = [], firstPaid = false): Promise<Change[]> {
  if (row.archivedAt) return [];
  const dates = occurrenceDates(row.startDate, row.frequency as Frequency, horizon(), row.endDate).filter((date) => date >= from);
  if (!dates.length) return [];
  const existing = await tx
    .select({ date: transactions.occurrenceDate })
    .from(transactions)
    .where(and(eq(transactions.recurrenceId, row.id), gte(transactions.occurrenceDate, dates[0])));
  const taken = new Set(existing.map((item) => item.date));
  const card = row.creditCardId
    ? (await tx.select().from(creditCards).where(eq(creditCards.id, row.creditCardId)).limit(1))[0]
    : undefined;
  const changes: Change[] = [];
  for (const date of dates) {
    if (taken.has(date)) continue;
    const id = occurrenceId(row.id, date);
    let invoiceId: string | null = null;
    if (card) {
      try {
        invoiceId = (await ensureInvoice(tx, actor, card, invoiceForDate(date, card.closingDay, card.dueDay), changes)).id;
      } catch (error) {
        if (error instanceof CommandError && error.code === "invoicePaid") continue;
        throw error;
      }
    }
    const paid = firstPaid && date === row.startDate && !card;
    await tx.insert(transactions).values({
      id,
      walletId: row.walletId,
      accountId: row.accountId,
      creditCardId: row.creditCardId,
      invoiceId,
      categoryId: row.categoryId,
      recurrenceId: row.id,
      occurrenceDate: date,
      type: card ? "CREDIT_CARD_PURCHASE" : row.type,
      status: paid ? "PAID" : "PENDING",
      paidAt: paid ? now : null,
      description: row.description,
      amountMinor: row.amountMinor,
      transactionDate: date,
      createdBy: actor.userId,
      updatedBy: actor.userId,
    });
    changes.push({
      walletId: row.walletId,
      entity: "transactions",
      entityId: id,
      op: "CREATE",
      action: "CREATE",
      changes: diff({}, { recurrence_id: row.id, occurrence_date: date, amount_minor: row.amountMinor, description: row.description }),
    });
    if (tagIds.length) changes.push(...(await applyTags(tx, actor, row.walletId, [id], tagIds)));
  }
  return changes;
}

/**
 * After an edit: each pending occurrence from `from` on that is still on the
 * schedule takes the new values in place (its ID is fixed by the date); the
 * others are archived. Missing dates are generated afterwards.
 */
async function reshapeFuture(tx: Tx, actor: Actor, row: RecurrenceRow, from: string): Promise<Change[]> {
  const schedule = new Set(occurrenceDates(row.startDate, row.frequency as Frequency, horizon(), row.endDate));
  const pending = await tx
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.recurrenceId, row.id),
        eq(transactions.status, "PENDING"),
        isNull(transactions.archivedAt),
        gte(transactions.occurrenceDate, from),
      ),
    )
    .for("update");
  const card = row.creditCardId
    ? (await tx.select().from(creditCards).where(eq(creditCards.id, row.creditCardId)).limit(1))[0]
    : undefined;
  const changes: Change[] = [];
  const archive = async (id: string) => {
    await tx
      .update(transactions)
      .set({ archivedAt: now, archivedBy: actor.userId, version: sql`${transactions.version} + 1`, updatedAt: now, updatedBy: actor.userId })
      .where(eq(transactions.id, id));
    changes.push({ walletId: row.walletId, entity: "transactions", entityId: id, op: "ARCHIVE", action: "ARCHIVE", changes: diff({ archived: false }, { archived: true }) });
  };
  for (const occurrence of pending) {
    const date = occurrence.occurrenceDate!;
    if (!schedule.has(date)) {
      await archive(occurrence.id);
      continue;
    }
    let invoiceId: string | null = null;
    if (card) {
      try {
        invoiceId = (await ensureInvoice(tx, actor, card, invoiceForDate(date, card.closingDay, card.dueDay), changes)).id;
      } catch (error) {
        if (error instanceof CommandError && error.code === "invoicePaid") {
          await archive(occurrence.id);
          continue;
        }
        throw error;
      }
    }
    const next = {
      description: row.description,
      amountMinor: row.amountMinor,
      categoryId: row.categoryId,
      accountId: row.accountId,
      creditCardId: row.creditCardId,
      invoiceId,
      type: card ? ("CREDIT_CARD_PURCHASE" as const) : row.type,
    };
    const fieldChanges = diff(
      { description: occurrence.description, amount_minor: occurrence.amountMinor, category_id: occurrence.categoryId, account_id: occurrence.accountId, credit_card_id: occurrence.creditCardId },
      { description: next.description, amount_minor: next.amountMinor, category_id: next.categoryId, account_id: next.accountId, credit_card_id: next.creditCardId },
    );
    if (!Object.keys(fieldChanges).length) continue;
    await tx
      .update(transactions)
      .set({ ...next, version: sql`${transactions.version} + 1`, updatedAt: now, updatedBy: actor.userId })
      .where(eq(transactions.id, occurrence.id));
    changes.push({ walletId: row.walletId, entity: "transactions", entityId: occurrence.id, op: "UPDATE", action: "UPDATE", changes: fieldChanges });
  }
  return changes;
}

/** Archives this recurrence's pending occurrences from `from` on (paid ones stay). */
async function dropPending(tx: Tx, actor: Actor, row: RecurrenceRow, from: string): Promise<Change[]> {
  const dropped = await tx
    .update(transactions)
    .set({ archivedAt: now, archivedBy: actor.userId, version: sql`${transactions.version} + 1`, updatedAt: now, updatedBy: actor.userId })
    .where(
      and(
        eq(transactions.recurrenceId, row.id),
        eq(transactions.status, "PENDING"),
        isNull(transactions.archivedAt),
        gte(transactions.occurrenceDate, from),
      ),
    )
    .returning({ id: transactions.id });
  return dropped.map(({ id }) => ({
    walletId: row.walletId,
    entity: "transactions",
    entityId: id,
    op: "ARCHIVE" as const,
    action: "ARCHIVE",
    changes: diff({ archived: false }, { archived: true }),
  }));
}

export async function listRecurrences(userId: string, walletId: string, archived: boolean): Promise<CommandResult<Recurrence[]>> {
  return runCommand(async (tx) => {
    await requireRole(tx, walletId, userId, "view");
    const rows = await tx
      .select()
      .from(recurrences)
      .where(and(eq(recurrences.walletId, walletId), archived ? isNotNull(recurrences.archivedAt) : isNull(recurrences.archivedAt)))
      .orderBy(asc(recurrences.createdAt));
    return rows.map(toRecurrence);
  });
}

async function byId(tx: Tx, walletId: string, id: string): Promise<RecurrenceRow> {
  const [row] = await tx.select().from(recurrences).where(and(eq(recurrences.walletId, walletId), eq(recurrences.id, id))).limit(1);
  if (!row) throw new CommandError("notFound");
  return row;
}

export async function createRecurrence(actor: Actor, walletId: string, input: CreateRecurrenceInput): Promise<CommandResult<Recurrence>> {
  return runCommand(async (tx) => {
    if (await applied(tx, actor, input.mutationId)) {
      await requireRole(tx, walletId, actor.userId, "view");
      return toRecurrence(await byId(tx, walletId, input.id));
    }
    await requireRole(tx, walletId, actor.userId, "editEntries");
    const [taken] = await tx.select({ id: recurrences.id }).from(recurrences).where(eq(recurrences.id, input.id)).limit(1);
    if (taken) throw new CommandError("invalidInput");
    await checkSource(tx, walletId, input);

    const [row] = await tx
      .insert(recurrences)
      .values({
        id: input.id,
        walletId,
        type: input.type,
        description: input.description,
        amountMinor: input.amountMinor,
        accountId: input.accountId ?? null,
        creditCardId: input.creditCardId ?? null,
        categoryId: input.categoryId,
        frequency: input.frequency,
        dayOfMonth: Number(input.startDate.slice(8, 10)),
        startDate: input.startDate,
        endDate: input.endDate ?? null,
        createdBy: actor.userId,
        updatedBy: actor.userId,
      })
      .returning();

    const extra: Change[] = [];
    // An existing entry becomes the first occurrence, instead of a copy next to it (Minhas Economias bug 2).
    if (input.fromEntryId) {
      const linked = await tx
        .update(transactions)
        .set({ recurrenceId: row.id, occurrenceDate: input.startDate, version: sql`${transactions.version} + 1`, updatedAt: now, updatedBy: actor.userId })
        .where(
          and(
            eq(transactions.walletId, walletId),
            eq(transactions.id, input.fromEntryId),
            isNull(transactions.recurrenceId),
            isNull(transactions.archivedAt),
            eq(transactions.transactionDate, input.startDate),
          ),
        )
        .returning({ id: transactions.id });
      if (!linked.length) throw new CommandError("invalidInput");
      extra.push({
        walletId,
        entity: "transactions",
        entityId: input.fromEntryId,
        op: "UPDATE",
        action: "UPDATE",
        changes: diff({ recurrence_id: null }, { recurrence_id: row.id }),
      });
    }
    extra.push(...(await generate(tx, actor, row, input.startDate, input.tagIds ?? [], input.firstPaid ?? false)));
    extra.push(...(await lockCurrency(tx, actor, walletId)));
    await recordMutation(
      tx,
      actor,
      { mutationId: input.mutationId },
      {
        walletId,
        entity: "recurrences",
        entityId: row.id,
        op: "CREATE",
        action: "CREATE",
        changes: diff(
          {},
          { type: input.type, description: input.description, amount_minor: input.amountMinor, frequency: input.frequency, start_date: input.startDate, end_date: input.endDate ?? undefined },
        ),
      },
      extra,
    );
    return toRecurrence(row);
  });
}

/**
 * Applies from today on: the pending occurrences from today are archived and
 * generated again with the new values. Past and paid occurrences stay. The
 * amount, account and frequency need the latest version.
 */
export async function updateRecurrence(actor: Actor, walletId: string, id: string, input: UpdateRecurrenceInput): Promise<CommandResult<Recurrence>> {
  return runCommand(async (tx) => {
    if (await applied(tx, actor, input.mutationId)) {
      await requireRole(tx, walletId, actor.userId, "view");
      return toRecurrence(await byId(tx, walletId, id));
    }
    await requireRole(tx, walletId, actor.userId, "editEntries");
    const [row] = await tx
      .select()
      .from(recurrences)
      .where(and(eq(recurrences.walletId, walletId), eq(recurrences.id, id), isNull(recurrences.archivedAt)))
      .for("update")
      .limit(1);
    if (!row) throw new CommandError("notFound");

    const nextAccount = input.accountId !== undefined || input.creditCardId !== undefined ? (input.accountId ?? null) : row.accountId;
    const nextCard = input.accountId !== undefined || input.creditCardId !== undefined ? (input.creditCardId ?? null) : row.creditCardId;
    if (Boolean(nextAccount) === Boolean(nextCard)) throw new CommandError("invalidInput");
    const changes = diff(
      { description: row.description, amount_minor: row.amountMinor, account_id: row.accountId, credit_card_id: row.creditCardId, category_id: row.categoryId, frequency: row.frequency, end_date: row.endDate },
      {
        description: input.description,
        amount_minor: input.amountMinor,
        account_id: nextAccount !== row.accountId ? nextAccount : undefined,
        credit_card_id: nextCard !== row.creditCardId ? nextCard : undefined,
        category_id: input.categoryId,
        frequency: input.frequency,
        end_date: input.endDate,
      },
    );
    if (!Object.keys(changes).length) return toRecurrence(row);
    if (["amount_minor", "account_id", "credit_card_id", "frequency"].some((field) => changes[field]) && input.baseVersion !== row.version) {
      throw new CommandError("versionConflict");
    }
    await checkSource(tx, walletId, { accountId: nextAccount, creditCardId: nextCard, categoryId: input.categoryId, type: row.type });

    const [updated] = await tx
      .update(recurrences)
      .set({
        description: input.description ?? row.description,
        amountMinor: input.amountMinor ?? row.amountMinor,
        accountId: nextAccount,
        creditCardId: nextCard,
        categoryId: input.categoryId ?? row.categoryId,
        frequency: input.frequency ?? row.frequency,
        endDate: input.endDate === undefined ? row.endDate : input.endDate,
        version: sql`${recurrences.version} + 1`,
        updatedAt: now,
        updatedBy: actor.userId,
      })
      .where(eq(recurrences.id, id))
      .returning();
    const from = today();
    const extra = await reshapeFuture(tx, actor, updated, from);
    extra.push(...(await generate(tx, actor, updated, from)));
    await recordMutation(
      tx,
      actor,
      { mutationId: input.mutationId, baseVersion: input.baseVersion },
      { walletId, entity: "recurrences", entityId: id, op: "UPDATE", action: "UPDATE", changes },
      extra,
    );
    return toRecurrence(updated);
  });
}

/** Ends the recurrence: its pending occurrences from today are archived; past ones stay. */
export async function archiveRecurrence(actor: Actor, walletId: string, id: string, input: RecurrenceStateInput): Promise<CommandResult<Recurrence>> {
  return runCommand(async (tx) => {
    if (!(await applied(tx, actor, input.mutationId))) {
      await requireRole(tx, walletId, actor.userId, "deleteEntries");
      const [row] = await tx
        .select()
        .from(recurrences)
        .where(and(eq(recurrences.walletId, walletId), eq(recurrences.id, id), isNull(recurrences.archivedAt)))
        .for("update")
        .limit(1);
      if (!row) throw new CommandError("notFound");
      await tx
        .update(recurrences)
        .set({ archivedAt: now, archivedBy: actor.userId, version: sql`${recurrences.version} + 1`, updatedAt: now, updatedBy: actor.userId })
        .where(eq(recurrences.id, id));
      const extra = await dropPending(tx, actor, row, today());
      await recordMutation(
        tx,
        actor,
        { mutationId: input.mutationId, baseVersion: input.baseVersion },
        { walletId, entity: "recurrences", entityId: id, op: "ARCHIVE", action: "ARCHIVE", changes: diff({ archived: false }, { archived: true }) },
        extra,
      );
    } else {
      await requireRole(tx, walletId, actor.userId, "view");
    }
    return toRecurrence(await byId(tx, walletId, id));
  });
}

/**
 * Tops up every active recurrence of the wallet to the horizon (from today,
 * so a deleted past occurrence never comes back). Safe to call often: the
 * deterministic IDs make it a no-op when nothing is missing. Viewers can
 * call it too; the occurrences are written as the system.
 */
export async function refreshRecurrences(actor: Actor, walletId: string, mutationId: string): Promise<CommandResult<{ created: number }>> {
  return runCommand(async (tx) => {
    await requireRole(tx, walletId, actor.userId, "view");
    if (await applied(tx, actor, mutationId)) return { created: 0 };
    const rows = await tx.select().from(recurrences).where(and(eq(recurrences.walletId, walletId), isNull(recurrences.archivedAt)));
    const changes: Change[] = [];
    for (const row of rows) {
      const tagIds = await recurrenceTags(tx, row.id);
      changes.push(...(await generate(tx, actor, row, today(), tagIds)));
    }
    const created = changes.filter((change) => change.entity === "transactions").length;
    if (changes.length) {
      const [first, ...rest] = changes;
      await recordMutation(tx, actor, { mutationId }, first, rest);
    }
    return { created };
  });
}

/** Tags of the recurrence's latest occurrence, so new occurrences carry the same tags. */
async function recurrenceTags(tx: Tx, recurrenceId: string): Promise<string[]> {
  const [latest] = await tx
    .select({ id: transactions.id })
    .from(transactions)
    .where(eq(transactions.recurrenceId, recurrenceId))
    .orderBy(sql`${transactions.occurrenceDate} desc`)
    .limit(1);
  if (!latest) return [];
  return (await tagsByEntry(tx, [latest.id])).get(latest.id) ?? [];
}
