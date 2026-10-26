import { setEntryTagsInput } from "@packages/shared/tags";
import { setEntryTags } from "@/lib/server/tags";
import { walletWrite } from "@/lib/server/wallet-route";

/** Replaces an entry's tags; a card purchase's installments all get them (OWNER, ADMIN, EDITOR). */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/transactions/[entryId]/tags">) {
  const { id, entryId } = await ctx.params;
  return walletWrite(request, setEntryTagsInput, (actor, input) => setEntryTags(actor, id, entryId, input));
}
