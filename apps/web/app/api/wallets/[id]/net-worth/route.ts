import { netWorth } from "@/lib/server/patrimony";
import { requireActor, walletRead } from "@/lib/server/wallet-route";

export const dynamic = "force-dynamic";

/** Accounts + assets − liabilities − unpaid card purchases, by ownership share. */
export async function GET(_request: Request, ctx: RouteContext<"/api/wallets/[id]/net-worth">) {
  const actor = await requireActor();
  if (actor instanceof Response) return actor;
  const { id } = await ctx.params;
  return walletRead(await netWorth(actor.userId, id));
}
