import { updateRuleInput } from "@packages/shared/rules";
import { updateRule } from "@/lib/server/rules";
import { walletWrite } from "@/lib/server/wallet-route";

/** Edits a rule; with "apply to history" on, it runs again on existing entries (OWNER, ADMIN, EDITOR). */
export async function PATCH(request: Request, ctx: RouteContext<"/api/wallets/[id]/rules/[ruleId]">) {
  const { id, ruleId } = await ctx.params;
  return walletWrite(request, updateRuleInput, (actor, input) => updateRule(actor, id, ruleId, input));
}
