import { assetStateInput } from "@packages/shared/patrimony";
import { setAssetArchived } from "@/lib/server/patrimony";
import { walletWrite } from "@/lib/server/wallet-route";

/** Brings an archived asset or liability back (OWNER, ADMIN, EDITOR). */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/assets/[assetId]/restore">) {
  const { id, assetId } = await ctx.params;
  return walletWrite(request, assetStateInput, (actor, input) => setAssetArchived(actor, id, assetId, false, input));
}
