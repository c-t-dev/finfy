import "server-only";
import { selectCommittedCardDebt } from "./card-debt";
import { cardPaymentOverview } from "./card-overview";
import { and, asc, eq, inArray, isNotNull, isNull, ne, sql, type SQL } from "drizzle-orm";
import {
  addMonthsToDate,
  invoiceForDate,
  invoicePeriod,
  invoiceState,
  splitInstallments,
  type Card,
  type CardStateInput,
  type CreateCardInput,
  type CreatePurchaseInput,
  type Invoice,
  type InvoiceDetail,
  type InvoiceHeader,
  type InvoicePurchases,
  type InvoicePeriod,
  type PayInvoiceInput,
  type PurchaseStateInput,
  type ReopenInvoiceInput,
  type UpdateCardInput,
  type UpdatePurchaseInput,
} from "@packages/shared/cards";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { AccountColor } from "@packages/shared/accounts";
import { accounts, creditCardInvoices, creditCards, transactions } from "@packages/shared/db/schema";
import { deterministicId } from "@packages/shared/ids";
import type { Entry } from "@packages/shared/transactions";
import { lockCurrency } from "@/lib/server/accounts";
import { usableCategory } from "@/lib/server/categories";
import { applyTags, tagsByEntry } from "@/lib/server/tags";
import { CommandError, requireRole, runCommand, type CommandResult } from "@/lib/server/commands";
import { getDb } from "@/lib/server/db";
import { diff, findApplied, recordMutation, type Actor, type Change, type Tx } from "@/lib/server/write";

/**
 * Credit cards, purchases and invoices (wiki/finfy/data-model.md). Purchases
 * are CREDIT_CARD_PURCHASE rows on the invoice of their date; they never touch
 * an account balance. Paying an invoice creates one CREDIT_CARD_PAYMENT from
 * an account and marks the invoice and its purchases paid.
 */

type CardRow = typeof creditCards.$inferSelect;
type InvoiceRow = typeof creditCardInvoices.$inferSelect;
type Db = Tx | ReturnType<typeof getDb>;

const today = () => new Date().toISOString().slice(0, 10);
const now = sql`now()`;
const bump = (version: AnyPgColumn) => sql`${version} + 1`;

/** Purchases of each invoice that still count (not archived, not canceled). */
async function invoiceTotals(db: Db, invoiceIds: string[]): Promise<Map<string, number>> {
  if (!invoiceIds.length) return new Map();
  const rows = await db
    .select({ invoiceId: transactions.invoiceId, total: sql<string>`sum(${transactions.amountMinor})` })
    .from(transactions)
    .where(
      and(
        inArray(transactions.invoiceId, invoiceIds),
        isNull(transactions.archivedAt),
        ne(transactions.status, "CANCELED"),
        eq(transactions.type, "CREDIT_CARD_PURCHASE"),
      ),
    )
    .groupBy(transactions.invoiceId);
  return new Map(rows.map((row) => [row.invoiceId!, Number(row.total)]));
}

function toInvoice(row: InvoiceRow, totalMinor: number): Invoice {
  return {
    id: row.id,
    creditCardId: row.creditCardId,
    referenceYear: row.referenceYear,
    referenceMonth: row.referenceMonth,
    openingDate: row.openingDate,
    closingDate: row.closingDate,
    dueDate: row.dueDate,
    state: invoiceState(row.status, row.closingDate, row.dueDate, today()),
    totalMinor,
    paymentTransactionId: row.paymentTransactionId,
    version: row.version,
  };
}

/** An invoice that has no row yet: the period it would have, empty. */
function virtualInvoice(card: CardRow, period: InvoicePeriod): Invoice {
  return {
    id: invoiceId(card.id, period),
    creditCardId: card.id,
    ...period,
    state: invoiceState("OPEN", period.closingDate, period.dueDate, today()),
    totalMinor: 0,
    paymentTransactionId: null,
    version: 0,
  };
}

/** Two offline devices opening the same month's invoice get the same row. */
export const invoiceId = (cardId: string, period: { referenceYear: number; referenceMonth: number }) =>
  deterministicId("invoice", cardId, String(period.referenceYear), String(period.referenceMonth));

async function selectCards(db: Db, where: SQL | undefined): Promise<Card[]> {
  const rows = await db.select().from(creditCards).where(where).orderBy(asc(creditCards.createdAt));
  if (!rows.length) return [];
  const cardIds = rows.map((row) => row.id);
  const unpaid = await db
    .select()
    .from(creditCardInvoices)
    .where(and(inArray(creditCardInvoices.creditCardId, cardIds), eq(creditCardInvoices.status, "OPEN"), isNull(creditCardInvoices.archivedAt)));
  const currentIds = rows.map((row) => invoiceId(row.id, invoiceForDate(today(), row.closingDay, row.dueDay)));
  const current = await db.select().from(creditCardInvoices).where(inArray(creditCardInvoices.id, currentIds));
  const totals = await invoiceTotals(db, [...new Set([...unpaid, ...current].map((invoice) => invoice.id))]);
  const committedTotals = new Map((await selectCommittedCardDebt(db, inArray(transactions.creditCardId, cardIds), today()))
    .map(row => [row.invoiceId!, Number(row.totalMinor)]));

  return rows.map((row) => {
    const period = invoiceForDate(today(), row.closingDay, row.dueDay);
    const currentRow = current.find((invoice) => invoice.id === invoiceId(row.id, period));
    return {
      ...cardPaymentOverview(unpaid.filter(invoice => invoice.creditCardId === row.id)
        .map(invoice => toInvoice(invoice, totals.get(invoice.id) ?? 0)), committedTotals, today()),
      id: row.id,
      name: row.name,
      paymentAccountId: row.paymentAccountId,
      brand: row.brand,
      limitMinor: row.limitMinor,
      closingDay: row.closingDay,
      dueDay: row.dueDay,
      color: (row.color ?? "blue") as AccountColor,
      usedMinor: unpaid
        .filter((invoice) => invoice.creditCardId === row.id)
        .reduce((sum, invoice) => sum + (committedTotals.get(invoice.id) ?? 0), 0),
      currentInvoice: currentRow ? toInvoice(currentRow, totals.get(currentRow.id) ?? 0) : virtualInvoice(row, period),
      archived: row.archivedAt !== null,
      version: row.version,
    };
  });
}

export async function listCards(userId: string, walletId: string, archived: boolean): Promise<CommandResult<Card[]>> {
  return runCommand(async (tx) => {
    await requireRole(tx, walletId, userId, "view");
    return selectCards(
      tx,
      and(eq(creditCards.walletId, walletId), archived ? isNotNull(creditCards.archivedAt) : isNull(creditCards.archivedAt)),
    );
  });
}

async function cardById(tx: Tx, walletId: string, cardId: string): Promise<Card> {
  const [card] = await selectCards(tx, and(eq(creditCards.walletId, walletId), eq(creditCards.id, cardId)));
  if (!card) throw new CommandError("notFound");
  return card;
}

async function loadCard(tx: Tx, walletId: string, cardId: string, archived = false): Promise<CardRow> {
  const [row] = await tx
    .select()
    .from(creditCards)
    .where(
      and(
        eq(creditCards.walletId, walletId),
        eq(creditCards.id, cardId),
        archived ? isNotNull(creditCards.archivedAt) : isNull(creditCards.archivedAt),
      ),
    )
    .for("update")
    .limit(1);
  if (!row) throw new CommandError("notFound");
  return row;
}

async function usableAccount(tx: Tx, walletId: string, accountId: string): Promise<void> {
  const [row] = await tx
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.walletId, walletId), eq(accounts.id, accountId), isNull(accounts.archivedAt)))
    .limit(1);
  if (!row) throw new CommandError("invalidInput");
}

/** Applied mutation? Then answer with `current()` instead of writing again. */
async function applied(tx: Tx, actor: Actor, mutationId: string): Promise<boolean> {
  const state = await findApplied(tx, mutationId, actor.userId);
  if (state === "foreign") throw new CommandError("invalidInput");
  return state === "applied";
}

// ---------- Cards ----------

export async function createCard(actor: Actor, walletId: string, input: CreateCardInput): Promise<CommandResult<Card>> {
  return runCommand(async (tx) => {
    if (await applied(tx, actor, input.mutationId)) {
      await requireRole(tx, walletId, actor.userId, "view");
      return cardById(tx, walletId, input.id);
    }
    await requireRole(tx, walletId, actor.userId, "editEntries");
    const [taken] = await tx.select({ id: creditCards.id }).from(creditCards).where(eq(creditCards.id, input.id)).limit(1);
    if (taken) throw new CommandError("invalidInput");
    await usableAccount(tx, walletId, input.paymentAccountId);

    const { mutationId: _, ...values } = input;
    await tx.insert(creditCards).values({ ...values, walletId, createdBy: actor.userId, updatedBy: actor.userId });
    await recordMutation(
      tx,
      actor,
      { mutationId: input.mutationId },
      {
        walletId,
        entity: "credit_cards",
        entityId: input.id,
        op: "CREATE",
        action: "CREATE",
        changes: diff(
          {},
          {
            name: input.name,
            payment_account_id: input.paymentAccountId,
            brand: input.brand,
            limit_minor: input.limitMinor,
            closing_day: input.closingDay,
            due_day: input.dueDay,
            color: input.color,
          },
        ),
      },
    );
    return cardById(tx, walletId, input.id);
  });
}

/** Name, color and brand: the last write wins. Limit, days and paying account need the latest version. */
export async function updateCard(actor: Actor, walletId: string, cardId: string, input: UpdateCardInput): Promise<CommandResult<Card>> {
  return runCommand(async (tx) => {
    if (await applied(tx, actor, input.mutationId)) {
      await requireRole(tx, walletId, actor.userId, "view");
      return cardById(tx, walletId, cardId);
    }
    await requireRole(tx, walletId, actor.userId, "editEntries");
    const row = await loadCard(tx, walletId, cardId);
    const changes = diff(
      {
        name: row.name,
        payment_account_id: row.paymentAccountId,
        brand: row.brand,
        limit_minor: row.limitMinor,
        closing_day: row.closingDay,
        due_day: row.dueDay,
        color: row.color,
      },
      {
        name: input.name,
        payment_account_id: input.paymentAccountId,
        brand: input.brand,
        limit_minor: input.limitMinor,
        closing_day: input.closingDay,
        due_day: input.dueDay,
        color: input.color,
      },
    );
    const critical = ["payment_account_id", "limit_minor", "closing_day", "due_day"];
    if (critical.some((field) => changes[field]) && input.baseVersion !== row.version) throw new CommandError("versionConflict");
    if (Object.keys(changes).length === 0) return cardById(tx, walletId, cardId);
    if (changes.payment_account_id) await usableAccount(tx, walletId, input.paymentAccountId!);

    const { mutationId: _, baseVersion: __, ...values } = input;
    await tx
      .update(creditCards)
      .set({ ...values, version: bump(creditCards.version), updatedAt: now, updatedBy: actor.userId })
      .where(eq(creditCards.id, cardId));
    await recordMutation(
      tx,
      actor,
      { mutationId: input.mutationId, baseVersion: input.baseVersion },
      { walletId, entity: "credit_cards", entityId: cardId, op: "UPDATE", action: "UPDATE", changes },
    );
    return cardById(tx, walletId, cardId);
  });
}

export async function setCardArchived(
  actor: Actor,
  walletId: string,
  cardId: string,
  archived: boolean,
  input: CardStateInput,
): Promise<CommandResult<Card>> {
  return runCommand(async (tx) => {
    if (await applied(tx, actor, input.mutationId)) {
      await requireRole(tx, walletId, actor.userId, "view");
      return cardById(tx, walletId, cardId);
    }
    await requireRole(tx, walletId, actor.userId, archived ? "deleteEntries" : "editEntries");
    await loadCard(tx, walletId, cardId, !archived);
    await tx
      .update(creditCards)
      .set({
        archivedAt: archived ? now : null,
        archivedBy: archived ? actor.userId : null,
        version: bump(creditCards.version),
        updatedAt: now,
        updatedBy: actor.userId,
      })
      .where(eq(creditCards.id, cardId));
    await recordMutation(
      tx,
      actor,
      { mutationId: input.mutationId, baseVersion: input.baseVersion },
      {
        walletId,
        entity: "credit_cards",
        entityId: cardId,
        op: archived ? "ARCHIVE" : "RESTORE",
        action: archived ? "ARCHIVE" : "RESTORE",
        changes: diff({ archived: !archived }, { archived }),
      },
    );
    return cardById(tx, walletId, cardId);
  });
}

// ---------- Invoices ----------

/** The invoice row of a period, created if missing (audited). A paid invoice takes no new purchases. */
export async function ensureInvoice(tx: Tx, actor: Actor, card: CardRow, period: InvoicePeriod, extra: Change[]): Promise<InvoiceRow> {
  const id = invoiceId(card.id, period);
  const [existing] = await tx.select().from(creditCardInvoices).where(eq(creditCardInvoices.id, id)).for("update").limit(1);
  if (existing) {
    if (existing.status === "PAID") throw new CommandError("invoicePaid");
    return existing;
  }
  const [created] = await tx
    .insert(creditCardInvoices)
    .values({ id, walletId: card.walletId, creditCardId: card.id, ...period, createdBy: actor.userId, updatedBy: actor.userId })
    .returning();
  extra.push({
    walletId: card.walletId,
    entity: "credit_card_invoices",
    entityId: id,
    op: "CREATE",
    action: "CREATE",
    changes: diff({}, { reference: `${period.referenceYear}-${period.referenceMonth}`, closing_date: period.closingDate, due_date: period.dueDate }),
  });
  return created;
}

/** All invoices with purchases, newest first, plus the current one. */
export async function listInvoices(userId: string, walletId: string, cardId: string): Promise<CommandResult<Invoice[]>> {
  return runCommand(async (tx) => {
    await requireRole(tx, walletId, userId, "view");
    const [card] = await tx
      .select()
      .from(creditCards)
      .where(and(eq(creditCards.walletId, walletId), eq(creditCards.id, cardId)))
      .limit(1);
    if (!card) throw new CommandError("notFound");
    const rows = await tx.select().from(creditCardInvoices).where(eq(creditCardInvoices.creditCardId, cardId));
    const totals = await invoiceTotals(tx, rows.map((row) => row.id));
    const invoices = rows.map((row) => toInvoice(row, totals.get(row.id) ?? 0));
    const current = invoiceForDate(today(), card.closingDay, card.dueDay);
    if (!invoices.some((invoice) => invoice.id === invoiceId(card.id, current))) invoices.push(virtualInvoice(card, current));
    return invoices.sort((a, b) => b.referenceYear * 12 + b.referenceMonth - (a.referenceYear * 12 + a.referenceMonth));
  });
}

async function purchasesOf(tx: Tx, invoiceIdValue: string): Promise<Entry[]> {
  const rows = await tx
    .select()
    .from(transactions)
    .where(and(eq(transactions.invoiceId, invoiceIdValue), isNull(transactions.archivedAt)))
    .orderBy(asc(transactions.transactionDate), asc(transactions.createdAt));
  const entryTags = await tagsByEntry(tx, rows.map((row) => row.id));
  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    status: row.status,
    accountId: row.accountId,
    creditCardId: row.creditCardId,
    invoiceId: row.invoiceId,
    categoryId: row.categoryId,
    description: row.description,
    amountMinor: row.amountMinor,
    transactionDate: row.transactionDate,
    notes: row.notes,
    linkedTransactionId: null,
    counterpartAccountId: null,
    installmentNumber: row.installmentNumber,
    installmentTotal: row.installmentTotal,
    tagIds: entryTags.get(row.id) ?? [],
    recurrenceId: row.recurrenceId,
    version: row.version,
  }));
}

/** One month's invoice of a card (`YYYY-MM`), with its purchases; empty when it has none yet. */
export async function getInvoice(userId: string, walletId: string, cardId: string, month: string): Promise<CommandResult<InvoiceDetail>> {
  return runCommand(async (tx) => {
    await requireRole(tx, walletId, userId, "view");
    const [card] = await tx
      .select()
      .from(creditCards)
      .where(and(eq(creditCards.walletId, walletId), eq(creditCards.id, cardId)))
      .limit(1);
    if (!card) throw new CommandError("notFound");
    const [year, monthNumber] = month.split("-").map(Number);
    const id = invoiceId(cardId, { referenceYear: year, referenceMonth: monthNumber });
    const [row] = await tx.select().from(creditCardInvoices).where(eq(creditCardInvoices.id, id)).limit(1);
    if (!row) return { invoice: virtualInvoice(card, invoicePeriod(year, monthNumber, card.closingDay, card.dueDay)), purchases: [] };
    const totals = await invoiceTotals(tx, [id]);
    return { invoice: toInvoice(row, totals.get(id) ?? 0), purchases: await purchasesOf(tx, id) };
  });
}

async function invoiceReadContext(tx: Tx, userId: string, walletId: string, cardId: string, month: string) {
  await requireRole(tx, walletId, userId, "view");
  const [card] = await tx.select().from(creditCards)
    .where(and(eq(creditCards.walletId, walletId), eq(creditCards.id, cardId))).limit(1);
  if (!card) throw new CommandError("notFound");
  const [referenceYear, referenceMonth] = month.split("-").map(Number);
  const id = invoiceId(cardId, { referenceYear, referenceMonth });
  const [row] = await tx.select().from(creditCardInvoices)
    .where(and(eq(creditCardInvoices.walletId, walletId), eq(creditCardInvoices.id, id))).limit(1);
  return { card, row, id, referenceYear, referenceMonth };
}

export async function getInvoiceHeader(userId: string, walletId: string, cardId: string, month: string): Promise<CommandResult<InvoiceHeader>> {
  return runCommand(async tx => {
    const { card, row, id, referenceYear, referenceMonth } = await invoiceReadContext(tx, userId, walletId, cardId, month);
    return { invoice: row ? toInvoice(row, (await invoiceTotals(tx, [id])).get(id) ?? 0)
      : virtualInvoice(card, invoicePeriod(referenceYear, referenceMonth, card.closingDay, card.dueDay)) };
  });
}

export async function getInvoicePurchases(userId: string, walletId: string, cardId: string, month: string): Promise<CommandResult<InvoicePurchases>> {
  return runCommand(async tx => {
    const { row, id } = await invoiceReadContext(tx, userId, walletId, cardId, month);
    return { purchases: row ? await purchasesOf(tx, id) : [] };
  });
}

// ---------- Purchases ----------

/**
 * A purchase, split in installments when asked. Installment k (1-based) is
 * dated k−1 months after the purchase and lands on that date's invoice. The
 * first installment keeps the request `id`; the others get
 * `deterministicId("installment", id, k)`.
 */
export async function createPurchase(
  actor: Actor,
  walletId: string,
  cardId: string,
  input: CreatePurchaseInput,
): Promise<CommandResult<Entry[]>> {
  return runCommand(async (tx) => {
    const ids = Array.from({ length: input.installments }, (_, index) =>
      index === 0 ? input.id : deterministicId("installment", input.id, String(index + 1)),
    );
    if (await applied(tx, actor, input.mutationId)) {
      await requireRole(tx, walletId, actor.userId, "view");
      return purchasesByIds(tx, walletId, ids);
    }
    await requireRole(tx, walletId, actor.userId, "editEntries");
    const card = await loadCard(tx, walletId, cardId);
    const category = await usableCategory(tx, walletId, input.categoryId);
    if (category.kind === "INCOME") throw new CommandError("invalidInput");
    const taken = await tx.select({ id: transactions.id }).from(transactions).where(inArray(transactions.id, ids)).limit(1);
    if (taken.length) throw new CommandError("invalidInput");

    const amounts = splitInstallments(input.amountMinor, input.installments);
    const multiple = input.installments > 1;
    const extra: Change[] = [];
    const created: Change[] = [];
    for (const [index, id] of ids.entries()) {
      const date = addMonthsToDate(input.transactionDate, index);
      const invoice = await ensureInvoice(tx, actor, card, invoiceForDate(date, card.closingDay, card.dueDay), extra);
      await tx.insert(transactions).values({
        id,
        walletId,
        creditCardId: cardId,
        invoiceId: invoice.id,
        categoryId: input.categoryId,
        type: "CREDIT_CARD_PURCHASE",
        status: "PENDING",
        description: input.description,
        amountMinor: amounts[index],
        transactionDate: date,
        notes: input.notes ?? null,
        installmentGroupId: multiple ? input.id : null,
        installmentNumber: multiple ? index + 1 : null,
        installmentTotal: multiple ? input.installments : null,
        createdBy: actor.userId,
        updatedBy: actor.userId,
      });
      created.push({
        walletId,
        entity: "transactions",
        entityId: id,
        op: "CREATE",
        action: "CREATE",
        changes: diff(
          {},
          {
            type: "CREDIT_CARD_PURCHASE",
            credit_card_id: cardId,
            invoice_id: invoice.id,
            category_id: input.categoryId,
            description: input.description,
            amount_minor: amounts[index],
            transaction_date: date,
            installment: multiple ? `${index + 1}/${input.installments}` : undefined,
          },
        ),
      });
    }
    extra.push(...(await applyTags(tx, actor, walletId, ids, input.tagIds ?? [])));
    extra.push(...(await lockCurrency(tx, actor, walletId)));
    const [first, ...rest] = created;
    await recordMutation(tx, actor, { mutationId: input.mutationId }, first, [...rest, ...extra]);
    return purchasesByIds(tx, walletId, ids);
  });
}

async function purchasesByIds(tx: Tx, walletId: string, ids: string[]): Promise<Entry[]> {
  const rows = await tx
    .select({ invoiceId: transactions.invoiceId })
    .from(transactions)
    .where(and(eq(transactions.walletId, walletId), inArray(transactions.id, ids)));
  const invoiceIds = [...new Set(rows.map((row) => row.invoiceId).filter((id): id is string => Boolean(id)))];
  const all = (await Promise.all(invoiceIds.map((id) => purchasesOf(tx, id)))).flat();
  return ids.map((id) => all.find((entry) => entry.id === id)).filter((entry): entry is Entry => Boolean(entry));
}

/** Every active row of the purchase (all installments), locked. */
async function purchaseGroup(tx: Tx, walletId: string, cardId: string, entryId: string) {
  const [row] = await tx
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.walletId, walletId),
        eq(transactions.id, entryId),
        eq(transactions.creditCardId, cardId),
        eq(transactions.type, "CREDIT_CARD_PURCHASE"),
        isNull(transactions.archivedAt),
      ),
    )
    .limit(1);
  if (!row) throw new CommandError("notFound");
  const groupId = row.installmentGroupId;
  return tx
    .select()
    .from(transactions)
    .where(
      and(
        isNull(transactions.archivedAt),
        groupId ? eq(transactions.installmentGroupId, groupId) : eq(transactions.id, row.id),
      ),
    )
    .for("update");
}

/** Description, category and notes of every installment; the last write wins. */
export async function updatePurchase(
  actor: Actor,
  walletId: string,
  cardId: string,
  entryId: string,
  input: UpdatePurchaseInput,
): Promise<CommandResult<null>> {
  return runCommand(async (tx) => {
    if (await applied(tx, actor, input.mutationId)) return null;
    await requireRole(tx, walletId, actor.userId, "editEntries");
    const rows = await purchaseGroup(tx, walletId, cardId, entryId);
    if (input.categoryId) {
      const category = await usableCategory(tx, walletId, input.categoryId);
      if (category.kind === "INCOME") throw new CommandError("invalidInput");
    }
    const changes: Change[] = [];
    for (const row of rows) {
      const fieldChanges = diff(
        { description: row.description, category_id: row.categoryId, notes: row.notes },
        { description: input.description, category_id: input.categoryId, notes: input.notes },
      );
      if (!Object.keys(fieldChanges).length) continue;
      await tx
        .update(transactions)
        .set({
          description: input.description ?? row.description,
          categoryId: input.categoryId ?? row.categoryId,
          notes: input.notes === undefined ? row.notes : input.notes,
          version: bump(transactions.version),
          updatedAt: now,
          updatedBy: actor.userId,
        })
        .where(eq(transactions.id, row.id));
      changes.push({ walletId, entity: "transactions", entityId: row.id, op: "UPDATE", action: "UPDATE", changes: fieldChanges });
    }
    if (!changes.length) return null;
    const [first, ...rest] = changes;
    await recordMutation(tx, actor, { mutationId: input.mutationId }, first, rest);
    return null;
  });
}

/** Deletes (archives) the purchase with all its installments; none may be on a paid invoice. */
export async function archivePurchase(
  actor: Actor,
  walletId: string,
  cardId: string,
  entryId: string,
  input: PurchaseStateInput,
): Promise<CommandResult<null>> {
  return runCommand(async (tx) => {
    if (await applied(tx, actor, input.mutationId)) return null;
    await requireRole(tx, walletId, actor.userId, "deleteEntries");
    const rows = await purchaseGroup(tx, walletId, cardId, entryId);
    const invoiceIds = [...new Set(rows.map((row) => row.invoiceId).filter((id): id is string => Boolean(id)))];
    const paid = invoiceIds.length
      ? await tx
          .select({ id: creditCardInvoices.id })
          .from(creditCardInvoices)
          .where(and(inArray(creditCardInvoices.id, invoiceIds), eq(creditCardInvoices.status, "PAID")))
          .limit(1)
      : [];
    if (paid.length) throw new CommandError("invoicePaid");

    await tx
      .update(transactions)
      .set({ archivedAt: now, archivedBy: actor.userId, version: bump(transactions.version), updatedAt: now, updatedBy: actor.userId })
      .where(inArray(transactions.id, rows.map((row) => row.id)));
    const [first, ...rest] = rows.map<Change>((row) => ({
      walletId,
      entity: "transactions",
      entityId: row.id,
      op: "ARCHIVE",
      action: "ARCHIVE",
      changes: diff({ archived: false }, { archived: true }),
    }));
    await recordMutation(tx, actor, { mutationId: input.mutationId }, first, rest);
    return null;
  });
}

// ---------- Paying ----------

async function loadInvoice(tx: Tx, walletId: string, cardId: string, id: string): Promise<InvoiceRow> {
  const [row] = await tx
    .select()
    .from(creditCardInvoices)
    .where(and(eq(creditCardInvoices.walletId, walletId), eq(creditCardInvoices.creditCardId, cardId), eq(creditCardInvoices.id, id)))
    .for("update")
    .limit(1);
  if (!row) throw new CommandError("notFound");
  return row;
}

/** Pays the whole invoice from an account (partial payments are not supported yet). */
export async function payInvoice(
  actor: Actor,
  walletId: string,
  cardId: string,
  id: string,
  input: PayInvoiceInput,
): Promise<CommandResult<Invoice>> {
  return runCommand(async (tx) => {
    if (await applied(tx, actor, input.mutationId)) {
      await requireRole(tx, walletId, actor.userId, "view");
      const row = await loadInvoice(tx, walletId, cardId, id);
      return toInvoice(row, (await invoiceTotals(tx, [id])).get(id) ?? 0);
    }
    await requireRole(tx, walletId, actor.userId, "editEntries");
    const card = await loadCard(tx, walletId, cardId);
    const row = await loadInvoice(tx, walletId, cardId, id);
    if (row.status === "PAID") throw new CommandError("invoicePaid");
    const total = (await invoiceTotals(tx, [id])).get(id) ?? 0;
    if (total <= 0 || input.amountMinor !== total) throw new CommandError("invalidInput");
    await usableAccount(tx, walletId, input.accountId);
    const [taken] = await tx.select({ id: transactions.id }).from(transactions).where(eq(transactions.id, input.paymentId)).limit(1);
    if (taken) throw new CommandError("invalidInput");

    await tx.insert(transactions).values({
      id: input.paymentId,
      walletId,
      accountId: input.accountId,
      type: "CREDIT_CARD_PAYMENT",
      status: "PAID",
      description: `${card.name} ${row.dueDate.slice(5, 7)}/${row.dueDate.slice(0, 4)}`,
      amountMinor: total,
      transactionDate: input.paymentDate,
      paidAt: now,
      createdBy: actor.userId,
      updatedBy: actor.userId,
    });
    await tx
      .update(creditCardInvoices)
      .set({ status: "PAID", paidAt: now, paymentTransactionId: input.paymentId, version: bump(creditCardInvoices.version), updatedAt: now, updatedBy: actor.userId })
      .where(eq(creditCardInvoices.id, id));
    await tx
      .update(transactions)
      .set({ status: "PAID", paidAt: now, version: bump(transactions.version), updatedAt: now, updatedBy: actor.userId })
      .where(and(eq(transactions.invoiceId, id), isNull(transactions.archivedAt), eq(transactions.status, "PENDING")));

    await recordMutation(
      tx,
      actor,
      { mutationId: input.mutationId },
      {
        walletId,
        entity: "credit_card_invoices",
        entityId: id,
        op: "UPDATE",
        action: "INVOICE_PAID",
        changes: diff({ status: "OPEN", payment_transaction_id: null }, { status: "PAID", payment_transaction_id: input.paymentId }),
      },
      [
        {
          walletId,
          entity: "transactions",
          entityId: input.paymentId,
          op: "CREATE",
          action: "CREATE",
          changes: diff({}, { type: "CREDIT_CARD_PAYMENT", account_id: input.accountId, amount_minor: total, transaction_date: input.paymentDate }),
        },
      ],
    );
    const updated = await loadInvoice(tx, walletId, cardId, id);
    return toInvoice(updated, total);
  });
}

/** Undoes a payment: the payment entry is archived and the invoice and its purchases are open again. */
export async function reopenInvoice(
  actor: Actor,
  walletId: string,
  cardId: string,
  id: string,
  input: ReopenInvoiceInput,
): Promise<CommandResult<Invoice>> {
  return runCommand(async (tx) => {
    if (!(await applied(tx, actor, input.mutationId))) {
      await requireRole(tx, walletId, actor.userId, "deleteEntries");
      const row = await loadInvoice(tx, walletId, cardId, id);
      if (row.status !== "PAID") throw new CommandError("invalidInput");
      const extra: Change[] = [];
      if (row.paymentTransactionId) {
        await tx
          .update(transactions)
          .set({ archivedAt: now, archivedBy: actor.userId, version: bump(transactions.version), updatedAt: now, updatedBy: actor.userId })
          .where(eq(transactions.id, row.paymentTransactionId));
        extra.push({
          walletId,
          entity: "transactions",
          entityId: row.paymentTransactionId,
          op: "ARCHIVE",
          action: "ARCHIVE",
          changes: diff({ archived: false }, { archived: true }),
        });
      }
      await tx
        .update(creditCardInvoices)
        .set({ status: "OPEN", paidAt: null, paymentTransactionId: null, version: bump(creditCardInvoices.version), updatedAt: now, updatedBy: actor.userId })
        .where(eq(creditCardInvoices.id, id));
      await tx
        .update(transactions)
        .set({ status: "PENDING", paidAt: null, version: bump(transactions.version), updatedAt: now, updatedBy: actor.userId })
        .where(and(eq(transactions.invoiceId, id), isNull(transactions.archivedAt), eq(transactions.status, "PAID")));
      await recordMutation(
        tx,
        actor,
        { mutationId: input.mutationId },
        {
          walletId,
          entity: "credit_card_invoices",
          entityId: id,
          op: "UPDATE",
          action: "INVOICE_REOPENED",
          changes: diff({ status: "PAID" }, { status: "OPEN" }),
        },
        extra,
      );
    }
    const row = await loadInvoice(tx, walletId, cardId, id);
    return toInvoice(row, (await invoiceTotals(tx, [id])).get(id) ?? 0);
  });
}
