import { createRuleInput } from "@packages/shared/rules";
import { createRule, listRules } from "@/lib/server/rules";
import { requireActor, walletRead, walletWrite } from "@/lib/server/wallet-route";

export const dynamic = "force-dynamic";

/** The wallet's active rules, in priority order. */
export async function GET(_request: Request, ctx: RouteContext<"/api/wallets/[id]/rules">) {
  const actor = await requireActor();
  if (actor instanceof Response) return actor;
  const { id } = await ctx.params;
  return walletRead(await listRules(actor.userId, id), (rules) => ({ rules }));
}

/** Creates a rule; with "apply to history" it also runs on existing entries (OWNER, ADMIN, EDITOR). */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/rules">) {
  const { id } = await ctx.params;
  return walletWrite(request, createRuleInput, (actor, input) => createRule(actor, id, input), 201);
}
