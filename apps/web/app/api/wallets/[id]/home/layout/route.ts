import { saveHomeLayoutInput } from "@packages/shared/home";
import { getHomeLayout, saveHomeLayout } from "@/lib/server/home";
import { requireActor, walletRead, walletWrite } from "@/lib/server/wallet-route";

export const dynamic = "force-dynamic";

/** The signed-in member's Home layout for this wallet, or the default one. */
export async function GET(_request: Request, ctx: RouteContext<"/api/wallets/[id]/home/layout">) {
  const actor = await requireActor();
  if (actor instanceof Response) return actor;
  const { id } = await ctx.params;
  return walletRead(await getHomeLayout(actor.userId, id));
}

/** Replaces the member's own layout (any member); `widgets: null` restores the default. */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/home/layout">) {
  const { id } = await ctx.params;
  return walletWrite(request, saveHomeLayoutInput, (actor, input) => saveHomeLayout(actor.userId, id, input));
}
