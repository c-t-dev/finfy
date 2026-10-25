import { payInvoiceInput } from "@packages/shared/cards";
import { payInvoice, invoiceId } from "@/lib/server/cards";
import { apiError } from "@/lib/server/request";
import { walletWrite } from "@/lib/server/wallet-route";

/** Pays the whole invoice from an account (OWNER, ADMIN, EDITOR). */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/cards/[cardId]/invoices/[month]/pay">) {
  const { id, cardId, month } = await ctx.params;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return apiError("invalidInput", 400);
  const [year, monthNumber] = month.split("-").map(Number);
  const invoice = invoiceId(cardId, { referenceYear: year, referenceMonth: monthNumber });
  return walletWrite(request, payInvoiceInput, (actor, input) => payInvoice(actor, id, cardId, invoice, input));
}
