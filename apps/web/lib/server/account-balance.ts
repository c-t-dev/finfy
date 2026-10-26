import { sql } from "drizzle-orm";
import { accounts, transactions } from "@packages/shared/db/schema";
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
