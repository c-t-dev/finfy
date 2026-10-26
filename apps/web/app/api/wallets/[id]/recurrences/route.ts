import { createRecurrenceInput } from "@packages/shared/recurrences";
import { createRecurrence, listRecurrences } from "@/lib/server/recurrences";
import { requireActor, walletRead, walletWrite } from "@/lib/server/wallet-route";

export const dynamic = "force-dynamic";

/** Recurrences with their next date; `?archived=1` lists the ended ones. */
export async function GET(request: Request, ctx: RouteContext<"/api/wallets/[id]/recurrences">) {
  const actor = await requireActor();
  if (actor instanceof Response) return actor;
  const { id } = await ctx.params;
  const archived = new URL(request.url).searchParams.get("archived") === "1";
  return walletRead(await listRecurrences(actor.userId, id, archived), (recurrences) => ({ recurrences }));
}

/** Creates a recurrence and its occurrences up to 90 days ahead (OWNER, ADMIN, EDITOR). */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/recurrences">) {
  const { id } = await ctx.params;
  return walletWrite(request, createRecurrenceInput, (actor, input) => createRecurrence(actor, id, input), 201);
}
