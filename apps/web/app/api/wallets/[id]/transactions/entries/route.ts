import { entryFilter } from "@packages/shared/transactions";
import { listEntryRows } from "@/lib/server/entries";
import { apiError } from "@/lib/server/request";
import { requireActor, walletRead } from "@/lib/server/wallet-route";

export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: RouteContext<"/api/wallets/[id]/transactions/entries">) {
  const actor = await requireActor();
  if (actor instanceof Response) return actor;
  const { id } = await ctx.params;
  const filter = entryFilter.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!filter.success) return apiError("invalidInput", 400);
  return walletRead(await listEntryRows(actor.userId, id, filter.data));
}
