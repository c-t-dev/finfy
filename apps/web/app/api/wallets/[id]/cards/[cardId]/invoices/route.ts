import { listInvoices } from "@/lib/server/cards";
import { requireActor, walletRead } from "@/lib/server/wallet-route";

export const dynamic = "force-dynamic";

/** Every invoice of the card with its total and state, newest first, including the current one. */
export async function GET(_request: Request, ctx: RouteContext<"/api/wallets/[id]/cards/[cardId]/invoices">) {
  const actor = await requireActor();
  if (actor instanceof Response) return actor;
  const { id, cardId } = await ctx.params;
  return walletRead(await listInvoices(actor.userId, id, cardId), (invoices) => ({ invoices }));
}
