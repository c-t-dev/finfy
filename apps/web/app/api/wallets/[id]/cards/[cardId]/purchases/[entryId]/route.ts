import { updatePurchaseInput } from "@packages/shared/cards";
import { getPurchase, updatePurchase } from "@/lib/server/cards";
import { requireActor, walletRead, walletWrite } from "@/lib/server/wallet-route";

export const dynamic = "force-dynamic";

/** All installments, including paid ones, for an accurate purchase edit form. */
export async function GET(_request: Request, ctx: RouteContext<"/api/wallets/[id]/cards/[cardId]/purchases/[entryId]">) {
  const actor = await requireActor();
  if (actor instanceof Response) return actor;
  const { id, cardId, entryId } = await ctx.params;
  return walletRead(await getPurchase(actor.userId, id, cardId, entryId));
}

/** Edits the whole purchase; amount/date require current versions and unpaid invoices. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/wallets/[id]/cards/[cardId]/purchases/[entryId]">) {
  const { id, cardId, entryId } = await ctx.params;
  return walletWrite(request, updatePurchaseInput, (actor, input) => updatePurchase(actor, id, cardId, entryId, input));
}
