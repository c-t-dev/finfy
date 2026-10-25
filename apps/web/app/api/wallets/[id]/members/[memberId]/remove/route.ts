import { memberActionInput } from "@packages/shared/members";
import { removeMember } from "@/lib/server/members";
import { walletWrite } from "@/lib/server/wallet-route";

/** Removes a member, following the permission matrix (wiki/decisoes/0002). */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/members/[memberId]/remove">) {
  const { id, memberId } = await ctx.params;
  return walletWrite(request, memberActionInput, (actor, input) => removeMember(actor, id, memberId, input));
}
