import { updateRecurrenceInput } from "@packages/shared/recurrences";
import { updateRecurrence } from "@/lib/server/recurrences";
import { walletWrite } from "@/lib/server/wallet-route";

/** Edits a recurrence from today on; past and paid occurrences stay (OWNER, ADMIN, EDITOR). */
export async function PATCH(request: Request, ctx: RouteContext<"/api/wallets/[id]/recurrences/[recurrenceId]">) {
  const { id, recurrenceId } = await ctx.params;
  return walletWrite(request, updateRecurrenceInput, (actor, input) => updateRecurrence(actor, id, recurrenceId, input));
}
