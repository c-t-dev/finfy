import "server-only";
import { sql } from "drizzle-orm";
import { rateLimits } from "@packages/shared/db/schema";
import { getDb } from "@/lib/server/db";

/** Limits per action (wiki/decisoes/0004, "Contra força bruta"). */
export const LIMITS = {
  signInByIp: { limit: 20, windowSeconds: 15 * 60 },
  signUpByIp: { limit: 10, windowSeconds: 60 * 60 },
  codeByEmail: { limit: 5, windowSeconds: 15 * 60 },
  verifyByIp: { limit: 30, windowSeconds: 15 * 60 },
  // Password asked again before a sensitive action (step-up).
  stepUpByUser: { limit: 5, windowSeconds: 15 * 60 },
  signupInviteByUser: { limit: 20, windowSeconds: 24 * 60 * 60 },
} as const;

/**
 * Counts one hit in a fixed window and says whether it is allowed. One atomic
 * upsert, so parallel requests cannot slip past the limit.
 */
export async function hitRateLimit(
  name: keyof typeof LIMITS,
  subject: string,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const { limit, windowSeconds } = LIMITS[name];
  const key = `${name}:${subject}`;
  const window = sql.raw(`interval '${windowSeconds} seconds'`);
  const [row] = await getDb()
    .insert(rateLimits)
    .values({ key, windowStartedAt: sql`now()`, count: 1 })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        // Restart the window when it has expired, otherwise count the hit.
        count: sql`case when ${rateLimits.windowStartedAt} < now() - ${window} then 1 else ${rateLimits.count} + 1 end`,
        windowStartedAt: sql`case when ${rateLimits.windowStartedAt} < now() - ${window} then now() else ${rateLimits.windowStartedAt} end`,
      },
    })
    .returning({
      count: rateLimits.count,
      retryAfter: sql<number>`ceil(extract(epoch from ${rateLimits.windowStartedAt} + ${window} - now()))::int`,
    });
  return { allowed: row.count <= limit, retryAfterSeconds: Math.max(1, row.retryAfter) };
}
