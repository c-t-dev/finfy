import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import type { CurrentUser } from "@packages/shared/auth";
import { devices, userSessions, users } from "@packages/shared/db/schema";
import { env } from "@packages/env/server";
import { getDb } from "@/lib/server/db";

/**
 * Sessions (wiki/decisoes/0004): an opaque 32-byte token in an HttpOnly cookie;
 * the database keeps only its SHA-256. Expires after 30 days idle or 90 days in
 * total. Wallet roles are never put in the session: they are read per request.
 */
const IDLE_DAYS = 30;
const ABSOLUTE_DAYS = 90;
/** Touch the session at most once an hour, to keep reads cheap. */
const TOUCH_AFTER_MINUTES = 60;

/** `__Host-` forces Secure, Path=/ and no Domain; it needs HTTPS, so not in development. */
export const SESSION_COOKIE = env.NODE_ENV === "production" ? "__Host-finfy_session" : "finfy_session";

const tokenHash = (token: string) => createHash("sha256").update(token).digest("base64url");

function deviceName(userAgent: string | null): string {
  if (!userAgent) return "Browser";
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Chrome\//.test(userAgent)
      ? "Chrome"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : "Browser";
  const os = /Windows/.test(userAgent)
    ? "Windows"
    : /Mac OS X/.test(userAgent)
      ? "macOS"
      : /Android/.test(userAgent)
        ? "Android"
        : /iPhone|iPad/.test(userAgent)
          ? "iOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : "";
  return os ? `${browser} · ${os}` : browser;
}

/** Creates a session (and its web device row) and sets the cookie. Call only from route handlers. */
export async function startSession(userId: string, meta: { ip: string | null; userAgent: string | null }) {
  const db = getDb();
  const token = randomBytes(32).toString("base64url");
  await db.transaction(async (tx) => {
    const [device] = await tx
      .insert(devices)
      .values({ userId, name: deviceName(meta.userAgent), platform: "WEB" })
      .returning({ id: devices.id });
    await tx.insert(userSessions).values({
      userId,
      deviceId: device.id,
      tokenHash: tokenHash(token),
      ip: meta.ip,
      userAgent: meta.userAgent,
      idleExpiresAt: sql`now() + interval '${sql.raw(String(IDLE_DAYS))} days'`,
      absoluteExpiresAt: sql`now() + interval '${sql.raw(String(ABSOLUTE_DAYS))} days'`,
    });
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ABSOLUTE_DAYS * 24 * 60 * 60,
  });
}

/** Revokes the current session, if any, and clears the cookie. */
export async function endSession(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  store.delete(SESSION_COOKIE);
  if (!token) return null;
  const [revoked] = await getDb()
    .update(userSessions)
    .set({ revokedAt: sql`now()` })
    .where(and(eq(userSessions.tokenHash, tokenHash(token)), isNull(userSessions.revokedAt)))
    .returning({ userId: userSessions.userId });
  return revoked?.userId ?? null;
}

/**
 * The signed-in user, or null. Works in server components and route handlers;
 * cached per request, so the layout, the locale lookup and pages share one query.
 */
export const getCurrentUser = cache(async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !env.DATABASE_URL) return null;
  const db = getDb();
  const [row] = await db
    .select({
      sessionId: userSessions.id,
      lastSeenAt: userSessions.lastSeenAt,
      id: users.id,
      name: users.name,
      email: users.email,
      language: users.language,
      emailVerifiedAt: users.emailVerifiedAt,
    })
    .from(userSessions)
    .innerJoin(users, eq(users.id, userSessions.userId))
    .where(
      and(
        eq(userSessions.tokenHash, tokenHash(token)),
        isNull(userSessions.revokedAt),
        gt(userSessions.idleExpiresAt, sql`now()`),
        gt(userSessions.absoluteExpiresAt, sql`now()`),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);
  if (!row) return null;

  if (Date.now() - row.lastSeenAt.getTime() > TOUCH_AFTER_MINUTES * 60 * 1000) {
    await db
      .update(userSessions)
      .set({
        lastSeenAt: sql`now()`,
        idleExpiresAt: sql`least(now() + interval '${sql.raw(String(IDLE_DAYS))} days', ${userSessions.absoluteExpiresAt})`,
      })
      .where(eq(userSessions.id, row.sessionId));
  }
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    language: row.language,
    emailVerified: row.emailVerifiedAt !== null,
  };
});
