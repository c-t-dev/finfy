import { createEntryInput, entryFilter } from "@packages/shared/transactions";
import { createEntry, listEntries } from "@/lib/server/entries";
import { apiError } from "@/lib/server/request";
import { requireActor, walletRead, walletWrite } from "@/lib/server/wallet-route";

export const dynamic = "force-dynamic";

/** Entries of a period (`from`, `to`; optional `accountId`, `categoryId`, `q`) with the period's totals. */
export async function GET(request: Request, ctx: RouteContext<"/api/wallets/[id]/transactions">) {
  const actor = await requireActor();
  if (actor instanceof Response) return actor;
  const { id } = await ctx.params;
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const filter = entryFilter.safeParse(params);
  if (!filter.success) return apiError("invalidInput", 400);
  return walletRead(await listEntries(actor.userId, id, filter.data));
}

/** Creates an income or an expense (OWNER, ADMIN, EDITOR). */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/transactions">) {
  const { id } = await ctx.params;
  return walletWrite(request, createEntryInput, (actor, input) => createEntry(actor, id, input), 201);
}
