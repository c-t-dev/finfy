import { updatePurchaseInput } from "@packages/shared/cards";
import { updatePurchase } from "@/lib/server/cards";
import { walletWrite } from "@/lib/server/wallet-route";

/** Description, category and notes of a purchase and all its installments (OWNER, ADMIN, EDITOR). */
export async function PATCH(request: Request, ctx: RouteContext<"/api/wallets/[id]/cards/[cardId]/purchases/[entryId]">) {
  const { id, cardId, entryId } = await ctx.params;
  return walletWrite(request, updatePurchaseInput, (actor, input) => updatePurchase(actor, id, cardId, entryId, input));
}
