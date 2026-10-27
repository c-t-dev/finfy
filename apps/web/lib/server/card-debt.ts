import { and, eq, isNotNull, isNull, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { creditCardInvoices, transactions } from "@packages/shared/db/schema";
import type { Tx } from "./write";

const origin = alias(transactions, "committed_purchase_origin");

/** A future installment is debt only once its original purchase has occurred. */
export function committedCardPurchase(asOf: string): SQL {
  return or(
    lte(transactions.transactionDate, asOf),
    and(isNotNull(transactions.installmentGroupId), sql`exists (
      select 1 from ${transactions} as ${sql.identifier("committed_purchase_origin")}
      where ${origin.id} = ${transactions.installmentGroupId}
        and ${origin.walletId} = ${transactions.walletId}
        and ${origin.creditCardId} = ${transactions.creditCardId}
        and ${origin.type} = 'CREDIT_CARD_PURCHASE' and ${origin.installmentNumber} = 1
        and ${origin.transactionDate} <= ${asOf}
        and ${origin.archivedAt} is null and ${origin.status} <> 'CANCELED'
    )`),
  )!;
}

/** Shared outstanding debt for card limit usage and net worth; no future forecasts. */
export function selectCommittedCardDebt(db: Pick<Tx, "select">, scope: SQL, asOf: string) {
  return db.select({ invoiceId: transactions.invoiceId, totalMinor: sql<string>`sum(${transactions.amountMinor})` })
    .from(transactions)
    .innerJoin(creditCardInvoices, and(eq(creditCardInvoices.id, transactions.invoiceId), eq(creditCardInvoices.walletId, transactions.walletId)))
    .where(and(scope, eq(transactions.type, "CREDIT_CARD_PURCHASE"),
      isNull(transactions.archivedAt), ne(transactions.status, "CANCELED"),
      eq(creditCardInvoices.status, "OPEN"), isNull(creditCardInvoices.archivedAt), committedCardPurchase(asOf)))
    .groupBy(transactions.invoiceId);
}
