import { z } from "zod";
import { getCurrentUser } from "@/lib/server/auth/session";
import { apiError, clientIp, isSameOrigin, userAgent } from "@/lib/server/request";
import { revokeSignupInvite } from "@/lib/server/signup-invites";

/** Cancels an unused code made by this account. */
export async function POST(request: Request, { params }: RouteContext<"/api/account/signup-invites/[inviteId]/revoke">) {
  if (!isSameOrigin(request)) return apiError("forbiddenOrigin", 403);
  const user = await getCurrentUser();
  if (!user) return apiError("unauthenticated", 401);
  const inviteId = z.uuid().safeParse((await params).inviteId);
  if (!inviteId.success) return apiError("notFound", 404);
  const result = await revokeSignupInvite(user.id, inviteId.data, { ip: clientIp(request), userAgent: userAgent(request) });
  return result.ok ? new Response(null, { status: 204 }) : apiError("notFound", 404);
}
