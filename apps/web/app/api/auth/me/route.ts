import { getCurrentUser } from "@/lib/server/auth/session";
import { apiError } from "@/lib/server/request";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  return user ? Response.json(user) : apiError("unauthenticated", 401);
}
