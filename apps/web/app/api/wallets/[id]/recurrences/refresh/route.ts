import { refreshRecurrencesInput } from "@packages/shared/recurrences";
import { refreshRecurrences } from "@/lib/server/recurrences";
import { walletWrite } from "@/lib/server/wallet-route";

/** Tops up the occurrences of every active recurrence to the horizon; a no-op when nothing is missing. */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/recurrences/refresh">) {
  const { id } = await ctx.params;
  return walletWrite(request, refreshRecurrencesInput, (actor, input) => refreshRecurrences(actor, id, input.mutationId));
}
