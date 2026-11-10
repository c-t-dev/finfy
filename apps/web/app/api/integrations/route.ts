import { connectionInput } from "@packages/shared/integrations";
import { createConnection, listConnections } from "@/lib/server/agent-integrations";
import { requireActor, walletRead, walletWrite } from "@/lib/server/wallet-route";

export async function GET() {
  const actor = await requireActor();
  if (actor instanceof Response) return actor;
  const response = walletRead(await listConnections(actor.userId));
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function POST(request: Request) {
  const response = await walletWrite(request, connectionInput, (actor, input) => createConnection(actor.userId, input), 201);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
