import { getInvoice } from "@/lib/server/cards";
import { apiError } from "@/lib/server/request";
import { requireActor, walletRead } from "@/lib/server/wallet-route";

export const dynamic = "force-dynamic";

/** The invoice of a reference month (`YYYY-MM`) with its purchases. */
export async function GET(_request: Request, ctx: RouteContext<"/api/wallets/[id]/cards/[cardId]/invoices/[month]">) {
  const actor = await requireActor();
  if (actor instanceof Response) return actor;
  const { id, cardId, month } = await ctx.params;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return apiError("invalidInput", 400);
  return walletRead(await getInvoice(actor.userId, id, cardId, month));
}
