import { createGoalInput } from "@packages/shared/planning";
import { createGoal, listGoals } from "@/lib/server/planning";
import { requireActor, walletRead, walletWrite } from "@/lib/server/wallet-route";

export const dynamic = "force-dynamic";

/** Goals with the amount saved; `?archived=1` lists the archived ones. */
export async function GET(request: Request, ctx: RouteContext<"/api/wallets/[id]/goals">) {
  const actor = await requireActor();
  if (actor instanceof Response) return actor;
  const { id } = await ctx.params;
  const archived = new URL(request.url).searchParams.get("archived") === "1";
  return walletRead(await listGoals(actor.userId, id, archived), (goals) => ({ goals }));
}

/** Creates a goal (OWNER, ADMIN, EDITOR). */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/goals">) {
  const { id } = await ctx.params;
  return walletWrite(request, createGoalInput, (actor, input) => createGoal(actor, id, input), 201);
}
