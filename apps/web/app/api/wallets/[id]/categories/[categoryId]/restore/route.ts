import { categoryStateInput } from "@packages/shared/categories";
import { restoreCategory } from "@/lib/server/categories";
import { walletWrite } from "@/lib/server/wallet-route";

/** Brings an archived wallet category back; a subcategory needs its parent active. */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/categories/[categoryId]/restore">) {
  const { id, categoryId } = await ctx.params;
  return walletWrite(request, categoryStateInput, (actor, input) => restoreCategory(actor, id, categoryId, input));
}
