import { agentRoute } from "@/lib/server/agent-route";
import { listAgentTargets } from "@/lib/server/agent-integrations";

export async function GET(request: Request, ctx: RouteContext<"/api/agent/v1/wallets/[id]/purchase-targets">) {
  const { id } = await ctx.params;
  return agentRoute(request, [id], (token, [walletId]) => listAgentTargets(token, walletId));
}
