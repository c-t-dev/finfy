import { createDepositInput } from "@packages/shared/planning";
import { createDeposit } from "@/lib/server/planning";
import { walletWrite } from "@/lib/server/wallet-route";

/** Records money put into (positive) or taken out of (negative) a goal (OWNER, ADMIN, EDITOR). */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/goals/[goalId]/deposits">) {
  const { id, goalId } = await ctx.params;
  return walletWrite(request, createDepositInput, (actor, input) => createDeposit(actor, id, goalId, input), 201);
}
