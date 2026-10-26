import { getTableName, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { accounts, creditCards, creditCardInvoices, transactions } from "@packages/shared/db/schema";
import { BALANCE_SIGN } from "@packages/shared/finance";

/** Keep nested SELECT columns qualified: Drizzle strips Column nodes in a single-table selection. */
function qualified(column: AnyPgColumn) {
  return sql`${sql.identifier(getTableName(column.table))}.${sql.identifier(column.name)}`;
}

/** Shared cash directions for current and dated account balances. */
export const signedAmount = sql.join([
  sql`case ${qualified(transactions.type)}`,
  ...Object.entries(BALANCE_SIGN).map(([type, sign]) => sql` when ${type} then ${qualified(transactions.amountMinor)} * ${sql.raw(String(sign))}`),
  sql` else 0 end`,
], sql``);

/** Current active accounts, opening balances plus paid movements through `to`. */
export function accumulatedBalance(walletId: string, to: string, accountId?: string) {
  return sql<string>`(select coalesce(sum(${qualified(accounts.initialBalanceMinor)} + coalesce((
    select sum(${signedAmount}) from ${transactions}
    where ${qualified(transactions.walletId)} = ${qualified(accounts.walletId)}
      and ${qualified(transactions.accountId)} = ${qualified(accounts.id)}
      and ${qualified(transactions.status)} = 'PAID' and ${qualified(transactions.archivedAt)} is null
      and ${qualified(transactions.transactionDate)} <= ${to}
  ), 0)), 0) from ${accounts}
    where ${qualified(accounts.walletId)} = ${walletId} and ${qualified(accounts.archivedAt)} is null
      ${accountId ? sql`and ${qualified(accounts.id)} = ${accountId}` : sql``})`;
}

/** Signed pending cash, including unpaid card purchases on their saved due date. */
export function accumulatedPendingBalance(walletId: string, to: string, accountId?: string) {
  return sql<string>`(select coalesce(sum(
    coalesce((select sum(${signedAmount}) from ${transactions}
      where ${qualified(transactions.walletId)} = ${qualified(accounts.walletId)} and ${qualified(transactions.accountId)} = ${qualified(accounts.id)}
        and ${qualified(transactions.status)} = 'PENDING' and ${qualified(transactions.archivedAt)} is null
        and ${qualified(transactions.transactionDate)} <= ${to}), 0)
    - coalesce((select sum(${qualified(transactions.amountMinor)}) from ${transactions}
      inner join ${creditCards} on ${qualified(creditCards.id)} = ${qualified(transactions.creditCardId)}
        and ${qualified(creditCards.walletId)} = ${qualified(transactions.walletId)}
      inner join ${creditCardInvoices} on ${qualified(creditCardInvoices.id)} = ${qualified(transactions.invoiceId)}
        and ${qualified(creditCardInvoices.walletId)} = ${qualified(transactions.walletId)}
      where ${qualified(transactions.walletId)} = ${qualified(accounts.walletId)}
        and ${qualified(creditCards.paymentAccountId)} = ${qualified(accounts.id)}
        and ${qualified(transactions.type)} = 'CREDIT_CARD_PURCHASE'
        and ${qualified(transactions.status)} = 'PENDING' and ${qualified(transactions.archivedAt)} is null
        and ${qualified(creditCardInvoices.status)} <> 'PAID' and ${qualified(creditCardInvoices.archivedAt)} is null
        and ${qualified(creditCardInvoices.dueDate)} <= ${to}), 0)
  ), 0) from ${accounts}
    where ${qualified(accounts.walletId)} = ${walletId} and ${qualified(accounts.archivedAt)} is null
      ${accountId ? sql`and ${qualified(accounts.id)} = ${accountId}` : sql``})`;
}
