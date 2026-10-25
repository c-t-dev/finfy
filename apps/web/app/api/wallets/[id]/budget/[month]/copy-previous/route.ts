import { MONTH_PATTERN, copyBudgetInput } from "@packages/shared/planning";
import { copyPreviousBudget } from "@/lib/server/planning";
import { apiError } from "@/lib/server/request";
import { walletWrite } from "@/lib/server/wallet-route";

/** Copies last month's limits, keeping the ones already set (OWNER, ADMIN, EDITOR). */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/budget/[month]/copy-previous">) {
  const { id, month } = await ctx.params;
  if (!MONTH_PATTERN.test(month)) return apiError("invalidInput", 400);
  return walletWrite(request, copyBudgetInput, (actor, input) => copyPreviousBudget(actor, id, month, input));
}
