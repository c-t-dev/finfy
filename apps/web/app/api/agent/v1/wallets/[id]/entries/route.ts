import { agentEntryInput } from "@packages/shared/integrations";
import { agentRoute } from "@/lib/server/agent-route";
import { listAgentEntryTargets, recordAgentEntry } from "@/lib/server/agent-integrations";
import { fail } from "@/lib/server/commands";

export async function GET(request: Request, ctx: RouteContext<"/api/agent/v1/wallets/[id]/entries">) {
  const { id } = await ctx.params;
  return agentRoute(request, [id], (token, [walletId]) => listAgentEntryTargets(token, walletId));
}

export async function POST(request: Request, ctx: RouteContext<"/api/agent/v1/wallets/[id]/entries">) {
  const { id } = await ctx.params;
  return agentRoute(request, [id], async (token, [walletId]) => {
    const input = agentEntryInput.safeParse(await request.json().catch(() => null));
    return input.success ? recordAgentEntry(token, walletId, input.data) : fail("invalidInput");
  }, true);
}
