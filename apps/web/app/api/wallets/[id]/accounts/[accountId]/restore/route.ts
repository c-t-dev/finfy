import { accountStateInput } from "@packages/shared/accounts";
import { restoreAccount } from "@/lib/server/accounts";
import { walletWrite } from "@/lib/server/wallet-route";

/** Brings an archived account back (OWNER, ADMIN, EDITOR). */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/accounts/[accountId]/restore">) {
  const { id, accountId } = await ctx.params;
  return walletWrite(request, accountStateInput, (actor, input) => restoreAccount(actor, id, accountId, input));
}
