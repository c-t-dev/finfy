import { updateCategoryInput } from "@packages/shared/categories";
import { updateCategory } from "@/lib/server/categories";
import { walletWrite } from "@/lib/server/wallet-route";

/** Edits a wallet category (OWNER, ADMIN, EDITOR); system categories are read-only. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/wallets/[id]/categories/[categoryId]">) {
  const { id, categoryId } = await ctx.params;
  return walletWrite(request, updateCategoryInput, (actor, input) => updateCategory(actor, id, categoryId, input));
}
