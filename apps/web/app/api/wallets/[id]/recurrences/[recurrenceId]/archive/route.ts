import { recurrenceStateInput } from "@packages/shared/recurrences";
import { archiveRecurrence } from "@/lib/server/recurrences";
import { walletWrite } from "@/lib/server/wallet-route";

/** Ends a recurrence: pending occurrences from today are deleted, past ones stay (OWNER, ADMIN, EDITOR). */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/recurrences/[recurrenceId]/archive">) {
  const { id, recurrenceId } = await ctx.params;
  return walletWrite(request, recurrenceStateInput, (actor, input) => archiveRecurrence(actor, id, recurrenceId, input));
}
