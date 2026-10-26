import { getCurrentUser } from "@/lib/server/auth/session";
import { listNotifications } from "@/lib/server/notifications";
import { apiError } from "@/lib/server/request";

export const dynamic = "force-dynamic";

/** The signed-in user's notifications across their wallets, computed now. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError("unauthenticated", 401);
  return Response.json(await listNotifications(user.id));
}
