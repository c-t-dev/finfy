import { entryStateInput } from "@packages/shared/transactions";
import { archiveEntry } from "@/lib/server/entries";
import { walletWrite } from "@/lib/server/wallet-route";

/** Deletes (archives) an entry; both legs of a transfer go together (OWNER, ADMIN, EDITOR). */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/transactions/[entryId]/archive">) {
  const { id, entryId } = await ctx.params;
  return walletWrite(request, entryStateInput, (actor, input) => archiveEntry(actor, id, entryId, input));
}
