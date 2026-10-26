import { changePasswordInput } from "@packages/shared/auth";
import { changePassword } from "@/lib/server/account";
import { getCurrentUser } from "@/lib/server/auth/session";
import { apiError, clientIp, isSameOrigin, userAgent } from "@/lib/server/request";

/** Changes the password with the current one; every other session ends. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError("forbiddenOrigin", 403);
  const user = await getCurrentUser();
  if (!user) return apiError("unauthenticated", 401);
  const parsed = changePasswordInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("invalidInput", 400);
  const result = await changePassword(user.id, user.email, parsed.data, { ip: clientIp(request), userAgent: userAgent(request) });
  if (result.ok) return new Response(null, { status: 204 });
  if (result.error === "rateLimited") {
    const retryAfter = result.retryAfterSeconds ?? 60;
    return apiError("rateLimited", 429, { retryAfterSeconds: retryAfter }, { "Retry-After": String(retryAfter) });
  }
  return apiError(result.error, result.error === "invalidCredentials" ? 401 : 400);
}
