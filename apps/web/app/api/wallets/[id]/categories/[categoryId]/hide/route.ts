import { categoryVisibilityInput } from "@packages/shared/categories";
import { setCategoryHidden } from "@/lib/server/categories";
import { walletWrite } from "@/lib/server/wallet-route";

/** Hides a system category in this wallet (OWNER, ADMIN, EDITOR). */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/categories/[categoryId]/hide">) {
  const { id, categoryId } = await ctx.params;
  return walletWrite(request, categoryVisibilityInput, (actor, input) => setCategoryHidden(actor, id, categoryId, true, input));
}
