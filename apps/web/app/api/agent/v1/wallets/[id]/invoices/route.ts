import { agentRoute } from "@/lib/server/agent-route";
import { listAgentInvoices } from "@/lib/server/agent-integrations";

export async function GET(request: Request, ctx: RouteContext<"/api/agent/v1/wallets/[id]/invoices">) {
  const { id } = await ctx.params;
  return agentRoute(request, [id], (token, [walletId]) => listAgentInvoices(token, walletId));
}
