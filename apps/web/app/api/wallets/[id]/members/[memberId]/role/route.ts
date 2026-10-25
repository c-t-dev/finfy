import { changeRoleInput } from "@packages/shared/members";
import { changeMemberRole } from "@/lib/server/members";
import { walletWrite } from "@/lib/server/wallet-route";

/** Changes a member's role, following the permission matrix (wiki/decisoes/0002). */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/members/[memberId]/role">) {
  const { id, memberId } = await ctx.params;
  return walletWrite(request, changeRoleInput, (actor, input) => changeMemberRole(actor, id, memberId, input));
}
