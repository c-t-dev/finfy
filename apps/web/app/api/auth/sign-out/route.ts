import { securityEvents } from "@packages/shared/db/schema";
import { endSession } from "@/lib/server/auth/session";
import { getDb } from "@/lib/server/db";
import { apiError, clientIp, isSameOrigin, userAgent } from "@/lib/server/request";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return apiError("forbiddenOrigin", 403);
  const userId = await endSession();
  if (userId) {
    await getDb()
      .insert(securityEvents)
      .values({ userId, type: "LOGOUT", ip: clientIp(request), userAgent: userAgent(request) });
  }
  return new Response(null, { status: 204 });
}
