import "server-only";
import { selectStatementRows, selectStatementTotals, toEntrySummary } from "./entry-queries";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { accounts, creditCardInvoices, creditCards, transactionLinks, transactions } from "@packages/shared/db/schema";
import { deterministicId } from "@packages/shared/ids";
import type {
  CreateEntryInput,
  CreateTransferInput,
  Entry,
  EntryFilter,
  EntryList,
  EntryRows,
  EntrySummaryResponse,
  EntryStateInput,
  UpdateEntryInput,
} from "@packages/shared/transactions";
import { lockCurrency } from "@/lib/server/accounts";
import { usableCategory } from "@/lib/server/categories";
import { applyTags, tagsByEntry } from "@/lib/server/tags";
import { CommandError, requireRole, runCommand, type CommandResult } from "@/lib/server/commands";
import { diff, findApplied, recordMutation, type Actor, type Change, type FieldChanges, type Tx } from "@/lib/server/write";

/**
 * Entries: income, expenses and transfers (wiki/finfy/data-model.md). OWNER,
 * ADMIN and EDITOR write; everyone in the wallet reads. Description, notes and
 * category are free text (the last write wins); amount, date, account and
 * status move money, so they change only from the latest version.
 */

type Row = typeof transactions.$inferSelect;

/** Paid → `paid_at` now; pending → empty. */
const paidAt = (status: "PAID" | "PENDING") => (status === "PAID" ? sql`now()` : null);

async function toEntries(tx: Tx, rows: (Row & { statementDate?: string })[]): Promise<Entry[]> {
  const ids = rows.map((row) => row.id);
  const links = ids.length
    ? await tx
        .select()
        .from(transactionLinks)
        .where(
          and(
            isNull(transactionLinks.archivedAt),
            or(inArray(transactionLinks.sourceTransactionId, ids), inArray(transactionLinks.targetTransactionId, ids)),
          ),
        )
    : [];
  const linked = new Map<string, string>();
  for (const link of links) {
    linked.set(link.sourceTransactionId, link.targetTransactionId);
    linked.set(link.targetTransactionId, link.sourceTransactionId);
  }
  const otherIds = [...new Set(rows.map((row) => linked.get(row.id)).filter((id): id is string => Boolean(id)))];
  const others = otherIds.length
    ? await tx.select({ id: transactions.id, accountId: transactions.accountId }).from(transactions).where(inArray(transactions.id, otherIds))
    : [];
  const otherAccount = new Map(others.map((other) => [other.id, other.accountId]));
  const entryTags = await tagsByEntry(tx, ids);
  // Existing payments also get the corrected label, without rewriting their history.
  const paymentIds = rows.filter((row) => row.type === "CREDIT_CARD_PAYMENT").map((row) => row.id);
  const payments = paymentIds.length ? await tx
    .select({ id: creditCardInvoices.paymentTransactionId, dueDate: creditCardInvoices.dueDate, name: creditCards.name })
    .from(creditCardInvoices)
    .innerJoin(creditCards, eq(creditCards.id, creditCardInvoices.creditCardId))
    .where(inArray(creditCardInvoices.paymentTransactionId, paymentIds)) : [];
  const paymentLabels = new Map(payments.map((payment) => [payment.id,
    `${payment.name} ${payment.dueDate.slice(5, 7)}/${payment.dueDate.slice(0, 4)}`]));

  return rows.map((row) => {
    const linkedId = linked.get(row.id) ?? null;
    return {
      id: row.id,
      type: row.type,
      status: row.status,
      accountId: row.accountId,
      creditCardId: row.creditCardId,
      invoiceId: row.invoiceId,
      categoryId: row.categoryId,
      description: paymentLabels.get(row.id) ?? row.description,
      amountMinor: row.amountMinor,
      transactionDate: row.transactionDate,
      statementDate: row.statementDate ?? row.transactionDate,
      notes: row.notes,
      linkedTransactionId: linkedId,
      counterpartAccountId: linkedId ? (otherAccount.get(linkedId) ?? null) : null,
      installmentNumber: row.installmentNumber,
      installmentTotal: row.installmentTotal,
      tagIds: entryTags.get(row.id) ?? [],
      recurrenceId: row.recurrenceId,
      version: row.version,
    };
  });
}

async function entryById(tx: Tx, walletId: string, entryId: string): Promise<Entry> {
  const [row] = await tx
    .select()
    .from(transactions)
    .where(and(eq(transactions.walletId, walletId), eq(transactions.id, entryId)))
    .limit(1);
  if (!row) throw new CommandError("notFound");
  return (await toEntries(tx, [row]))[0];
}

export async function listEntries(userId: string, walletId: string, filter: EntryFilter): Promise<CommandResult<EntryList>> {
  return runCommand(async (tx) => {
    await requireRole(tx, walletId, userId, "view");
    const rows = await selectStatementRows(tx, walletId, filter);
    const [totals] = await selectStatementTotals(tx, walletId, filter);
    return {
      entries: await toEntries(tx, rows),
      summary: toEntrySummary(totals),
    };
  });
}

/** Independent reads let either part of the statement render as soon as it arrives. */
export async function listEntryRows(userId: string, walletId: string, filter: EntryFilter): Promise<CommandResult<EntryRows>> {
  return runCommand(async (tx) => {
    await requireRole(tx, walletId, userId, "view");
    return { entries: await toEntries(tx, await selectStatementRows(tx, walletId, filter)) };
  });
}

export async function getEntrySummary(userId: string, walletId: string, filter: EntryFilter): Promise<CommandResult<EntrySummaryResponse>> {
  return runCommand(async (tx) => {
    await requireRole(tx, walletId, userId, "view");
    const [totals] = await selectStatementTotals(tx, walletId, filter);
    return { summary: toEntrySummary(totals) };
  });
}

/** An active account of this wallet, or `invalidInput`. */
async function usableAccount(tx: Tx, walletId: string, accountId: string): Promise<void> {
  const [row] = await tx
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.walletId, walletId), eq(accounts.id, accountId), isNull(accounts.archivedAt)))
    .limit(1);
  if (!row) throw new CommandError("invalidInput");
}

/** The category exists for this wallet and fits the entry's direction. */
async function checkCategory(tx: Tx, walletId: string, categoryId: string, type: "INCOME" | "EXPENSE"): Promise<void> {
  const category = await usableCategory(tx, walletId, categoryId);
  if (category.kind !== type && category.kind !== "BOTH") throw new CommandError("invalidInput");
}

async function replay(tx: Tx, actor: Actor, mutationId: string, walletId: string, entryId: string): Promise<Entry | null> {
  const applied = await findApplied(tx, mutationId, actor.userId);
  if (applied === "foreign") throw new CommandError("invalidInput");
  if (applied === "new") return null;
  await requireRole(tx, walletId, actor.userId, "view");
  return entryById(tx, walletId, entryId);
}

async function ensureNewIds(tx: Tx, ids: string[]): Promise<void> {
  const taken = await tx.select({ id: transactions.id }).from(transactions).where(inArray(transactions.id, ids)).limit(1);
  if (taken.length) throw new CommandError("invalidInput");
}

export async function createEntry(actor: Actor, walletId: string, input: CreateEntryInput): Promise<CommandResult<Entry>> {
  return runCommand(async (tx) => {
    const replayed = await replay(tx, actor, input.mutationId, walletId, input.id);
    if (replayed) return replayed;
    await requireRole(tx, walletId, actor.userId, "editEntries");
    await ensureNewIds(tx, [input.id]);
    await usableAccount(tx, walletId, input.accountId);
    await checkCategory(tx, walletId, input.categoryId, input.type);

    await tx.insert(transactions).values({
      id: input.id,
      walletId,
      accountId: input.accountId,
      categoryId: input.categoryId,
      type: input.type,
      status: input.status,
      description: input.description,
      amountMinor: input.amountMinor,
      transactionDate: input.transactionDate,
      paidAt: paidAt(input.status),
      notes: input.notes ?? null,
      createdBy: actor.userId,
      updatedBy: actor.userId,
    });
    const extra = [
      ...(await applyTags(tx, actor, walletId, [input.id], input.tagIds ?? [])),
      ...(await lockCurrency(tx, actor, walletId)),
    ];
    await recordMutation(
      tx,
      actor,
      { mutationId: input.mutationId },
      {
        walletId,
        entity: "transactions",
        entityId: input.id,
        op: "CREATE",
        action: "CREATE",
        changes: diff(
          {},
          {
            type: input.type,
            account_id: input.accountId,
            category_id: input.categoryId,
            description: input.description,
            amount_minor: input.amountMinor,
            transaction_date: input.transactionDate,
            status: input.status,
            notes: input.notes ?? undefined,
          },
        ),
      },
      extra,
    );
    return entryById(tx, walletId, input.id);
  });
}

/** Two legs and their link, in one write (the audit groups them by the mutation). */
export async function createTransfer(actor: Actor, walletId: string, input: CreateTransferInput): Promise<CommandResult<Entry>> {
  return runCommand(async (tx) => {
    const replayed = await replay(tx, actor, input.mutationId, walletId, input.id);
    if (replayed) return replayed;
    await requireRole(tx, walletId, actor.userId, "editEntries");
    await ensureNewIds(tx, [input.id, input.inId]);
    await usableAccount(tx, walletId, input.fromAccountId);
    await usableAccount(tx, walletId, input.toAccountId);

    const common = {
      walletId,
      status: input.status,
      description: input.description,
      amountMinor: input.amountMinor,
      transactionDate: input.transactionDate,
      paidAt: paidAt(input.status),
      notes: input.notes ?? null,
      createdBy: actor.userId,
      updatedBy: actor.userId,
    };
    await tx.insert(transactions).values([
      { ...common, id: input.id, accountId: input.fromAccountId, type: "TRANSFER_OUT" },
      { ...common, id: input.inId, accountId: input.toAccountId, type: "TRANSFER_IN" },
    ]);
    const linkId = deterministicId("transaction_link", input.id, input.inId, "TRANSFER");
    await tx.insert(transactionLinks).values({
      id: linkId,
      walletId,
      sourceTransactionId: input.id,
      targetTransactionId: input.inId,
      type: "TRANSFER",
      createdBy: actor.userId,
      updatedBy: actor.userId,
    });

    const leg = (id: string, type: string, accountId: string): Change => ({
      walletId,
      entity: "transactions",
      entityId: id,
      op: "CREATE",
      action: "CREATE",
      changes: diff(
        {},
        {
          type,
          account_id: accountId,
          description: input.description,
          amount_minor: input.amountMinor,
          transaction_date: input.transactionDate,
          status: input.status,
        },
      ),
    });
    await recordMutation(
      tx,
      actor,
      { mutationId: input.mutationId },
      leg(input.id, "TRANSFER_OUT", input.fromAccountId),
      [
        leg(input.inId, "TRANSFER_IN", input.toAccountId),
        {
          walletId,
          entity: "transaction_links",
          entityId: linkId,
          op: "CREATE",
          action: "CREATE",
          changes: diff({}, { type: "TRANSFER", source_transaction_id: input.id, target_transaction_id: input.inId }),
        },
        ...(await lockCurrency(tx, actor, walletId)),
      ],
    );
    return entryById(tx, walletId, input.id);
  });
}

async function loadForWrite(tx: Tx, walletId: string, entryId: string): Promise<Row> {
  const [row] = await tx
    .select()
    .from(transactions)
    .where(and(eq(transactions.walletId, walletId), eq(transactions.id, entryId), isNull(transactions.archivedAt)))
    .for("update")
    .limit(1);
  if (!row) throw new CommandError("notFound");
  return row;
}

/** The other leg of a transfer, locked, if this row is one. */
async function otherLeg(tx: Tx, row: Row): Promise<{ other: Row; linkId: string } | null> {
  if (row.type !== "TRANSFER_IN" && row.type !== "TRANSFER_OUT") return null;
  const [link] = await tx
    .select()
    .from(transactionLinks)
    .where(
      and(
        eq(transactionLinks.type, "TRANSFER"),
        isNull(transactionLinks.archivedAt),
        or(eq(transactionLinks.sourceTransactionId, row.id), eq(transactionLinks.targetTransactionId, row.id)),
      ),
    )
    .limit(1);
  if (!link) return null;
  const otherId = link.sourceTransactionId === row.id ? link.targetTransactionId : link.sourceTransactionId;
  const [other] = await tx.select().from(transactions).where(eq(transactions.id, otherId)).for("update").limit(1);
  return other ? { other, linkId: link.id } : null;
}

const CRITICAL = ["amount_minor", "transaction_date", "account_id", "status"];

export async function updateEntry(
  actor: Actor,
  walletId: string,
  entryId: string,
  input: UpdateEntryInput,
): Promise<CommandResult<Entry>> {
  return runCommand(async (tx) => {
    const replayed = await replay(tx, actor, input.mutationId, walletId, entryId);
    if (replayed) return replayed;
    await requireRole(tx, walletId, actor.userId, "editEntries");
    const row = await loadForWrite(tx, walletId, entryId);
    // Card purchases and invoice payments are edited through the card screens.
    if (!["INCOME", "EXPENSE", "TRANSFER_IN", "TRANSFER_OUT"].includes(row.type)) throw new CommandError("forbidden");
    const transfer = await otherLeg(tx, row);

    const changes = diff(
      {
        account_id: row.accountId,
        category_id: row.categoryId,
        description: row.description,
        amount_minor: row.amountMinor,
        transaction_date: row.transactionDate,
        status: row.status,
        notes: row.notes,
      },
      {
        account_id: input.accountId,
        category_id: transfer ? undefined : input.categoryId,
        description: input.description,
        amount_minor: input.amountMinor,
        transaction_date: input.transactionDate,
        status: input.status,
        notes: input.notes,
      },
    );
    if (CRITICAL.some((field) => changes[field]) && input.baseVersion !== row.version) {
      throw new CommandError("versionConflict");
    }
    if (Object.keys(changes).length === 0) return entryById(tx, walletId, entryId);
    if (changes.account_id) {
      await usableAccount(tx, walletId, input.accountId!);
      if (transfer && transfer.other.accountId === input.accountId) throw new CommandError("invalidInput");
    }
    if (changes.category_id) await checkCategory(tx, walletId, input.categoryId!, row.type as "INCOME" | "EXPENSE");

    const shared = {
      description: input.description ?? row.description,
      amountMinor: input.amountMinor ?? row.amountMinor,
      transactionDate: input.transactionDate ?? row.transactionDate,
      status: input.status ?? row.status,
      notes: input.notes === undefined ? row.notes : input.notes,
      ...(changes.status ? { paidAt: paidAt((input.status ?? "PENDING") as "PAID" | "PENDING") } : {}),
      version: sql`${transactions.version} + 1`,
      updatedAt: sql`now()`,
      updatedBy: actor.userId,
    };
    await tx
      .update(transactions)
      .set({ ...shared, accountId: input.accountId ?? row.accountId, categoryId: input.categoryId ?? row.categoryId })
      .where(eq(transactions.id, entryId));

    const extra: Change[] = [];
    if (transfer) {
      const { account_id: _, category_id: __, ...sharedChanges } = changes;
      if (Object.keys(sharedChanges).length) {
        await tx.update(transactions).set(shared).where(eq(transactions.id, transfer.other.id));
        extra.push({
          walletId,
          entity: "transactions",
          entityId: transfer.other.id,
          op: "UPDATE",
          action: "UPDATE",
          changes: sharedChanges as FieldChanges,
        });
      }
    }
    if (changes.amount_minor || changes.status) extra.push(...(await lockCurrency(tx, actor, walletId)));

    await recordMutation(
      tx,
      actor,
      { mutationId: input.mutationId, baseVersion: input.baseVersion },
      { walletId, entity: "transactions", entityId: entryId, op: "UPDATE", action: "UPDATE", changes },
      extra,
    );
    return entryById(tx, walletId, entryId);
  });
}

/** Archiving is the app's "delete": the row stays for history and sync. Both legs of a transfer go together. */
export async function archiveEntry(
  actor: Actor,
  walletId: string,
  entryId: string,
  input: EntryStateInput,
): Promise<CommandResult<Entry>> {
  return runCommand(async (tx) => {
    const replayed = await replay(tx, actor, input.mutationId, walletId, entryId);
    if (replayed) return replayed;
    await requireRole(tx, walletId, actor.userId, "deleteEntries");
    const row = await loadForWrite(tx, walletId, entryId);
    if (!["INCOME", "EXPENSE", "TRANSFER_IN", "TRANSFER_OUT"].includes(row.type)) throw new CommandError("forbidden");
    const transfer = await otherLeg(tx, row);

    const archive = { archivedAt: sql`now()`, archivedBy: actor.userId, version: sql`${transactions.version} + 1`, updatedAt: sql`now()`, updatedBy: actor.userId };
    const ids = transfer ? [entryId, transfer.other.id] : [entryId];
    await tx.update(transactions).set(archive).where(inArray(transactions.id, ids));
    const archived = diff({ archived: false }, { archived: true });
    const extra: Change[] = [];
    if (transfer) {
      await tx
        .update(transactionLinks)
        .set({ archivedAt: sql`now()`, archivedBy: actor.userId, version: sql`${transactionLinks.version} + 1`, updatedAt: sql`now()`, updatedBy: actor.userId })
        .where(eq(transactionLinks.id, transfer.linkId));
      extra.push(
        { walletId, entity: "transactions", entityId: transfer.other.id, op: "ARCHIVE", action: "ARCHIVE", changes: archived },
        { walletId, entity: "transaction_links", entityId: transfer.linkId, op: "ARCHIVE", action: "ARCHIVE", changes: archived },
      );
    }
    await recordMutation(
      tx,
      actor,
      { mutationId: input.mutationId, baseVersion: input.baseVersion },
      { walletId, entity: "transactions", entityId: entryId, op: "ARCHIVE", action: "ARCHIVE", changes: archived },
      extra,
    );
    return entryById(tx, walletId, entryId);
  });
}
