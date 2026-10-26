import { updateTagInput } from "@packages/shared/tags";
import { updateTag } from "@/lib/server/tags";
import { walletWrite } from "@/lib/server/wallet-route";

/** Renames or recolors a tag (OWNER, ADMIN, EDITOR). */
export async function PATCH(request: Request, ctx: RouteContext<"/api/wallets/[id]/tags/[tagId]">) {
  const { id, tagId } = await ctx.params;
  return walletWrite(request, updateTagInput, (actor, input) => updateTag(actor, id, tagId, input));
}
