import { createTagInput } from "@packages/shared/tags";
import { createTag, listTags } from "@/lib/server/tags";
import { requireActor, walletRead, walletWrite } from "@/lib/server/wallet-route";

export const dynamic = "force-dynamic";

/** The wallet's tags, by name; `?archived=1` lists the archived ones. */
export async function GET(request: Request, ctx: RouteContext<"/api/wallets/[id]/tags">) {
  const actor = await requireActor();
  if (actor instanceof Response) return actor;
  const { id } = await ctx.params;
  const archived = new URL(request.url).searchParams.get("archived") === "1";
  return walletRead(await listTags(actor.userId, id, archived), (tags) => ({ tags }));
}

/** Creates a tag; an existing name answers the existing tag (OWNER, ADMIN, EDITOR). */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/tags">) {
  const { id } = await ctx.params;
  return walletWrite(request, createTagInput, (actor, input) => createTag(actor, id, input), 201);
}
