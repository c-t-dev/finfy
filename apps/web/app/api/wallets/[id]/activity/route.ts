import { listActivity } from "@/lib/server/activity";
import { apiError } from "@/lib/server/request";
import { requireActor, walletRead } from "@/lib/server/wallet-route";

export const dynamic = "force-dynamic";

/** The wallet's activity, newest first; `?before=<ISO time>` loads older entries. */
export async function GET(request: Request, ctx: RouteContext<"/api/wallets/[id]/activity">) {
  const actor = await requireActor();
  if (actor instanceof Response) return actor;
  const { id } = await ctx.params;
  const raw = new URL(request.url).searchParams.get("before");
  const before = raw ? new Date(raw) : null;
  if (before && Number.isNaN(before.getTime())) return apiError("invalidInput", 400);
  return walletRead(await listActivity(actor.userId, id, before));
}
