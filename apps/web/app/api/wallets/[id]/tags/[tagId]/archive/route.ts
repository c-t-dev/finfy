import { tagStateInput } from "@packages/shared/tags";
import { setTagArchived } from "@/lib/server/tags";
import { walletWrite } from "@/lib/server/wallet-route";

/** Archives a tag; it disappears from entries and pickers (OWNER, ADMIN, EDITOR). */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/tags/[tagId]/archive">) {
  const { id, tagId } = await ctx.params;
  return walletWrite(request, tagStateInput, (actor, input) => setTagArchived(actor, id, tagId, true, input));
}
