import { createTransferInput } from "@packages/shared/transactions";
import { createTransfer } from "@/lib/server/entries";
import { walletWrite } from "@/lib/server/wallet-route";

/** Moves money between two accounts of the wallet: two linked entries (OWNER, ADMIN, EDITOR). */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/transactions/transfers">) {
  const { id } = await ctx.params;
  return walletWrite(request, createTransferInput, (actor, input) => createTransfer(actor, id, input), 201);
}
