import { goalStateInput } from "@packages/shared/planning";
import { setGoalArchived } from "@/lib/server/planning";
import { walletWrite } from "@/lib/server/wallet-route";

/** Archives a goal and keeps its deposits (OWNER, ADMIN, EDITOR). */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/goals/[goalId]/archive">) {
  const { id, goalId } = await ctx.params;
  return walletWrite(request, goalStateInput, (actor, input) => setGoalArchived(actor, id, goalId, true, input));
}
