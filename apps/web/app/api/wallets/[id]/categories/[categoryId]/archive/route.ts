import { categoryStateInput } from "@packages/shared/categories";
import { archiveCategory } from "@/lib/server/categories";
import { walletWrite } from "@/lib/server/wallet-route";

/** Archives a wallet category and its subcategories (OWNER, ADMIN, EDITOR). */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/categories/[categoryId]/archive">) {
  const { id, categoryId } = await ctx.params;
  return walletWrite(request, categoryStateInput, (actor, input) => archiveCategory(actor, id, categoryId, input));
}
