import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { homeLayouts } from "@packages/shared/db/schema";
import {
  DEFAULT_HOME_LAYOUT,
  insightMonths,
  readHomeLayout,
  type HomeInsights,
  type HomeInsightsQuery,
  type HomeLayout,
  type SaveHomeLayoutInput,
} from "@packages/shared/home";
import { deterministicId } from "@packages/shared/ids";
import { monthRange } from "@packages/shared/transactions";
import { requireRole, runCommand, type CommandResult } from "@/lib/server/commands";
import { selectStatementTotals } from "@/lib/server/entry-queries";

/**
 * Customizable Home (wiki/decisoes/0019). The layout is each member's own
 * preference: any member, readers included, may change theirs. It is not a
 * wallet change, so it skips `recordMutation` and the audit log on purpose.
 */

const layoutId = (userId: string, walletId: string) => deterministicId("home_layout", userId, walletId);

export async function getHomeLayout(userId: string, walletId: string): Promise<CommandResult<HomeLayout>> {
  return runCommand(async (tx) => {
    await requireRole(tx, walletId, userId, "view");
    const [row] = await tx
      .select({ widgets: homeLayouts.widgets })
      .from(homeLayouts)
      .where(and(eq(homeLayouts.userId, userId), eq(homeLayouts.walletId, walletId)))
      .limit(1);
    return row ? { widgets: readHomeLayout(row.widgets), customized: true } : { widgets: DEFAULT_HOME_LAYOUT, customized: false };
  });
}

/** Replaces the layout; `widgets: null` deletes it, back to the default. Last write wins. */
export async function saveHomeLayout(userId: string, walletId: string, input: SaveHomeLayoutInput): Promise<CommandResult<HomeLayout>> {
  return runCommand(async (tx) => {
    await requireRole(tx, walletId, userId, "view");
    if (input.widgets === null) {
      await tx.delete(homeLayouts).where(and(eq(homeLayouts.userId, userId), eq(homeLayouts.walletId, walletId)));
      return { widgets: DEFAULT_HOME_LAYOUT, customized: false };
    }
    await tx
      .insert(homeLayouts)
      .values({ id: layoutId(userId, walletId), userId, walletId, widgets: input.widgets })
      .onConflictDoUpdate({ target: [homeLayouts.userId, homeLayouts.walletId], set: { widgets: input.widgets, updatedAt: sql`now()` } });
    return { widgets: input.widgets, customized: true };
  });
}

/**
 * Month by month figures for the Home charts, with the Statement's own query
 * so the numbers always match it: income and expense of each month, and the
 * balance at its last day, confirmed and projected.
 */
export async function homeInsights(userId: string, walletId: string, query: HomeInsightsQuery): Promise<CommandResult<HomeInsights>> {
  return runCommand(async (tx) => {
    await requireRole(tx, walletId, userId, "view");
    const months = [];
    for (const month of insightMonths(query.month, query.months)) {
      const [row] = await selectStatementTotals(tx, walletId, monthRange(month));
      const balanceMinor = Number(row.confirmedBalanceMinor);
      months.push({
        month,
        incomeMinor: Number(row.incomeMinor),
        expenseMinor: Number(row.expenseMinor),
        balanceMinor,
        projectedMinor: balanceMinor + Number(row.accumulatedPendingMinor),
      });
    }
    return { month: query.month, months };
  });
}
