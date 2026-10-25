import { INVITE_TOKEN_PATTERN, memberActionInput } from "@packages/shared/members";
import { getSession } from "@/lib/server/auth/session";
import { respondToInvite } from "@/lib/server/members";
import { apiError } from "@/lib/server/request";
import { walletWrite } from "@/lib/server/wallet-route";

/** Declines an invite: needs the link and the invited account. */
export async function POST(request: Request, ctx: RouteContext<"/api/invites/[token]/decline">) {
  const { token } = await ctx.params;
  if (!INVITE_TOKEN_PATTERN.test(token)) return apiError("inviteInvalid", 410);
  return walletWrite(request, memberActionInput, async (actor, input) => {
    const session = await getSession();
    return respondToInvite(actor, session!.user.email, token, false, input);
  });
}
