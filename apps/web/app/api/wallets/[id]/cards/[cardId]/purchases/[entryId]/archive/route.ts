import { purchaseStateInput } from "@packages/shared/cards";
import { archivePurchase } from "@/lib/server/cards";
import { walletWrite } from "@/lib/server/wallet-route";

/** Deletes a purchase with all its installments, unless one is on a paid invoice (OWNER, ADMIN, EDITOR). */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/cards/[cardId]/purchases/[entryId]/archive">) {
  const { id, cardId, entryId } = await ctx.params;
  return walletWrite(request, purchaseStateInput, (actor, input) => archivePurchase(actor, id, cardId, entryId, input));
}
