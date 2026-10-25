import { inviteActionInput } from "@packages/shared/members";
import { renewInvite } from "@/lib/server/members";
import { walletWrite } from "@/lib/server/wallet-route";

/** Issues a new link for a pending invite; the old one stops working (OWNER, ADMIN). */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/invites/[inviteId]/renew">) {
  const { id, inviteId } = await ctx.params;
  return walletWrite(request, inviteActionInput, (actor, input) => renewInvite(actor, id, inviteId, input));
}
