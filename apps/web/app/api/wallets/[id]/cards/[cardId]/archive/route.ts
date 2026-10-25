import { cardStateInput } from "@packages/shared/cards";
import { setCardArchived } from "@/lib/server/cards";
import { walletWrite } from "@/lib/server/wallet-route";

/** Archives a card; its invoices and purchases are kept (OWNER, ADMIN, EDITOR). */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/cards/[cardId]/archive">) {
  const { id, cardId } = await ctx.params;
  return walletWrite(request, cardStateInput, (actor, input) => setCardArchived(actor, id, cardId, true, input));
}
