import { createInviteInput } from "@packages/shared/members";
import { createInvite } from "@/lib/server/members";
import { walletWrite } from "@/lib/server/wallet-route";

/** Creates an invite and answers its private link token, shown only now (OWNER, ADMIN). */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/invites">) {
  const { id } = await ctx.params;
  return walletWrite(request, createInviteInput, (actor, input) => createInvite(actor, id, input), 201);
}
