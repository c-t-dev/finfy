import { entryFilter } from "@packages/shared/transactions";
import { getEntrySummary } from "@/lib/server/entries";
import { apiError } from "@/lib/server/request";
import { requireActor, walletRead } from "@/lib/server/wallet-route";

export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: RouteContext<"/api/wallets/[id]/transactions/summary">) {
  const actor = await requireActor();
  if (actor instanceof Response) return actor;
  const { id } = await ctx.params;
  const filter = entryFilter.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!filter.success) return apiError("invalidInput", 400);
  return walletRead(await getEntrySummary(actor.userId, id, filter.data));
}
