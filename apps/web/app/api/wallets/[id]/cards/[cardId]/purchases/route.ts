import { createPurchaseInput } from "@packages/shared/cards";
import { createPurchase } from "@/lib/server/cards";
import { walletWrite } from "@/lib/server/wallet-route";

/** A purchase on the card, optionally in installments; answers every installment (OWNER, ADMIN, EDITOR). */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/cards/[cardId]/purchases">) {
  const { id, cardId } = await ctx.params;
  return walletWrite(request, createPurchaseInput, (actor, input) => createPurchase(actor, id, cardId, input), 201);
}
