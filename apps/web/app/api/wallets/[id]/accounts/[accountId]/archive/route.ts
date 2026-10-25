import { accountStateInput } from "@packages/shared/accounts";
import { archiveAccount } from "@/lib/server/accounts";
import { walletWrite } from "@/lib/server/wallet-route";

/** Archives an account; its transactions are kept (OWNER, ADMIN, EDITOR). */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/accounts/[accountId]/archive">) {
  const { id, accountId } = await ctx.params;
  return walletWrite(request, accountStateInput, (actor, input) => archiveAccount(actor, id, accountId, input));
}
