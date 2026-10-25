import { memberActionInput } from "@packages/shared/members";
import { leaveWallet } from "@/lib/server/members";
import { walletWrite } from "@/lib/server/wallet-route";

/** Leaves the wallet (anyone but the owner). */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/leave">) {
  const { id } = await ctx.params;
  return walletWrite(request, memberActionInput, (actor, input) => leaveWallet(actor, id, input));
}
