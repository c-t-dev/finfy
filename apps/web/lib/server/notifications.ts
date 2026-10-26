import "server-only";
import { statementDate } from "./entry-dates";
import { and, eq, gte, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import {
  budgetItems,
  categories,
  creditCardInvoices,
  creditCards,
  notifications,
  transactions,
  walletMembers,
  wallets,
} from "@packages/shared/db/schema";
import { deterministicId } from "@packages/shared/ids";
import { INVOICE_DUE_DAYS, type AppNotification, type NotificationList } from "@packages/shared/notifications";
import { addDays } from "@packages/shared/recurrences";
import { monthRange } from "@packages/shared/transactions";
import { getDb } from "@/lib/server/db";

/**
 * Computes the user's notifications across their wallets from the current
 * state (budgets, invoices, pending entries). Only "read" is stored: a
 * `notifications` row per user and key, ID `deterministicId("notification",
 * userId, key)`.
 */

const today = () => new Date().toISOString().slice(0, 10);
const notificationId = (userId: string, key: string) => deterministicId("notification", userId, key);

export async function listNotifications(userId: string): Promise<NotificationList> {
  const db = getDb();
  const memberships = await db
    .select({ walletId: wallets.id, walletName: wallets.name, currencyCode: wallets.currencyCode })
    .from(walletMembers)
    .innerJoin(wallets, eq(wallets.id, walletMembers.walletId))
    .where(and(eq(walletMembers.userId, userId), isNull(walletMembers.removedAt), isNull(wallets.archivedAt)));
  if (!memberships.length) return { notifications: [], unread: 0 };
  const walletIds = memberships.map((membership) => membership.walletId);
  const walletName = new Map(memberships.map((membership) => [membership.walletId, membership.walletName]));
  const currency = new Map(memberships.map((membership) => [membership.walletId, membership.currencyCode]));
  const day = today();
  const month = day.slice(0, 7);
  const { from, to } = monthRange(month);
  const found: Omit<AppNotification, "read">[] = [];

  // Budget limits of this month, near (alert %) or over.
  const items = await db
    .select({
      walletId: budgetItems.walletId,
      categoryId: budgetItems.categoryId,
      amountMinor: budgetItems.amountMinor,
      alertPercentage: budgetItems.alertPercentage,
      name: categories.name,
      translationKey: categories.translationKey,
    })
    .from(budgetItems)
    .innerJoin(categories, eq(categories.id, budgetItems.categoryId))
    .where(
      and(
        inArray(budgetItems.walletId, walletIds),
        eq(budgetItems.year, Number(month.slice(0, 4))),
        eq(budgetItems.month, Number(month.slice(5, 7))),
        isNull(budgetItems.archivedAt),
      ),
    );
  if (items.length) {
    const top = sql<string>`coalesce(${categories.parentId}, ${categories.id})`;
    const spent = await db
      .select({ walletId: transactions.walletId, categoryId: top, total: sql<string>`sum(${transactions.amountMinor})` })
      .from(transactions)
      .innerJoin(categories, eq(categories.id, transactions.categoryId))
      .where(
        and(
          inArray(transactions.walletId, walletIds),
          isNull(transactions.archivedAt),
          gte(statementDate, from),
          lte(statementDate, to),
          or(
            and(eq(transactions.type, "EXPENSE"), eq(transactions.status, "PAID")),
            and(eq(transactions.type, "CREDIT_CARD_PURCHASE"), ne(transactions.status, "CANCELED")),
          ),
        ),
      )
      .groupBy(transactions.walletId, top);
    const spentBy = new Map(spent.map((row) => [`${row.walletId}:${row.categoryId}`, Number(row.total)]));
    for (const item of items) {
      const total = spentBy.get(`${item.walletId}:${item.categoryId}`) ?? 0;
      const over = total > item.amountMinor;
      const near = !over && item.alertPercentage !== null && item.amountMinor > 0 && (total / item.amountMinor) * 100 >= item.alertPercentage;
      if (!over && !near) continue;
      found.push({
        key: `budget-${over ? "over" : "near"}:${item.walletId}:${item.categoryId}:${month}`,
        type: over ? "BUDGET_OVER" : "BUDGET_NEAR",
        walletId: item.walletId,
        walletName: walletName.get(item.walletId) ?? "",
        payload: { categoryName: item.name, categoryKey: item.translationKey, spentMinor: total, limitMinor: item.amountMinor, currencyCode: currency.get(item.walletId) ?? null },
        path: "/app/goals",
      });
    }
  }

  // Unpaid invoices due within the next days, or overdue.
  const invoices = await db
    .select({ invoice: creditCardInvoices, cardName: creditCards.name })
    .from(creditCardInvoices)
    .innerJoin(creditCards, eq(creditCards.id, creditCardInvoices.creditCardId))
    .where(
      and(
        inArray(creditCardInvoices.walletId, walletIds),
        eq(creditCardInvoices.status, "OPEN"),
        lte(creditCardInvoices.dueDate, addDays(day, INVOICE_DUE_DAYS)),
        isNull(creditCards.archivedAt),
      ),
    );
  if (invoices.length) {
    const totals = await db
      .select({ invoiceId: transactions.invoiceId, total: sql<string>`sum(${transactions.amountMinor})` })
      .from(transactions)
      .where(and(inArray(transactions.invoiceId, invoices.map((row) => row.invoice.id)), isNull(transactions.archivedAt), ne(transactions.status, "CANCELED")))
      .groupBy(transactions.invoiceId);
    const totalBy = new Map(totals.map((row) => [row.invoiceId, Number(row.total)]));
    for (const { invoice, cardName } of invoices) {
      const total = totalBy.get(invoice.id) ?? 0;
      if (total <= 0) continue;
      const overdue = invoice.dueDate < day;
      found.push({
        key: `invoice-${overdue ? "overdue" : "due"}:${invoice.id}`,
        type: overdue ? "INVOICE_OVERDUE" : "INVOICE_DUE",
        walletId: invoice.walletId,
        walletName: walletName.get(invoice.walletId) ?? "",
        payload: { cardName, totalMinor: total, dueDate: invoice.dueDate, currencyCode: currency.get(invoice.walletId) ?? null },
        path: `/app/accounts/cards/${invoice.creditCardId}`,
      });
    }
  }

  // Pending entries dated today or before, per wallet; the key changes with the day, so it comes back daily while they wait.
  const pending = await db
    .select({ walletId: transactions.walletId, count: sql<string>`count(*)` })
    .from(transactions)
    .where(
      and(
        inArray(transactions.walletId, walletIds),
        isNull(transactions.archivedAt),
        eq(transactions.status, "PENDING"),
        inArray(transactions.type, ["INCOME", "EXPENSE"]),
        lte(transactions.transactionDate, day),
      ),
    )
    .groupBy(transactions.walletId);
  for (const row of pending) {
    found.push({
      key: `pending:${row.walletId}:${day}`,
      type: "PENDING_DUE",
      walletId: row.walletId,
      walletName: walletName.get(row.walletId) ?? "",
      payload: { count: Number(row.count) },
      path: "/app/statement",
    });
  }

  const ids = found.map((item) => notificationId(userId, item.key));
  const read = ids.length
    ? new Set(
        (await db.select({ id: notifications.id }).from(notifications).where(and(inArray(notifications.id, ids), sql`${notifications.readAt} is not null`))).map(
          (row) => row.id,
        ),
      )
    : new Set<string>();
  const list = found.map((item) => ({ ...item, read: read.has(notificationId(userId, item.key)) }));
  return { notifications: list, unread: list.filter((item) => !item.read).length };
}

/** Marks notifications read for this user only. Keys that are not the user's current notifications are ignored. */
export async function markRead(userId: string, keys: string[]): Promise<void> {
  const current = new Map((await listNotifications(userId)).notifications.map((item) => [item.key, item]));
  const rows = keys
    .map((key) => current.get(key))
    .filter((item): item is AppNotification => Boolean(item))
    .map((item) => ({
      id: notificationId(userId, item.key),
      userId,
      walletId: item.walletId,
      type: item.type,
      payload: { key: item.key },
      readAt: new Date(),
    }));
  if (!rows.length) return;
  await getDb()
    .insert(notifications)
    .values(rows)
    .onConflictDoUpdate({ target: notifications.id, set: { readAt: sql`now()` } });
}
