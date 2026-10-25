import { goalStateInput } from "@packages/shared/planning";
import { setGoalArchived } from "@/lib/server/planning";
import { walletWrite } from "@/lib/server/wallet-route";

/** Brings an archived goal back (OWNER, ADMIN, EDITOR). */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/goals/[goalId]/restore">) {
  const { id, goalId } = await ctx.params;
  return walletWrite(request, goalStateInput, (actor, input) => setGoalArchived(actor, id, goalId, false, input));
}
