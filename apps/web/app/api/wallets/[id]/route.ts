import { updateWalletInput } from "@packages/shared/wallets";
import { walletWrite } from "@/lib/server/wallet-route";
import { updateWallet } from "@/lib/server/wallets";

/** Rename the wallet or change its currency (OWNER, ADMIN). */
export async function PATCH(request: Request, ctx: RouteContext<"/api/wallets/[id]">) {
  const { id } = await ctx.params;
  return walletWrite(request, updateWalletInput, (actor, input) => updateWallet(actor, id, input));
}
