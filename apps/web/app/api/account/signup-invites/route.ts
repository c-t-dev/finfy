import { createSignupInviteInput } from "@packages/shared/signup-invites";
import { getCurrentUser } from "@/lib/server/auth/session";
import { apiError, clientIp, isSameOrigin, userAgent } from "@/lib/server/request";
import { createSignupInvite, listSignupInvites } from "@/lib/server/signup-invites";

/** The account's sign-up invite codes (the codes themselves are never listed). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError("unauthenticated", 401);
  return Response.json(await listSignupInvites(user.id));
}

/** Makes a code; it comes back only in this answer. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError("forbiddenOrigin", 403);
  const user = await getCurrentUser();
  if (!user) return apiError("unauthenticated", 401);
  const parsed = createSignupInviteInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("invalidInput", 400);
  const result = await createSignupInvite(user.id, parsed.data.note, { ip: clientIp(request), userAgent: userAgent(request) });
  if (result.ok) return Response.json(result.value, { status: 201 });
  if (result.error === "rateLimited") {
    const retryAfter = result.retryAfterSeconds ?? 60;
    return apiError("rateLimited", 429, { retryAfterSeconds: retryAfter }, { "Retry-After": String(retryAfter) });
  }
  return apiError(result.error, 409);
}
