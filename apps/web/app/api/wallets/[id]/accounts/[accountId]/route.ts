import { updateAccountInput } from "@packages/shared/accounts";
import { updateAccount } from "@/lib/server/accounts";
import { walletWrite } from "@/lib/server/wallet-route";

/** Edits an account (OWNER, ADMIN, EDITOR). */
export async function PATCH(request: Request, ctx: RouteContext<"/api/wallets/[id]/accounts/[accountId]">) {
  const { id, accountId } = await ctx.params;
  return walletWrite(request, updateAccountInput, (actor, input) => updateAccount(actor, id, accountId, input));
}
