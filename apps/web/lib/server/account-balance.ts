import { sql } from "drizzle-orm";
import { accounts, creditCards, creditCardInvoices, transactions } from "@packages/shared/db/schema";
import { BALANCE_SIGN } from "@packages/shared/finance";

/** Shared cash directions for current and dated account balances. */
export const signedAmount = sql.join([
  sql`case ${transactions.type}`,
  ...Object.entries(BALANCE_SIGN).map(([type, sign]) => sql` when ${type} then ${transactions.amountMinor} * ${sql.raw(String(sign))}`),
  sql` else 0 end`,
], sql``);

/** Current active accounts, opening balances plus paid movements through `to`. */
export function accumulatedBalance(walletId: string, to: string, accountId?: string) {
  return sql<string>`(select coalesce(sum(${accounts.initialBalanceMinor} + coalesce((
    select sum(${signedAmount}) from ${transactions}
    where ${transactions.walletId} = ${accounts.walletId}
      and ${transactions.accountId} = ${accounts.id}
      and ${transactions.status} = 'PAID' and ${transactions.archivedAt} is null
      and ${transactions.transactionDate} <= ${to}
  ), 0)), 0) from ${accounts}
    where ${accounts.walletId} = ${walletId} and ${accounts.archivedAt} is null
      ${accountId ? sql`and ${accounts.id} = ${accountId}` : sql``})`;
}

/** Signed pending cash, including unpaid card purchases on their saved due date. */
export function accumulatedPendingBalance(walletId: string, to: string, accountId?: string) {
  return sql<string>`(select coalesce(sum(
    coalesce((select sum(${signedAmount}) from ${transactions}
      where ${transactions.walletId} = ${accounts.walletId} and ${transactions.accountId} = ${accounts.id}
        and ${transactions.status} = 'PENDING' and ${transactions.archivedAt} is null
        and ${transactions.transactionDate} <= ${to}), 0)
    - coalesce((select sum(${transactions.amountMinor}) from ${transactions}
      inner join ${creditCards} on ${creditCards.id} = ${transactions.creditCardId}
        and ${creditCards.walletId} = ${transactions.walletId}
      inner join ${creditCardInvoices} on ${creditCardInvoices.id} = ${transactions.invoiceId}
        and ${creditCardInvoices.walletId} = ${transactions.walletId}
      where ${transactions.walletId} = ${accounts.walletId}
        and ${creditCards.paymentAccountId} = ${accounts.id}
        and ${transactions.type} = 'CREDIT_CARD_PURCHASE'
        and ${transactions.status} = 'PENDING' and ${transactions.archivedAt} is null
        and ${creditCardInvoices.status} <> 'PAID' and ${creditCardInvoices.archivedAt} is null
        and ${creditCardInvoices.dueDate} <= ${to}), 0)
  ), 0) from ${accounts}
    where ${accounts.walletId} = ${walletId} and ${accounts.archivedAt} is null
      ${accountId ? sql`and ${accounts.id} = ${accountId}` : sql``})`;
}
