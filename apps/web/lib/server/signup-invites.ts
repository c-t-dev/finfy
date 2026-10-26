import "server-only";
import { createHash, randomInt } from "node:crypto";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { env } from "@packages/env/server";
import { securityEvents, signupInvites, users } from "@packages/shared/db/schema";
import {
  normalizeSignupCode,
  SIGNUP_CODE_ALPHABET,
  SIGNUP_CODE_LENGTH,
  SIGNUP_INVITE_DAYS,
  SIGNUP_INVITE_MAX_PENDING,
  formatSignupCode,
  type CreatedSignupInvite,
  type SignupInvite,
  type SignupInviteList,
} from "@packages/shared/signup-invites";
import { hitRateLimit } from "@/lib/server/auth/rate-limit";
import { getDb } from "@/lib/server/db";
import type { Tx } from "@/lib/server/write";

/**
 * Sign-up invite codes (wiki/decisoes/0004 → "Cadastro por convite"). Any
 * account can make them; only the SHA-256 of the code is stored, and the code
 * is shown once.
 */

type Meta = { ip: string | null; userAgent: string | null };

export const signupCodeHash = (code: string) => createHash("sha256").update(normalizeSignupCode(code)).digest("base64url");

/** Unbiased: `randomInt` draws each symbol uniformly. */
function newCode(): string {
  return Array.from({ length: SIGNUP_CODE_LENGTH }, () => SIGNUP_CODE_ALPHABET[randomInt(SIGNUP_CODE_ALPHABET.length)]).join("");
}

/** Sign-up needs a code when it is closed and someone already has an account. */
export async function signUpNeedsCode(): Promise<boolean> {
  if (env.SIGN_UP_MODE !== "invite" || !env.DATABASE_URL) return false;
  const [anyone] = await getDb().select({ id: users.id }).from(users).limit(1);
  return Boolean(anyone);
}

const usable = (hash: string) =>
  and(eq(signupInvites.codeHash, hash), isNull(signupInvites.usedAt), isNull(signupInvites.revokedAt), gt(signupInvites.expiresAt, sql`now()`));

/** Read-only check, done before looking the e-mail up, so outsiders learn nothing about accounts. */
export async function isUsableCode(code: string): Promise<boolean> {
  const [row] = await getDb().select({ id: signupInvites.id }).from(signupInvites).where(usable(signupCodeHash(code))).limit(1);
  return Boolean(row);
}

/** Marks the code used by the new account, in the sign-up transaction; null when someone else used it first. */
export async function claimCode(tx: Tx, code: string, userId: string): Promise<string | null> {
  const [row] = await tx
    .update(signupInvites)
    .set({ usedAt: sql`now()`, usedBy: userId })
    .where(usable(signupCodeHash(code)))
    .returning({ id: signupInvites.id });
  return row?.id ?? null;
}

const status = (row: typeof signupInvites.$inferSelect, now: Date): SignupInvite["status"] =>
  row.usedAt ? "USED" : row.revokedAt ? "REVOKED" : row.expiresAt <= now ? "EXPIRED" : "PENDING";

function toInvite(row: typeof signupInvites.$inferSelect, usedByName: string | null, now = new Date()): SignupInvite {
  return {
    id: row.id,
    note: row.note,
    status: status(row, now),
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    usedAt: row.usedAt?.toISOString() ?? null,
    usedByName,
  };
}

/** The account's codes, newest first (the last 50). */
export async function listSignupInvites(userId: string): Promise<SignupInviteList> {
  const rows = await getDb()
    .select({ invite: signupInvites, usedByName: users.name })
    .from(signupInvites)
    .leftJoin(users, eq(users.id, signupInvites.usedBy))
    .where(eq(signupInvites.createdBy, userId))
    .orderBy(desc(signupInvites.createdAt))
    .limit(50);
  return { invites: rows.map((row) => toInvite(row.invite, row.usedByName)), signUpClosed: env.SIGN_UP_MODE === "invite" };
}

export type InviteResult<T> = { ok: true; value: T } | { ok: false; error: "rateLimited" | "tooManyInvites" | "notFound"; retryAfterSeconds?: number };

/** 20 codes a day per account, and at most SIGNUP_INVITE_MAX_PENDING waiting at once. */
export async function createSignupInvite(userId: string, note: string | undefined, meta: Meta): Promise<InviteResult<CreatedSignupInvite>> {
  const limit = await hitRateLimit("signupInviteByUser", userId);
  if (!limit.allowed) return { ok: false, error: "rateLimited", retryAfterSeconds: limit.retryAfterSeconds };
  const db = getDb();
  const [{ pending }] = await db
    .select({ pending: sql<number>`count(*)::int` })
    .from(signupInvites)
    .where(and(eq(signupInvites.createdBy, userId), isNull(signupInvites.usedAt), isNull(signupInvites.revokedAt), gt(signupInvites.expiresAt, sql`now()`)));
  if (pending >= SIGNUP_INVITE_MAX_PENDING) return { ok: false, error: "tooManyInvites" };

  const code = newCode();
  const [row] = await db
    .insert(signupInvites)
    .values({
      createdBy: userId,
      codeHash: signupCodeHash(code),
      note: note || null,
      expiresAt: sql`now() + ${sql.raw(`interval '${SIGNUP_INVITE_DAYS} days'`)}`,
    })
    .returning();
  await db.insert(securityEvents).values({ userId, type: "SIGNUP_INVITE_CREATED", ip: meta.ip, userAgent: meta.userAgent, metadata: { inviteId: row.id } });
  return { ok: true, value: { invite: toInvite(row, null), code: formatSignupCode(code) } };
}

/** Only the account that made it, and only while unused. */
export async function revokeSignupInvite(userId: string, inviteId: string, meta: Meta): Promise<InviteResult<null>> {
  const db = getDb();
  const [row] = await db
    .update(signupInvites)
    .set({ revokedAt: sql`now()` })
    .where(and(eq(signupInvites.id, inviteId), eq(signupInvites.createdBy, userId), isNull(signupInvites.usedAt), isNull(signupInvites.revokedAt)))
    .returning({ id: signupInvites.id });
  if (!row) return { ok: false, error: "notFound" };
  await db.insert(securityEvents).values({ userId, type: "SIGNUP_INVITE_REVOKED", ip: meta.ip, userAgent: meta.userAgent, metadata: { inviteId } });
  return { ok: true, value: null };
}
