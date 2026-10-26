import { and, desc, eq, getTableColumns, gte, ilike, inArray, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { categories, transactionTags, transactions } from "@packages/shared/db/schema";
import type { EntryFilter } from "@packages/shared/transactions";
import { accumulatedBalance, accumulatedPendingBalance } from "./account-balance";
import { statementDate } from "./entry-dates";
import type { Tx } from "./write";

function filterWhere(walletId: string, filter: EntryFilter): SQL {
  const conditions: (SQL | undefined)[] = [
    eq(transactions.walletId, walletId),
    isNull(transactions.archivedAt),
    gte(statementDate, filter.from),
    lte(statementDate, filter.to),
  ];
  if (filter.accountId) conditions.push(eq(transactions.accountId, filter.accountId));
  if (filter.categoryId) {
    // A category also matches its subcategories.
    conditions.push(
      or(
        eq(transactions.categoryId, filter.categoryId),
        inArray(
          transactions.categoryId,
          sql`(select ${categories.id} from ${categories} where ${categories.parentId} = ${filter.categoryId})`,
        ),
      ),
    );
  }
  if (filter.tagId) {
    conditions.push(
      inArray(
        transactions.id,
        sql`(select ${transactionTags.transactionId} from ${transactionTags} where ${transactionTags.tagId} = ${filter.tagId} and ${transactionTags.archivedAt} is null)`,
      ),
    );
  }
  if (filter.q) conditions.push(ilike(transactions.description, `%${filter.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`));
  return and(...conditions)!;
}

/** Income and expense of the period. Card purchases count on their linked invoice due date; payments never count twice. */
const summaryColumns = {
  incomeMinor: sql<string>`coalesce(sum(${transactions.amountMinor}) filter (where ${transactions.type} = 'INCOME' and ${transactions.status} = 'PAID'), 0)`,
  expenseMinor: sql<string>`coalesce(sum(${transactions.amountMinor}) filter (where ${transactions.type} in ('EXPENSE', 'CREDIT_CARD_PURCHASE') and ${transactions.status} <> 'CANCELED' and (${transactions.status} = 'PAID' or ${transactions.type} = 'CREDIT_CARD_PURCHASE')), 0)`,
  pendingIncomeMinor: sql<string>`coalesce(sum(${transactions.amountMinor}) filter (where ${transactions.type} = 'INCOME' and ${transactions.status} = 'PENDING'), 0)`,
  pendingExpenseMinor: sql<string>`coalesce(sum(${transactions.amountMinor}) filter (where ${transactions.type} = 'EXPENSE' and ${transactions.status} = 'PENDING'), 0)`,
};

/** The same query builders are executed by the API and PostgreSQL regression tests. */
type Reader = Pick<Tx, "select">;

export function selectStatementRows(tx: Reader, walletId: string, filter: EntryFilter) {
  return tx.select({ ...getTableColumns(transactions), statementDate })
    .from(transactions)
    .where(filterWhere(walletId, filter))
    .orderBy(desc(statementDate), desc(transactions.createdAt))
    .limit(2000);
}

export function selectStatementTotals(tx: Reader, walletId: string, filter: EntryFilter) {
  return tx.select({ ...summaryColumns,
    confirmedBalanceMinor: accumulatedBalance(walletId, filter.to, filter.accountId),
    accumulatedPendingMinor: accumulatedPendingBalance(walletId, filter.to, filter.accountId),
  }).from(transactions).where(filterWhere(walletId, filter));
}