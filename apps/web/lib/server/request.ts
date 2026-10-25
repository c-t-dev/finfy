import "server-only";
import { clientEnv } from "@packages/env/client";

/** Client IP as seen by Vercel's proxy (first hop of x-forwarded-for). */
export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null;
}

export function userAgent(request: Request): string | null {
  return request.headers.get("user-agent")?.slice(0, 512) ?? null;
}

/**
 * CSRF guard for cookie-authenticated writes: the browser always sends Origin
 * on POST, so anything not from our own origin is refused. SameSite=Lax on the
 * session cookie is the second layer.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const own = new URL(request.url).origin;
  return origin === own || origin === new URL(clientEnv.NEXT_PUBLIC_APP_URL).origin;
}

/** Error body every API route uses: a stable code the client translates (wiki/decisoes/0011). */
export function apiError(code: string, status: number, extra?: Record<string, unknown>, headers?: HeadersInit) {
  return Response.json({ error: code, ...extra }, { status, headers });
}
