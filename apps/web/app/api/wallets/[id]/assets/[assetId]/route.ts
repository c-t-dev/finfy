import { updateAssetInput } from "@packages/shared/patrimony";
import { updateAsset } from "@/lib/server/patrimony";
import { walletWrite } from "@/lib/server/wallet-route";

/** Edits an asset or liability; values are estimates, the last write wins (OWNER, ADMIN, EDITOR). */
export async function PATCH(request: Request, ctx: RouteContext<"/api/wallets/[id]/assets/[assetId]">) {
  const { id, assetId } = await ctx.params;
  return walletWrite(request, updateAssetInput, (actor, input) => updateAsset(actor, id, assetId, input));
}
