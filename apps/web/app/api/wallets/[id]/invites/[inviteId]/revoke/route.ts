import { inviteActionInput } from "@packages/shared/members";
import { revokeInvite } from "@/lib/server/members";
import { walletWrite } from "@/lib/server/wallet-route";

/** Cancels a pending invite (OWNER, ADMIN). */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/invites/[inviteId]/revoke">) {
  const { id, inviteId } = await ctx.params;
  return walletWrite(request, inviteActionInput, (actor, input) => revokeInvite(actor, id, inviteId, input));
}
