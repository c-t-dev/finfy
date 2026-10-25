import { INVITE_TOKEN_PATTERN } from "@packages/shared/members";
import { getSession } from "@/lib/server/auth/session";
import { previewInvite } from "@/lib/server/members";
import { apiError } from "@/lib/server/request";
import { requireActor, walletRead } from "@/lib/server/wallet-route";

export const dynamic = "force-dynamic";

/** What the invited person sees: wallet, inviter, role, and whether this account can accept. */
export async function GET(_request: Request, ctx: RouteContext<"/api/invites/[token]">) {
  const actor = await requireActor();
  if (actor instanceof Response) return actor;
  const { token } = await ctx.params;
  if (!INVITE_TOKEN_PATTERN.test(token)) return apiError("inviteInvalid", 410);
  const session = await getSession();
  return walletRead(await previewInvite(actor.userId, session!.user.email, token));
}
