import { previewRuleInput } from "@packages/shared/rules";
import { previewRule } from "@/lib/server/rules";
import { walletWrite } from "@/lib/server/wallet-route";

/** How many existing entries the conditions match, with a sample; changes nothing (any member). */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/rules/preview">) {
  const { id } = await ctx.params;
  return walletWrite(request, previewRuleInput, (actor, input) => previewRule(actor.userId, id, input));
}
