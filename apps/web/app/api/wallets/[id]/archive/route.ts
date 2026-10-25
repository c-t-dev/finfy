import { archiveWalletInput } from "@packages/shared/wallets";
import { walletWrite } from "@/lib/server/wallet-route";
import { archiveWallet } from "@/lib/server/wallets";

/** Archives the wallet (OWNER, with the password again). */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/archive">) {
  const { id } = await ctx.params;
  return walletWrite(request, archiveWalletInput, (actor, input, meta) => archiveWallet(actor, id, input, meta));
}
