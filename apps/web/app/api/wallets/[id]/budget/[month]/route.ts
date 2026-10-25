import { MONTH_PATTERN } from "@packages/shared/planning";
import { getBudgetMonth } from "@/lib/server/planning";
import { apiError } from "@/lib/server/request";
import { requireActor, walletRead } from "@/lib/server/wallet-route";

export const dynamic = "force-dynamic";

/** Limits of a month (`YYYY-MM`) with what each category spent. */
export async function GET(_request: Request, ctx: RouteContext<"/api/wallets/[id]/budget/[month]">) {
  const actor = await requireActor();
  if (actor instanceof Response) return actor;
  const { id, month } = await ctx.params;
  if (!MONTH_PATTERN.test(month)) return apiError("invalidInput", 400);
  return walletRead(await getBudgetMonth(actor.userId, id, month));
}
