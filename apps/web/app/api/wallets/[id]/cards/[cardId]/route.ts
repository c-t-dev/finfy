import { updateCardInput } from "@packages/shared/cards";
import { updateCard } from "@/lib/server/cards";
import { walletWrite } from "@/lib/server/wallet-route";

/** Edits a card (OWNER, ADMIN, EDITOR); new closing and due days apply to invoices opened afterwards. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/wallets/[id]/cards/[cardId]">) {
  const { id, cardId } = await ctx.params;
  return walletWrite(request, updateCardInput, (actor, input) => updateCard(actor, id, cardId, input));
}
