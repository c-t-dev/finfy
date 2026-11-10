import { agentRoute } from "@/lib/server/agent-route";
import { listAgentWallets } from "@/lib/server/agent-integrations";

export function GET(request: Request) {
  return agentRoute(request, [], listAgentWallets);
}
