import { profileInput } from "@packages/shared/auth";
import { updateName } from "@/lib/server/account";
import { getCurrentUser } from "@/lib/server/auth/session";
import { apiError, isSameOrigin } from "@/lib/server/request";

/** Saves the signed-in user's name. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError("forbiddenOrigin", 403);
  const user = await getCurrentUser();
  if (!user) return apiError("unauthenticated", 401);
  const parsed = profileInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("invalidInput", 400);
  await updateName(user.id, parsed.data.name);
  return new Response(null, { status: 204 });
}
