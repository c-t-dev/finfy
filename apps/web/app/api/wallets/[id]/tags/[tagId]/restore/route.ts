import { tagStateInput } from "@packages/shared/tags";
import { setTagArchived } from "@/lib/server/tags";
import { walletWrite } from "@/lib/server/wallet-route";

/** Brings an archived tag back (OWNER, ADMIN, EDITOR). */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/tags/[tagId]/restore">) {
  const { id, tagId } = await ctx.params;
  return walletWrite(request, tagStateInput, (actor, input) => setTagArchived(actor, id, tagId, false, input));
}
