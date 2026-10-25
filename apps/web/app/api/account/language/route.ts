import { eq, sql } from "drizzle-orm";
import { languageInput as input } from "@packages/shared/auth";
import { users } from "@packages/shared/db/schema";
import { getCurrentUser } from "@/lib/server/auth/session";
import { getDb } from "@/lib/server/db";
import { apiError, isSameOrigin } from "@/lib/server/request";

/** Saves the signed-in user's language (`users.language`, wiki/decisoes/0011). */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError("forbiddenOrigin", 403);
  const user = await getCurrentUser();
  if (!user) return apiError("unauthenticated", 401);
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("invalidInput", 400);
  await getDb()
    .update(users)
    .set({ language: parsed.data.language, updatedAt: sql`now()` })
    .where(eq(users.id, user.id));
  return new Response(null, { status: 204 });
}
