import { checkChain } from "@/lib/server/activity";
import { requireActor, walletRead } from "@/lib/server/wallet-route";

export const dynamic = "force-dynamic";

/** Recomputes the wallet's audit hash chain (OWNER, ADMIN). */
export async function GET(_request: Request, ctx: RouteContext<"/api/wallets/[id]/activity/verify">) {
  const actor = await requireActor();
  if (actor instanceof Response) return actor;
  const { id } = await ctx.params;
  return walletRead(await checkChain(actor.userId, id));
}
