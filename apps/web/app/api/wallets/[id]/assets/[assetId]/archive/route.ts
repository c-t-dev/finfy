import { assetStateInput } from "@packages/shared/patrimony";
import { setAssetArchived } from "@/lib/server/patrimony";
import { walletWrite } from "@/lib/server/wallet-route";

/** Archives an asset or liability; it leaves the net worth (OWNER, ADMIN, EDITOR). */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/assets/[assetId]/archive">) {
  const { id, assetId } = await ctx.params;
  return walletWrite(request, assetStateInput, (actor, input) => setAssetArchived(actor, id, assetId, true, input));
}
