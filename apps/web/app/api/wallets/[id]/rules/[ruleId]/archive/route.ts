import { ruleActionInput } from "@packages/shared/rules";
import { archiveRule } from "@/lib/server/rules";
import { walletWrite } from "@/lib/server/wallet-route";

/** Deletes (archives) a rule; entries it changed keep their values (OWNER, ADMIN, EDITOR). */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/rules/[ruleId]/archive">) {
  const { id, ruleId } = await ctx.params;
  return walletWrite(request, ruleActionInput, (actor, input) => archiveRule(actor, id, ruleId, input.mutationId));
}
