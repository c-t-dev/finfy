import "server-only";
import { randomInt } from "node:crypto";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { OTP_LENGTH } from "@packages/shared/auth";
import { otpCodes, type OTP_PURPOSES } from "@packages/shared/db/schema";
import type { getDb } from "@/lib/server/db";
import { hmacSecret } from "./password";

// Works with the database or a transaction.
type Db = Pick<ReturnType<typeof getDb>, "select" | "insert" | "update">;
type Purpose = (typeof OTP_PURPOSES)[number];

/** E-mailed codes: 6 digits, 10 minutes, 5 attempts (wiki/decisoes/0004). */
const TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

function codeHash(purpose: Purpose, email: string, code: string): string {
  return hmacSecret(`${purpose}:${email}:${code}`);
}

/** Issues a new code and invalidates the previous ones for the same purpose. */
export async function issueOtp(db: Db, input: { email: string; userId: string | null; purpose: Purpose }): Promise<string> {
  const code = randomInt(0, 10 ** OTP_LENGTH)
    .toString()
    .padStart(OTP_LENGTH, "0");
  await db
    .update(otpCodes)
    .set({ usedAt: sql`now()` })
    .where(and(eq(otpCodes.email, input.email), eq(otpCodes.purpose, input.purpose), isNull(otpCodes.usedAt)));
  await db.insert(otpCodes).values({
    email: input.email,
    userId: input.userId,
    purpose: input.purpose,
    codeHash: codeHash(input.purpose, input.email, code),
    expiresAt: sql`now() + interval '${sql.raw(String(TTL_MINUTES))} minutes'`,
  });
  return code;
}

/** Checks the latest live code; every wrong guess burns an attempt. */
export async function consumeOtp(db: Db, input: { email: string; purpose: Purpose; code: string }): Promise<boolean> {
  const [otp] = await db
    .select()
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.email, input.email),
        eq(otpCodes.purpose, input.purpose),
        isNull(otpCodes.usedAt),
        gt(otpCodes.expiresAt, sql`now()`),
      ),
    )
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);
  if (!otp || otp.attempts >= MAX_ATTEMPTS) return false;

  if (otp.codeHash !== codeHash(input.purpose, input.email, input.code)) {
    await db
      .update(otpCodes)
      .set({ attempts: sql`${otpCodes.attempts} + 1` })
      .where(eq(otpCodes.id, otp.id));
    return false;
  }
  const used = await db
    .update(otpCodes)
    .set({ usedAt: sql`now()` })
    .where(and(eq(otpCodes.id, otp.id), isNull(otpCodes.usedAt)))
    .returning({ id: otpCodes.id });
  return used.length === 1;
}
