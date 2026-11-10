import { z } from "zod";
import { revokeConnection } from "@/lib/server/agent-integrations";
import { fail } from "@/lib/server/commands";
import { walletWrite } from "@/lib/server/wallet-route";

export async function POST(request: Request, ctx: RouteContext<"/api/integrations/[id]/revoke">) {
  const { id } = await ctx.params;
  return walletWrite(request, z.strictObject({}), async actor => z.uuid().safeParse(id).success
    ? revokeConnection(actor.userId, id) : fail("invalidInput"));
}
