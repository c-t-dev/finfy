import { agentPurchaseInput } from "@packages/shared/integrations";
import { agentRoute } from "@/lib/server/agent-route";
import { recordAgentPurchase } from "@/lib/server/agent-integrations";
import { fail } from "@/lib/server/commands";

export async function POST(request: Request, ctx: RouteContext<"/api/agent/v1/wallets/[id]/cards/[cardId]/purchases">) {
  const { id, cardId } = await ctx.params;
  return agentRoute(request, [id, cardId], async (token, [walletId, targetCardId]) => {
    const input = agentPurchaseInput.safeParse(await request.json().catch(() => null));
    return input.success ? recordAgentPurchase(token, walletId, targetCardId, input.data) : fail("invalidInput");
  }, true);
}
