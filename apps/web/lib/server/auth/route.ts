import "server-only";
import type { z } from "zod";
import { env } from "@packages/env/server";
import { apiError, clientIp, isSameOrigin, userAgent } from "@/lib/server/request";
import type { AuthResult, RequestMeta } from "./service";

/**
 * Shared shape of the auth routes: same-origin check, JSON parsed with the
 * shared zod schema, and errors as stable codes (wiki/decisoes/0011).
 */
export async function handleAuth<T extends z.ZodType>(
  request: Request,
  schema: T,
  action: (input: z.infer<T>, meta: RequestMeta) => Promise<AuthResult>,
): Promise<Response> {
  if (!isSameOrigin(request)) return apiError("forbiddenOrigin", 403);
  if (!env.DATABASE_URL || !env.PASSWORD_PEPPER_V1) return apiError("unavailable", 503);

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("invalidInput", 400);

  const result = await action(parsed.data, { ip: clientIp(request), userAgent: userAgent(request) });
  if (result.ok) return Response.json(result.value);
  if (result.error === "rateLimited") {
    const retryAfter = result.retryAfterSeconds ?? 60;
    return apiError("rateLimited", 429, { retryAfterSeconds: retryAfter }, { "Retry-After": String(retryAfter) });
  }
  const status = result.error === "invalidCredentials" || result.error === "invalidCode" ? 401 : result.error === "emailTaken" ? 409 : 400;
  return apiError(result.error, status);
}
