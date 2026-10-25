import { depositStateInput } from "@packages/shared/planning";
import { archiveDeposit } from "@/lib/server/planning";
import { walletWrite } from "@/lib/server/wallet-route";

/** Deletes a deposit (OWNER, ADMIN, EDITOR). */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/goals/[goalId]/deposits/[depositId]/archive">) {
  const { id, goalId, depositId } = await ctx.params;
  return walletWrite(request, depositStateInput, (actor, input) => archiveDeposit(actor, id, goalId, depositId, input));
}
