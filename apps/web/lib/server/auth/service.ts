import "server-only";
import { eq, sql } from "drizzle-orm";
import {
  passwordProblem,
  type AuthError,
  type AuthNext,
  type SignInInput,
  type SignUpInput,
  type VerifyEmailInput,
} from "@packages/shared/auth";
import { securityEvents, userCredentials, users } from "@packages/shared/db/schema";
import { getDb } from "@/lib/server/db";
import { EMAIL_DELIVERY_ENABLED, queueEmail } from "@/lib/server/mail";
import { claimCode, isUsableCode, signUpNeedsCode } from "@/lib/server/signup-invites";
import type { Tx } from "@/lib/server/write";
import { isBreachedPassword } from "./breached";
import { consumeOtp, issueOtp } from "./otp";
import { hashPassword, verifyDummyPassword, verifyPassword } from "./password";
import { hitRateLimit } from "./rate-limit";
import { startSession } from "./session";

/**
 * Sign-up, sign-in and e-mail verification (wiki/decisoes/0004). An unknown
 * e-mail on sign-in costs the same hashing time as a known one.
 *
 * With e-mail delivery on, sign-up always answers "check your e-mail", so it
 * never reveals whether an e-mail has an account. With it off (for now, see
 * EMAIL_DELIVERY_ENABLED), there is no way to tell the owner privately, so
 * sign-up answers `emailTaken`; the per-IP limit slows down anyone probing.
 *
 * While sign-up is closed (`SIGN_UP_MODE=invite`), the invite code is checked
 * before the e-mail, so without a code nobody learns which e-mails have an
 * account, and it is spent in the same transaction that creates the user.
 */

export type RequestMeta = { ip: string | null; userAgent: string | null };
export type AuthResult = { ok: true; value: AuthNext } | { ok: false; error: AuthError; retryAfterSeconds?: number };

/** Rolls the sign-up back when the code was spent by someone else meanwhile. */
class CodeTaken extends Error {}

/** 5 failures lock the account for 1, 2, 4, 8, then 15 minutes. */
const LOCK_AFTER_FAILURES = 5;
const MAX_LOCK_MINUTES = 15;

function lockMinutes(failures: number): number {
  return Math.min(MAX_LOCK_MINUTES, 2 ** (failures - LOCK_AFTER_FAILURES));
}

async function logEvent(userId: string | null, type: string, meta: RequestMeta, metadata?: Record<string, unknown>) {
  await getDb().insert(securityEvents).values({ userId, type, ip: meta.ip, userAgent: meta.userAgent, metadata });
}

export async function signUp(input: SignUpInput, meta: RequestMeta): Promise<AuthResult> {
  const limit = await hitRateLimit("signUpByIp", meta.ip ?? "unknown");
  if (!limit.allowed) return { ok: false, error: "rateLimited", retryAfterSeconds: limit.retryAfterSeconds };

  const problem = passwordProblem(input.password, input.email);
  if (problem) return { ok: false, error: problem };
  if (await isBreachedPassword(input.password)) return { ok: false, error: "passwordBreached" };

  const needsCode = await signUpNeedsCode();
  if (needsCode) {
    if (!input.inviteCode) return { ok: false, error: "inviteCodeRequired" };
    if (!(await isUsableCode(input.inviteCode))) {
      await logEvent(null, "SIGN_UP_INVITE_INVALID", meta);
      return { ok: false, error: "inviteCodeInvalid" };
    }
  }
  /** Spends the code for the new user; throws CodeTaken to roll the sign-up back. */
  const spendCode = async (tx: Tx, userId: string) => {
    if (!needsCode) return undefined;
    const inviteId = await claimCode(tx, input.inviteCode!, userId);
    if (!inviteId) throw new CodeTaken();
    return { inviteId };
  };

  // Hash before looking the e-mail up, so both paths take the same time.
  const password = await hashPassword(input.password);
  const db = getDb();
  const [existing] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);

  if (!EMAIL_DELIVERY_ENABLED) {
    if (existing) return { ok: false, error: "emailTaken" };
    const userId = await db
      .transaction(async (tx) => {
        const [user] = await tx
          .insert(users)
          .values({ name: input.name, email: input.email, language: input.locale })
          .returning({ id: users.id });
        await tx
          .insert(userCredentials)
          .values({ userId: user.id, passwordHash: password.hash, pepperVersion: password.pepperVersion });
        const metadata = await spendCode(tx, user.id);
        await tx.insert(securityEvents).values({ userId: user.id, type: "SIGN_UP", ip: meta.ip, userAgent: meta.userAgent, metadata });
        return user.id;
      })
      .catch((error: unknown) => {
        if (error instanceof CodeTaken) return null;
        throw error;
      });
    if (!userId) return { ok: false, error: "inviteCodeInvalid" };
    // `email_verified_at` stays empty: nothing proved the address yet.
    await startSession(userId, meta);
    return { ok: true, value: { next: "app" } };
  }

  if (existing) {
    await queueEmail(db, {
      to: existing.email,
      template: "sign-up-existing-account",
      locale: existing.language,
      payload: {},
    });
    await logEvent(existing.id, "SIGN_UP_EXISTING_ACCOUNT", meta);
  } else {
    await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({ name: input.name, email: input.email, language: input.locale })
        .returning({ id: users.id });
      await tx
        .insert(userCredentials)
        .values({ userId: user.id, passwordHash: password.hash, pepperVersion: password.pepperVersion });
      const metadata = await spendCode(tx, user.id);
      const code = await issueOtp(tx, { email: input.email, userId: user.id, purpose: "EMAIL_VERIFY" });
      await queueEmail(tx, { to: input.email, template: "verify-email", locale: input.locale, payload: { code } });
      await tx.insert(securityEvents).values({ userId: user.id, type: "SIGN_UP", ip: meta.ip, userAgent: meta.userAgent, metadata });
    }).catch((error: unknown) => {
      if (!(error instanceof CodeTaken)) throw error;
    });
  }
  return { ok: true, value: { next: "verifyEmail", email: input.email } };
}

export async function signIn(input: SignInInput, meta: RequestMeta): Promise<AuthResult> {
  const limit = await hitRateLimit("signInByIp", meta.ip ?? "unknown");
  if (!limit.allowed) return { ok: false, error: "rateLimited", retryAfterSeconds: limit.retryAfterSeconds };

  const db = getDb();
  const [row] = await db
    .select({ user: users, credentials: userCredentials })
    .from(users)
    .leftJoin(userCredentials, eq(userCredentials.userId, users.id))
    .where(eq(users.email, input.email))
    .limit(1);

  if (!row || !row.credentials || row.user.deletedAt) {
    await verifyDummyPassword(input.password);
    return { ok: false, error: "invalidCredentials" };
  }
  const { user, credentials } = row;

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await verifyDummyPassword(input.password);
    const retryAfterSeconds = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000);
    return { ok: false, error: "rateLimited", retryAfterSeconds };
  }

  const check = await verifyPassword({ hash: credentials.passwordHash, pepperVersion: credentials.pepperVersion }, input.password);
  if (!check.ok) {
    const failures = user.failedLoginCount + 1;
    await db
      .update(users)
      .set({
        failedLoginCount: failures,
        lockedUntil:
          failures >= LOCK_AFTER_FAILURES
            ? sql`now() + interval '${sql.raw(String(lockMinutes(failures)))} minutes'`
            : user.lockedUntil,
        updatedAt: sql`now()`,
      })
      .where(eq(users.id, user.id));
    await logEvent(user.id, "LOGIN_FAILED", meta, { failures });
    return { ok: false, error: "invalidCredentials" };
  }

  await db
    .update(users)
    .set({ failedLoginCount: 0, lockedUntil: null, updatedAt: sql`now()` })
    .where(eq(users.id, user.id));
  if (check.needsRehash) {
    const fresh = await hashPassword(input.password);
    await db
      .update(userCredentials)
      .set({ passwordHash: fresh.hash, pepperVersion: fresh.pepperVersion })
      .where(eq(userCredentials.userId, user.id));
  }

  if (EMAIL_DELIVERY_ENABLED && !user.emailVerifiedAt) {
    const code = await issueOtp(db, { email: user.email, userId: user.id, purpose: "EMAIL_VERIFY" });
    await queueEmail(db, { to: user.email, template: "verify-email", locale: user.language, payload: { code } });
    return { ok: true, value: { next: "verifyEmail", email: user.email } };
  }

  await startSession(user.id, meta);
  await logEvent(user.id, "LOGIN", meta);
  return { ok: true, value: { next: "app" } };
}

export async function verifyEmail(input: VerifyEmailInput, meta: RequestMeta): Promise<AuthResult> {
  const limit = await hitRateLimit("verifyByIp", meta.ip ?? "unknown");
  if (!limit.allowed) return { ok: false, error: "rateLimited", retryAfterSeconds: limit.retryAfterSeconds };

  const db = getDb();
  if (!(await consumeOtp(db, { email: input.email, purpose: "EMAIL_VERIFY", code: input.code }))) {
    return { ok: false, error: "invalidCode" };
  }
  const [user] = await db
    .update(users)
    .set({ emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, now())`, updatedAt: sql`now()` })
    .where(eq(users.email, input.email))
    .returning({ id: users.id });
  if (!user) return { ok: false, error: "invalidCode" };

  await startSession(user.id, meta);
  await logEvent(user.id, "EMAIL_VERIFIED", meta);
  return { ok: true, value: { next: "app" } };
}

/** Always answers the same; only sends when the account exists and is unverified. */
export async function resendCode(email: string): Promise<AuthResult> {
  const limit = await hitRateLimit("codeByEmail", email);
  if (!limit.allowed) return { ok: false, error: "rateLimited", retryAfterSeconds: limit.retryAfterSeconds };

  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (user && !user.emailVerifiedAt && !user.deletedAt) {
    const code = await issueOtp(db, { email, userId: user.id, purpose: "EMAIL_VERIFY" });
    await queueEmail(db, { to: email, template: "verify-email", locale: user.language, payload: { code } });
  }
  return { ok: true, value: { next: "verifyEmail", email } };
}
