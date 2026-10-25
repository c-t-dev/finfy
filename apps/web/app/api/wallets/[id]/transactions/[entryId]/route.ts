import { updateEntryInput } from "@packages/shared/transactions";
import { updateEntry } from "@/lib/server/entries";
import { walletWrite } from "@/lib/server/wallet-route";

/** Edits an entry; on a transfer, shared fields change on both legs (OWNER, ADMIN, EDITOR). */
export async function PATCH(request: Request, ctx: RouteContext<"/api/wallets/[id]/transactions/[entryId]">) {
  const { id, entryId } = await ctx.params;
  return walletWrite(request, updateEntryInput, (actor, input) => updateEntry(actor, id, entryId, input));
}
