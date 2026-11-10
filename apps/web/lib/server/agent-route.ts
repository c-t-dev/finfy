import "server-only";
import { z } from "zod";
import { env } from "@packages/env/server";
import type { CommandResult } from "./commands";
import { apiError } from "./request";
import { walletRead } from "./wallet-route";

const tokenPattern = /^Bearer (finfy_agent_[A-Za-z0-9_-]{43})$/i;
const uuid = z.uuid();

export async function agentRoute<T>(
  request: Request,
  ids: string[],
  run: (token: string, ids: string[]) => Promise<CommandResult<T>>,
  created = false,
) {
  if (!env.DATABASE_URL) return apiError("unavailable", 503);
  const token = tokenPattern.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) return apiError("unauthenticated", 401, undefined, { "WWW-Authenticate": "Bearer" });
  if (!ids.every(id => uuid.safeParse(id).success)) return apiError("invalidInput", 400);
  const result = await run(token, ids.map(id => id.toLowerCase()));
  const response = result.ok && created ? Response.json(result.value, { status: 201 }) : walletRead(result);
  response.headers.set("Cache-Control", "no-store");
  if (response.status === 401) response.headers.set("WWW-Authenticate", "Bearer");
  return response;
}
