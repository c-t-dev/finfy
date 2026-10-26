import { sql } from "drizzle-orm";
import { creditCardInvoices, transactions } from "@packages/shared/db/schema";

/** Use the linked invoice's saved due date without changing purchase dates or IDs. */
export const statementDate = sql<string>`case when ${transactions.type} = 'CREDIT_CARD_PURCHASE'
  then coalesce((select ${creditCardInvoices.dueDate} from ${creditCardInvoices}
    where ${creditCardInvoices.id} = ${transactions.invoiceId}
      and ${creditCardInvoices.walletId} = ${transactions.walletId}), ${transactions.transactionDate})
  else ${transactions.transactionDate} end`;
