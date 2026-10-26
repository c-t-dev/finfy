import { homeInsightsQuery } from "@packages/shared/home";
import { homeInsights } from "@/lib/server/home";
import { apiError } from "@/lib/server/request";
import { requireActor, walletRead } from "@/lib/server/wallet-route";

export const dynamic = "force-dynamic";

/** Income, expense and month-end balance (confirmed and projected) for the Home charts. */
export async function GET(request: Request, ctx: RouteContext<"/api/wallets/[id]/home/insights">) {
  const actor = await requireActor();
  if (actor instanceof Response) return actor;
  const { id } = await ctx.params;
  const params = new URL(request.url).searchParams;
  const query = homeInsightsQuery.safeParse({ month: params.get("month"), months: params.get("months"), ahead: params.get("ahead") ?? "3" });
  if (!query.success) return apiError("invalidInput", 400);
  return walletRead(await homeInsights(actor.userId, id, query.data));
}
