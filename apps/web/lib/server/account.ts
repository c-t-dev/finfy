import "server-only";
import { eq, sql } from "drizzle-orm";
import { passwordProblem, type AuthError, type ChangePasswordInput } from "@packages/shared/auth";
import { securityEvents, userCredentials, users } from "@packages/shared/db/schema";
import { isBreachedPassword } from "@/lib/server/auth/breached";
import { hashPassword, verifyPassword } from "@/lib/server/auth/password";
import { hitRateLimit } from "@/lib/server/auth/rate-limit";
import { revokeOtherSessions } from "@/lib/server/auth/session";
import { getDb } from "@/lib/server/db";

/** The signed-in user's own account: name and password (wiki/decisoes/0004). */

export type AccountResult = { ok: true } | { ok: false; error: AuthError; retryAfterSeconds?: number };
type Meta = { ip: string | null; userAgent: string | null };

export async function updateName(userId: string, name: string): Promise<void> {
  await getDb().update(users).set({ name, updatedAt: sql`now()` }).where(eq(users.id, userId));
}

/**
 * Checks the current password (5 tries per 15 minutes, like other step-ups),
 * applies the sign-up rules to the new one, stores it with the current pepper
 * and ends every other session. The e-mail notice waits for an e-mail provider.
 */
export async function changePassword(userId: string, email: string, input: ChangePasswordInput, meta: Meta): Promise<AccountResult> {
  const limit = await hitRateLimit("stepUpByUser", userId);
  if (!limit.allowed) return { ok: false, error: "rateLimited", retryAfterSeconds: limit.retryAfterSeconds };

  const db = getDb();
  const [credentials] = await db.select().from(userCredentials).where(eq(userCredentials.userId, userId)).limit(1);
  const check = credentials
    ? await verifyPassword({ hash: credentials.passwordHash, pepperVersion: credentials.pepperVersion }, input.currentPassword)
    : { ok: false };
  if (!check.ok) {
    await db.insert(securityEvents).values({ userId, type: "PASSWORD_CHANGE_FAILED", ip: meta.ip, userAgent: meta.userAgent });
    return { ok: false, error: "invalidCredentials" };
  }

  const problem = passwordProblem(input.newPassword, email);
  if (problem) return { ok: false, error: problem };
  if (await isBreachedPassword(input.newPassword)) return { ok: false, error: "passwordBreached" };

  const fresh = await hashPassword(input.newPassword);
  await db
    .update(userCredentials)
    .set({ passwordHash: fresh.hash, pepperVersion: fresh.pepperVersion, passwordChangedAt: sql`now()` })
    .where(eq(userCredentials.userId, userId));
  const ended = await revokeOtherSessions(userId);
  await db
    .insert(securityEvents)
    .values({ userId, type: "PASSWORD_CHANGED", ip: meta.ip, userAgent: meta.userAgent, metadata: { otherSessionsEnded: ended } });
  return { ok: true };
}
