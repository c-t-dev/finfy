import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { accounts, creditCards, homeLayouts, recurrences } from "@packages/shared/db/schema";
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
import { addDays, RECURRENCE_HORIZON_DAYS } from "@packages/shared/recurrences";
import { monthRange } from "@packages/shared/transactions";
import { requireRole, runCommand, type CommandResult } from "@/lib/server/commands";
import { selectStatementTotals } from "@/lib/server/entry-queries";
import { forecastEntries } from "@/lib/server/forecast";
import type { Tx } from "@/lib/server/write";

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

/** Simulated occurrences of the wallet's active recurrences after the stored horizon, through `until`. */
async function forecast(tx: Tx, walletId: string, until: string) {
  const [rows, cards, activeAccounts] = await Promise.all([
    tx.select().from(recurrences).where(and(eq(recurrences.walletId, walletId), isNull(recurrences.archivedAt))),
    tx.select().from(creditCards).where(and(eq(creditCards.walletId, walletId), isNull(creditCards.archivedAt))),
    tx.select({ id: accounts.id }).from(accounts).where(and(eq(accounts.walletId, walletId), isNull(accounts.archivedAt))),
  ]);
  // Same horizon as the recurrence top-up: up to it the occurrences are real entries.
  const horizon = addDays(new Date().toISOString().slice(0, 10), RECURRENCE_HORIZON_DAYS);
  return forecastEntries(rows, cards, new Set(activeAccounts.map((account) => account.id)), horizon, until);
}

/**
 * Month by month figures for the Home charts, with the Statement's own query
 * so the numbers always match it: income, expense and pending amounts of each
 * month, and the balance at its last day, confirmed and projected. Months past
 * the recurrence horizon add simulated occurrences (`forecast*`).
 */
export async function homeInsights(userId: string, walletId: string, query: HomeInsightsQuery): Promise<CommandResult<HomeInsights>> {
  return runCommand(async (tx) => {
    await requireRole(tx, walletId, userId, "view");
    const list = insightMonths(query.month, query.months, query.ahead);
    const simulated = await forecast(tx, walletId, monthRange(list.at(-1)!).to);
    const months = [];
    for (const month of list) {
      const { from, to } = monthRange(month);
      const [row] = await selectStatementTotals(tx, walletId, { from, to });
      const inMonth = simulated.filter((entry) => entry.date >= from && entry.date <= to);
      const sum = (type: "INCOME" | "EXPENSE") => inMonth.reduce((total, entry) => total + (entry.type === type ? entry.amountMinor : 0), 0);
      // The projected balance carries every simulated movement up to the month's last day.
      const forecastCash = simulated
        .filter((entry) => entry.affectsBalance && entry.date <= to)
        .reduce((total, entry) => total + (entry.type === "INCOME" ? entry.amountMinor : -entry.amountMinor), 0);
      const balanceMinor = Number(row.confirmedBalanceMinor);
      months.push({
        month,
        incomeMinor: Number(row.incomeMinor),
        expenseMinor: Number(row.expenseMinor),
        pendingIncomeMinor: Number(row.pendingIncomeMinor),
        pendingExpenseMinor: Number(row.pendingExpenseMinor),
        forecastIncomeMinor: sum("INCOME"),
        forecastExpenseMinor: sum("EXPENSE"),
        balanceMinor,
        projectedMinor: balanceMinor + Number(row.accumulatedPendingMinor) + forecastCash,
      });
    }
    return { month: query.month, months };
  });
}
