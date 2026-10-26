import { markReadInput } from "@packages/shared/notifications";
import { getCurrentUser } from "@/lib/server/auth/session";
import { markRead } from "@/lib/server/notifications";
import { apiError, isSameOrigin } from "@/lib/server/request";

/** Marks the given notifications read for the signed-in user. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError("forbiddenOrigin", 403);
  const user = await getCurrentUser();
  if (!user) return apiError("unauthenticated", 401);
  const parsed = markReadInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("invalidInput", 400);
  await markRead(user.id, parsed.data.keys);
  return new Response(null, { status: 204 });
}
