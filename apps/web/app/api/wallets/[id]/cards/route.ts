import { createCardInput } from "@packages/shared/cards";
import { createCard, listCards } from "@/lib/server/cards";
import { requireActor, walletRead, walletWrite } from "@/lib/server/wallet-route";

export const dynamic = "force-dynamic";

/** Cards with the limit used and the current invoice; `?archived=1` lists the archived ones. */
export async function GET(request: Request, ctx: RouteContext<"/api/wallets/[id]/cards">) {
  const actor = await requireActor();
  if (actor instanceof Response) return actor;
  const { id } = await ctx.params;
  const archived = new URL(request.url).searchParams.get("archived") === "1";
  return walletRead(await listCards(actor.userId, id, archived), (cards) => ({ cards }));
}

/** Creates a credit card (OWNER, ADMIN, EDITOR). */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/cards">) {
  const { id } = await ctx.params;
  return walletWrite(request, createCardInput, (actor, input) => createCard(actor, id, input), 201);
}
