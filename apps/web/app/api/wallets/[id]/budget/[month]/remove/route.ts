import { MONTH_PATTERN, removeBudgetItemInput } from "@packages/shared/planning";
import { removeBudgetItem } from "@/lib/server/planning";
import { apiError } from "@/lib/server/request";
import { walletWrite } from "@/lib/server/wallet-route";

/** Removes a category's limit from the month (OWNER, ADMIN, EDITOR). */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/budget/[month]/remove">) {
  const { id, month } = await ctx.params;
  if (!MONTH_PATTERN.test(month)) return apiError("invalidInput", 400);
  return walletWrite(request, removeBudgetItemInput, (actor, input) => removeBudgetItem(actor, id, month, input));
}
