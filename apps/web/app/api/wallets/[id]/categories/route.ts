import { createCategoryInput } from "@packages/shared/categories";
import { createCategory, listCategories } from "@/lib/server/categories";
import { requireActor, walletRead, walletWrite } from "@/lib/server/wallet-route";

export const dynamic = "force-dynamic";

/** System categories plus the wallet's, with hidden flags; `?archived=1` lists the wallet's archived ones. */
export async function GET(request: Request, ctx: RouteContext<"/api/wallets/[id]/categories">) {
  const actor = await requireActor();
  if (actor instanceof Response) return actor;
  const { id } = await ctx.params;
  const archived = new URL(request.url).searchParams.get("archived") === "1";
  return walletRead(await listCategories(actor.userId, id, archived), (categories) => ({ categories }));
}

/** Creates a wallet category or subcategory (OWNER, ADMIN, EDITOR). */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/categories">) {
  const { id } = await ctx.params;
  return walletWrite(request, createCategoryInput, (actor, input) => createCategory(actor, id, input), 201);
}
