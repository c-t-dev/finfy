import { MONTH_PATTERN, setBudgetItemInput } from "@packages/shared/planning";
import { setBudgetItem } from "@/lib/server/planning";
import { apiError } from "@/lib/server/request";
import { walletWrite } from "@/lib/server/wallet-route";

/** Sets the limit of a top-level expense category in the month (OWNER, ADMIN, EDITOR). */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/budget/[month]/set">) {
  const { id, month } = await ctx.params;
  if (!MONTH_PATTERN.test(month)) return apiError("invalidInput", 400);
  return walletWrite(request, setBudgetItemInput, (actor, input) => setBudgetItem(actor, id, month, input));
}
