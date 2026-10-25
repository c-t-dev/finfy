import { reopenInvoiceInput } from "@packages/shared/cards";
import { reopenInvoice, invoiceId } from "@/lib/server/cards";
import { apiError } from "@/lib/server/request";
import { walletWrite } from "@/lib/server/wallet-route";

/** Undoes the invoice payment (OWNER, ADMIN, EDITOR). */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/cards/[cardId]/invoices/[month]/reopen">) {
  const { id, cardId, month } = await ctx.params;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return apiError("invalidInput", 400);
  const [year, monthNumber] = month.split("-").map(Number);
  const invoice = invoiceId(cardId, { referenceYear: year, referenceMonth: monthNumber });
  return walletWrite(request, reopenInvoiceInput, (actor, input) => reopenInvoice(actor, id, cardId, invoice, input));
}
