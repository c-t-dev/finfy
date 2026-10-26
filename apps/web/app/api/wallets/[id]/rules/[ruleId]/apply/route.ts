import { ruleActionInput } from "@packages/shared/rules";
import { applyRuleNow } from "@/lib/server/rules";
import { walletWrite } from "@/lib/server/wallet-route";

/** Runs a rule on the existing entries it matches (OWNER, ADMIN, EDITOR). */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/rules/[ruleId]/apply">) {
  const { id, ruleId } = await ctx.params;
  return walletWrite(request, ruleActionInput, (actor, input) => applyRuleNow(actor, id, ruleId, input.mutationId));
}
