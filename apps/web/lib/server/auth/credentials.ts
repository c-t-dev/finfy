import "server-only";
import { eq } from "drizzle-orm";
import { userCredentials, users } from "@packages/shared/db/schema";
import type { Tx } from "@/lib/server/write";

type Credential = typeof userCredentials.$inferSelect;

/** Shared lock order for login completion and password replacement. */
export async function lockCredentials(tx: Tx, userId: string) {
  const [user] = await tx.select().from(users).where(eq(users.id, userId)).for("update").limit(1);
  if (!user) return null;
  const [credentials] = await tx.select().from(userCredentials)
    .where(eq(userCredentials.userId, userId)).for("update").limit(1);
  return credentials ? { user, credentials } : null;
}

/** Reject a verification made against credentials that changed while hashing. */
export function sameCredentials(current: Credential, verified: Credential): boolean {
  return current.passwordHash === verified.passwordHash
    && current.pepperVersion === verified.pepperVersion
    && current.passwordChangedAt.getTime() === verified.passwordChangedAt.getTime();
}
