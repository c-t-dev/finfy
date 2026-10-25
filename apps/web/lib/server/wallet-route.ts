import "server-only";
import type { z } from "zod";
import { env } from "@packages/env/server";
import type { WalletError } from "@packages/shared/wallets";
import { getSession } from "@/lib/server/auth/session";
import { apiError, clientIp, isSameOrigin, userAgent } from "@/lib/server/request";
import type { CommandResult } from "@/lib/server/commands";
import type { Actor } from "@/lib/server/write";

const STATUS: Record<WalletError, number> = {
  invalidInput: 400,
  unauthenticated: 401,
  invalidCredentials: 401,
  forbiddenOrigin: 403,
  forbidden: 403,
  notFound: 404,
  currencyLocked: 409,
  versionConflict: 409,
  invoicePaid: 409,
  rateLimited: 429,
  unavailable: 503,
};

export type RequestMeta = { ip: string | null; userAgent: string | null };

/** The signed-in actor, or the error response to send instead. */
export async function requireActor(): Promise<Actor | Response> {
  if (!env.DATABASE_URL) return apiError("unavailable", STATUS.unavailable);
  const session = await getSession();
  if (!session) return apiError("unauthenticated", STATUS.unauthenticated);
  return { userId: session.user.id, deviceId: session.deviceId };
}

/**
 * Shared shape of the wallet writes: same-origin check, session, JSON parsed
 * with the shared zod schema, and errors as stable codes (wiki/decisoes/0011).
 * A `null` value answers 204.
 */
export async function walletWrite<T extends z.ZodType, R>(
  request: Request,
  schema: T,
  action: (actor: Actor, input: z.infer<T>, meta: RequestMeta) => Promise<CommandResult<R>>,
  okStatus = 200,
): Promise<Response> {
  if (!isSameOrigin(request)) return apiError("forbiddenOrigin", STATUS.forbiddenOrigin);
  const actor = await requireActor();
  if (actor instanceof Response) return actor;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("invalidInput", STATUS.invalidInput);

  const result = await action(actor, parsed.data, { ip: clientIp(request), userAgent: userAgent(request) });
  if (!result.ok) return errorResponse(result);
  return result.value === null ? new Response(null, { status: 204 }) : Response.json(result.value, { status: okStatus });
}

/** Answers a read command: the shaped value as JSON, or the error code. */
export function walletRead<R>(result: CommandResult<R>, shape: (value: R) => unknown = (value) => value): Response {
  return result.ok ? Response.json(shape(result.value)) : errorResponse(result);
}

function errorResponse(result: Extract<CommandResult<unknown>, { ok: false }>): Response {
  if (result.error === "rateLimited") {
    const retryAfter = result.retryAfterSeconds ?? 60;
    return apiError("rateLimited", 429, { retryAfterSeconds: retryAfter }, { "Retry-After": String(retryAfter) });
  }
  return apiError(result.error, STATUS[result.error]);
}
