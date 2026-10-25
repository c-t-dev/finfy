import { updateGoalInput } from "@packages/shared/planning";
import { getGoal, updateGoal } from "@/lib/server/planning";
import { requireActor, walletRead, walletWrite } from "@/lib/server/wallet-route";

export const dynamic = "force-dynamic";

/** A goal with its deposits. */
export async function GET(_request: Request, ctx: RouteContext<"/api/wallets/[id]/goals/[goalId]">) {
  const actor = await requireActor();
  if (actor instanceof Response) return actor;
  const { id, goalId } = await ctx.params;
  return walletRead(await getGoal(actor.userId, id, goalId));
}

/** Edits a goal (OWNER, ADMIN, EDITOR). */
export async function PATCH(request: Request, ctx: RouteContext<"/api/wallets/[id]/goals/[goalId]">) {
  const { id, goalId } = await ctx.params;
  return walletWrite(request, updateGoalInput, (actor, input) => updateGoal(actor, id, goalId, input));
}
