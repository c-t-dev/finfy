import { listMembers } from "@/lib/server/members";
import { requireActor, walletRead } from "@/lib/server/wallet-route";

export const dynamic = "force-dynamic";

/** Members with their role, and pending invites. */
export async function GET(_request: Request, ctx: RouteContext<"/api/wallets/[id]/members">) {
  const actor = await requireActor();
  if (actor instanceof Response) return actor;
  const { id } = await ctx.params;
  return walletRead(await listMembers(actor.userId, id));
}
