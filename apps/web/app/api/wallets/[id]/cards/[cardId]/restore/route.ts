import { cardStateInput } from "@packages/shared/cards";
import { setCardArchived } from "@/lib/server/cards";
import { walletWrite } from "@/lib/server/wallet-route";

/** Brings an archived card back (OWNER, ADMIN, EDITOR). */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/cards/[cardId]/restore">) {
  const { id, cardId } = await ctx.params;
  return walletWrite(request, cardStateInput, (actor, input) => setCardArchived(actor, id, cardId, false, input));
}
