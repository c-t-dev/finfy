import { createAssetInput } from "@packages/shared/patrimony";
import { createAsset, listAssets } from "@/lib/server/patrimony";
import { requireActor, walletRead, walletWrite } from "@/lib/server/wallet-route";

export const dynamic = "force-dynamic";

/** Assets and liabilities; `?archived=1` lists the archived ones. */
export async function GET(request: Request, ctx: RouteContext<"/api/wallets/[id]/assets">) {
  const actor = await requireActor();
  if (actor instanceof Response) return actor;
  const { id } = await ctx.params;
  const archived = new URL(request.url).searchParams.get("archived") === "1";
  return walletRead(await listAssets(actor.userId, id, archived), (assets) => ({ assets }));
}

/** Adds an asset or a liability (OWNER, ADMIN, EDITOR). */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/assets">) {
  const { id } = await ctx.params;
  return walletWrite(request, createAssetInput, (actor, input) => createAsset(actor, id, input), 201);
}
