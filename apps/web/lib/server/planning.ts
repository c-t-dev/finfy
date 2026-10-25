import "server-only";
import { and, asc, eq, gte, inArray, isNotNull, isNull, lte, ne, or, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { budgetItems, budgets, categories, goalDeposits, goals, transactions } from "@packages/shared/db/schema";
import { deterministicId } from "@packages/shared/ids";
import type {
  BudgetMonth,
  CopyBudgetInput,
  CreateDepositInput,
  CreateGoalInput,
  Deposit,
  Goal,
  GoalDetail,
  GoalStateInput,
  RemoveBudgetItemInput,
  SetBudgetItemInput,
  UpdateGoalInput,
} from "@packages/shared/planning";
import { addMonths, monthRange } from "@packages/shared/transactions";
import { usableCategory } from "@/lib/server/categories";
import { CommandError, requireRole, runCommand, type CommandResult } from "@/lib/server/commands";
import { diff, findApplied, recordMutation, type Actor, type Change, type Tx } from "@/lib/server/write";

/**
 * Budgets and goals (wiki/finfy/data-model.md, "Planning"). Budget limits are
 * free values: the last write wins. Goal targets and deposits are money, but
 * nothing else depends on them, so they follow the same rule.
 */

const now = sql`now()`;
const bump = (version: AnyPgColumn) => sql`${version} + 1`;

async function applied(tx: Tx, actor: Actor, mutationId: string): Promise<boolean> {
  const state = await findApplied(tx, mutationId, actor.userId);
  if (state === "foreign") throw new CommandError("invalidInput");
  return state === "applied";
}

// ---------- Budget ----------

/** The wallet's single budget; its ID is deterministic, so devices agree on it. */
const budgetId = (walletId: string) => deterministicId("budget", walletId);
const itemId = (walletId: string, categoryId: string, year: number, month: number) =>
  deterministicId("budget_item", budgetId(walletId), categoryId, String(year), String(month));
const parseMonth = (month: string) => month.split("-").map(Number) as [number, number];

async function ensureBudget(tx: Tx, actor: Actor, walletId: string, extra: Change[]): Promise<string> {
  const id = budgetId(walletId);
  const [existing] = await tx.select({ id: budgets.id }).from(budgets).where(eq(budgets.id, id)).limit(1);
  if (!existing) {
    await tx.insert(budgets).values({ id, walletId, name: "Main", createdBy: actor.userId, updatedBy: actor.userId });
    extra.push({ walletId, entity: "budgets", entityId: id, op: "CREATE", action: "CREATE", changes: diff({}, { name: "Main" }) });
  }
  return id;
}

/** Spending of a month per top-level category: paid expenses plus card purchases. */
async function spendingByTopCategory(tx: Tx, walletId: string, month: string): Promise<Map<string, number>> {
  const { from, to } = monthRange(month);
  const top = sql<string>`coalesce(${categories.parentId}, ${categories.id})`;
  const rows = await tx
    .select({ categoryId: top, total: sql<string>`sum(${transactions.amountMinor})` })
    .from(transactions)
    .innerJoin(categories, eq(categories.id, transactions.categoryId))
    .where(
      and(
        eq(transactions.walletId, walletId),
        isNull(transactions.archivedAt),
        gte(transactions.transactionDate, from),
        lte(transactions.transactionDate, to),
        or(
          and(eq(transactions.type, "EXPENSE"), eq(transactions.status, "PAID")),
          and(eq(transactions.type, "CREDIT_CARD_PURCHASE"), ne(transactions.status, "CANCELED")),
        ),
      ),
    )
    .groupBy(top);
  return new Map(rows.map((row) => [row.categoryId, Number(row.total)]));
}

async function budgetMonth(tx: Tx, walletId: string, month: string): Promise<BudgetMonth> {
  const [year, monthNumber] = parseMonth(month);
  const rows = await tx
    .select()
    .from(budgetItems)
    .where(
      and(
        eq(budgetItems.budgetId, budgetId(walletId)),
        eq(budgetItems.year, year),
        eq(budgetItems.month, monthNumber),
        isNull(budgetItems.archivedAt),
      ),
    );
  const spending = await spendingByTopCategory(tx, walletId, month);
  const budgeted = new Set(rows.map((row) => row.categoryId));
  let unbudgeted = 0;
  for (const [categoryId, total] of spending) if (!budgeted.has(categoryId)) unbudgeted += total;
  return {
    month,
    items: rows.map((row) => ({
      id: row.id,
      categoryId: row.categoryId,
      amountMinor: row.amountMinor,
      alertPercentage: row.alertPercentage,
      spentMinor: spending.get(row.categoryId) ?? 0,
      version: row.version,
    })),
    unbudgetedSpentMinor: unbudgeted,
  };
}

export async function getBudgetMonth(userId: string, walletId: string, month: string): Promise<CommandResult<BudgetMonth>> {
  return runCommand(async (tx) => {
    await requireRole(tx, walletId, userId, "view");
    return budgetMonth(tx, walletId, month);
  });
}

/** Creates, updates or restores one limit; returns its audit change, if anything changed. */
async function putItem(
  tx: Tx,
  actor: Actor,
  walletId: string,
  month: string,
  categoryId: string,
  amountMinor: number,
  alertPercentage: number | null,
  extra: Change[],
): Promise<Change | null> {
  const category = await usableCategory(tx, walletId, categoryId);
  // Limits are per top-level expense category; subcategories count inside their parent.
  if (category.parentId !== null || category.kind === "INCOME") throw new CommandError("invalidInput");
  const budget = await ensureBudget(tx, actor, walletId, extra);
  const [year, monthNumber] = parseMonth(month);
  const id = itemId(walletId, categoryId, year, monthNumber);
  const [existing] = await tx.select().from(budgetItems).where(eq(budgetItems.id, id)).for("update").limit(1);
  if (!existing) {
    await tx.insert(budgetItems).values({
      id,
      walletId,
      budgetId: budget,
      categoryId,
      year,
      month: monthNumber,
      amountMinor,
      alertPercentage,
      createdBy: actor.userId,
      updatedBy: actor.userId,
    });
    return {
      walletId,
      entity: "budget_items",
      entityId: id,
      op: "CREATE",
      action: "CREATE",
      changes: diff({}, { category_id: categoryId, month, amount_minor: amountMinor, alert_percentage: alertPercentage ?? undefined }),
    };
  }
  const changes = diff(
    { amount_minor: existing.amountMinor, alert_percentage: existing.alertPercentage, archived: existing.archivedAt !== null },
    { amount_minor: amountMinor, alert_percentage: alertPercentage, archived: false },
  );
  if (!Object.keys(changes).length) return null;
  await tx
    .update(budgetItems)
    .set({ amountMinor, alertPercentage, archivedAt: null, archivedBy: null, version: bump(budgetItems.version), updatedAt: now, updatedBy: actor.userId })
    .where(eq(budgetItems.id, id));
  return {
    walletId,
    entity: "budget_items",
    entityId: id,
    op: existing.archivedAt ? "RESTORE" : "UPDATE",
    action: existing.archivedAt ? "RESTORE" : "UPDATE",
    changes,
  };
}

async function finish(tx: Tx, actor: Actor, mutationId: string, changes: Change[]): Promise<void> {
  if (!changes.length) return;
  const [first, ...rest] = changes;
  await recordMutation(tx, actor, { mutationId }, first, rest);
}

export async function setBudgetItem(actor: Actor, walletId: string, month: string, input: SetBudgetItemInput): Promise<CommandResult<BudgetMonth>> {
  return runCommand(async (tx) => {
    if (!(await applied(tx, actor, input.mutationId))) {
      await requireRole(tx, walletId, actor.userId, "editEntries");
      const extra: Change[] = [];
      const change = await putItem(tx, actor, walletId, month, input.categoryId, input.amountMinor, input.alertPercentage ?? null, extra);
      await finish(tx, actor, input.mutationId, [...(change ? [change] : []), ...extra]);
    } else {
      await requireRole(tx, walletId, actor.userId, "view");
    }
    return budgetMonth(tx, walletId, month);
  });
}

export async function removeBudgetItem(actor: Actor, walletId: string, month: string, input: RemoveBudgetItemInput): Promise<CommandResult<BudgetMonth>> {
  return runCommand(async (tx) => {
    if (!(await applied(tx, actor, input.mutationId))) {
      await requireRole(tx, walletId, actor.userId, "deleteEntries");
      const [year, monthNumber] = parseMonth(month);
      const id = itemId(walletId, input.categoryId, year, monthNumber);
      const archived = await tx
        .update(budgetItems)
        .set({ archivedAt: now, archivedBy: actor.userId, version: bump(budgetItems.version), updatedAt: now, updatedBy: actor.userId })
        .where(and(eq(budgetItems.id, id), eq(budgetItems.walletId, walletId), isNull(budgetItems.archivedAt)))
        .returning({ id: budgetItems.id });
      if (!archived.length) throw new CommandError("notFound");
      await finish(tx, actor, input.mutationId, [
        { walletId, entity: "budget_items", entityId: id, op: "ARCHIVE", action: "ARCHIVE", changes: diff({ archived: false }, { archived: true }) },
      ]);
    } else {
      await requireRole(tx, walletId, actor.userId, "view");
    }
    return budgetMonth(tx, walletId, month);
  });
}

/** Copies last month's limits; limits already set this month stay as they are. */
export async function copyPreviousBudget(actor: Actor, walletId: string, month: string, input: CopyBudgetInput): Promise<CommandResult<BudgetMonth>> {
  return runCommand(async (tx) => {
    if (!(await applied(tx, actor, input.mutationId))) {
      await requireRole(tx, walletId, actor.userId, "editEntries");
      const previous = await budgetMonth(tx, walletId, addMonths(month, -1));
      const current = await budgetMonth(tx, walletId, month);
      const taken = new Set(current.items.map((item) => item.categoryId));
      const extra: Change[] = [];
      const changes: Change[] = [];
      for (const item of previous.items) {
        if (taken.has(item.categoryId)) continue;
        const change = await putItem(tx, actor, walletId, month, item.categoryId, item.amountMinor, item.alertPercentage, extra);
        if (change) changes.push(change);
      }
      await finish(tx, actor, input.mutationId, [...changes, ...extra]);
    } else {
      await requireRole(tx, walletId, actor.userId, "view");
    }
    return budgetMonth(tx, walletId, month);
  });
}

// ---------- Goals ----------

type GoalRow = typeof goals.$inferSelect;

async function savedByGoal(tx: Tx, goalIds: string[]): Promise<Map<string, number>> {
  if (!goalIds.length) return new Map();
  const rows = await tx
    .select({ goalId: goalDeposits.goalId, total: sql<string>`sum(${goalDeposits.amountMinor})` })
    .from(goalDeposits)
    .where(and(inArray(goalDeposits.goalId, goalIds), isNull(goalDeposits.archivedAt)))
    .groupBy(goalDeposits.goalId);
  return new Map(rows.map((row) => [row.goalId, Number(row.total)]));
}

function toGoal(row: GoalRow, deposits: number): Goal {
  return {
    id: row.id,
    name: row.name,
    template: row.template,
    targetMinor: row.targetMinor,
    initialMinor: row.initialMinor,
    savedMinor: row.initialMinor + deposits,
    deadline: row.deadline,
    achieved: row.achievedAt !== null,
    archived: row.archivedAt !== null,
    version: row.version,
  };
}

export async function listGoals(userId: string, walletId: string, archived: boolean): Promise<CommandResult<Goal[]>> {
  return runCommand(async (tx) => {
    await requireRole(tx, walletId, userId, "view");
    const rows = await tx
      .select()
      .from(goals)
      .where(and(eq(goals.walletId, walletId), archived ? isNotNull(goals.archivedAt) : isNull(goals.archivedAt)))
      .orderBy(asc(goals.createdAt));
    const saved = await savedByGoal(tx, rows.map((row) => row.id));
    return rows.map((row) => toGoal(row, saved.get(row.id) ?? 0));
  });
}

async function goalDetail(tx: Tx, walletId: string, goalId: string): Promise<GoalDetail> {
  const [row] = await tx.select().from(goals).where(and(eq(goals.walletId, walletId), eq(goals.id, goalId))).limit(1);
  if (!row) throw new CommandError("notFound");
  const deposits = await tx
    .select()
    .from(goalDeposits)
    .where(and(eq(goalDeposits.goalId, goalId), isNull(goalDeposits.archivedAt)))
    .orderBy(asc(goalDeposits.depositDate), asc(goalDeposits.createdAt));
  const total = deposits.reduce((sum, deposit) => sum + deposit.amountMinor, 0);
  return {
    goal: toGoal(row, total),
    deposits: deposits.map<Deposit>((deposit) => ({
      id: deposit.id,
      amountMinor: deposit.amountMinor,
      depositDate: deposit.depositDate,
      notes: deposit.notes,
    })),
  };
}

export async function getGoal(userId: string, walletId: string, goalId: string): Promise<CommandResult<GoalDetail>> {
  return runCommand(async (tx) => {
    await requireRole(tx, walletId, userId, "view");
    return goalDetail(tx, walletId, goalId);
  });
}

/** Marks the goal achieved when the saved amount reaches the target, and clears it when it drops below. */
async function refreshAchieved(tx: Tx, actor: Actor, walletId: string, goalId: string): Promise<Change[]> {
  const { goal } = await goalDetail(tx, walletId, goalId);
  const reached = goal.savedMinor >= goal.targetMinor;
  if (reached === goal.achieved) return [];
  await tx
    .update(goals)
    .set({ achievedAt: reached ? now : null, version: bump(goals.version), updatedAt: now, updatedBy: actor.userId })
    .where(eq(goals.id, goalId));
  return [{ walletId, entity: "goals", entityId: goalId, op: "UPDATE", action: reached ? "GOAL_ACHIEVED" : "UPDATE", changes: diff({ achieved: !reached }, { achieved: reached }) }];
}

async function loadGoal(tx: Tx, walletId: string, goalId: string, archived = false): Promise<GoalRow> {
  const [row] = await tx
    .select()
    .from(goals)
    .where(and(eq(goals.walletId, walletId), eq(goals.id, goalId), archived ? isNotNull(goals.archivedAt) : isNull(goals.archivedAt)))
    .for("update")
    .limit(1);
  if (!row) throw new CommandError("notFound");
  return row;
}

export async function createGoal(actor: Actor, walletId: string, input: CreateGoalInput): Promise<CommandResult<GoalDetail>> {
  return runCommand(async (tx) => {
    if (await applied(tx, actor, input.mutationId)) {
      await requireRole(tx, walletId, actor.userId, "view");
      return goalDetail(tx, walletId, input.id);
    }
    await requireRole(tx, walletId, actor.userId, "editEntries");
    const [taken] = await tx.select({ id: goals.id }).from(goals).where(eq(goals.id, input.id)).limit(1);
    if (taken) throw new CommandError("invalidInput");
    await tx.insert(goals).values({
      id: input.id,
      walletId,
      name: input.name,
      template: input.template,
      targetMinor: input.targetMinor,
      initialMinor: input.initialMinor,
      deadline: input.deadline,
      createdBy: actor.userId,
      updatedBy: actor.userId,
    });
    const extra = await refreshAchieved(tx, actor, walletId, input.id);
    await recordMutation(
      tx,
      actor,
      { mutationId: input.mutationId },
      {
        walletId,
        entity: "goals",
        entityId: input.id,
        op: "CREATE",
        action: "CREATE",
        changes: diff({}, { name: input.name, template: input.template, target_minor: input.targetMinor, initial_minor: input.initialMinor, deadline: input.deadline ?? undefined }),
      },
      extra,
    );
    return goalDetail(tx, walletId, input.id);
  });
}

export async function updateGoal(actor: Actor, walletId: string, goalId: string, input: UpdateGoalInput): Promise<CommandResult<GoalDetail>> {
  return runCommand(async (tx) => {
    if (await applied(tx, actor, input.mutationId)) {
      await requireRole(tx, walletId, actor.userId, "view");
      return goalDetail(tx, walletId, goalId);
    }
    await requireRole(tx, walletId, actor.userId, "editEntries");
    const row = await loadGoal(tx, walletId, goalId);
    const changes = diff(
      { name: row.name, template: row.template, target_minor: row.targetMinor, initial_minor: row.initialMinor, deadline: row.deadline },
      { name: input.name, template: input.template, target_minor: input.targetMinor, initial_minor: input.initialMinor, deadline: input.deadline },
    );
    if (!Object.keys(changes).length) return goalDetail(tx, walletId, goalId);
    const { mutationId: _, baseVersion: __, ...values } = input;
    await tx.update(goals).set({ ...values, version: bump(goals.version), updatedAt: now, updatedBy: actor.userId }).where(eq(goals.id, goalId));
    const extra = await refreshAchieved(tx, actor, walletId, goalId);
    await recordMutation(
      tx,
      actor,
      { mutationId: input.mutationId, baseVersion: input.baseVersion },
      { walletId, entity: "goals", entityId: goalId, op: "UPDATE", action: "UPDATE", changes },
      extra,
    );
    return goalDetail(tx, walletId, goalId);
  });
}

export async function setGoalArchived(
  actor: Actor,
  walletId: string,
  goalId: string,
  archived: boolean,
  input: GoalStateInput,
): Promise<CommandResult<GoalDetail>> {
  return runCommand(async (tx) => {
    if (!(await applied(tx, actor, input.mutationId))) {
      await requireRole(tx, walletId, actor.userId, archived ? "deleteEntries" : "editEntries");
      await loadGoal(tx, walletId, goalId, !archived);
      await tx
        .update(goals)
        .set({ archivedAt: archived ? now : null, archivedBy: archived ? actor.userId : null, version: bump(goals.version), updatedAt: now, updatedBy: actor.userId })
        .where(eq(goals.id, goalId));
      await recordMutation(
        tx,
        actor,
        { mutationId: input.mutationId, baseVersion: input.baseVersion },
        {
          walletId,
          entity: "goals",
          entityId: goalId,
          op: archived ? "ARCHIVE" : "RESTORE",
          action: archived ? "ARCHIVE" : "RESTORE",
          changes: diff({ archived: !archived }, { archived }),
        },
      );
    } else {
      await requireRole(tx, walletId, actor.userId, "view");
    }
    return goalDetail(tx, walletId, goalId);
  });
}

export async function createDeposit(actor: Actor, walletId: string, goalId: string, input: CreateDepositInput): Promise<CommandResult<GoalDetail>> {
  return runCommand(async (tx) => {
    if (!(await applied(tx, actor, input.mutationId))) {
      await requireRole(tx, walletId, actor.userId, "editEntries");
      await loadGoal(tx, walletId, goalId);
      const [taken] = await tx.select({ id: goalDeposits.id }).from(goalDeposits).where(eq(goalDeposits.id, input.id)).limit(1);
      if (taken) throw new CommandError("invalidInput");
      await tx.insert(goalDeposits).values({
        id: input.id,
        walletId,
        goalId,
        amountMinor: input.amountMinor,
        depositDate: input.depositDate,
        notes: input.notes ?? null,
        createdBy: actor.userId,
        updatedBy: actor.userId,
      });
      const extra = await refreshAchieved(tx, actor, walletId, goalId);
      await recordMutation(
        tx,
        actor,
        { mutationId: input.mutationId },
        {
          walletId,
          entity: "goal_deposits",
          entityId: input.id,
          op: "CREATE",
          action: "CREATE",
          changes: diff({}, { goal_id: goalId, amount_minor: input.amountMinor, deposit_date: input.depositDate }),
        },
        extra,
      );
    } else {
      await requireRole(tx, walletId, actor.userId, "view");
    }
    return goalDetail(tx, walletId, goalId);
  });
}

export async function archiveDeposit(
  actor: Actor,
  walletId: string,
  goalId: string,
  depositId: string,
  input: { mutationId: string },
): Promise<CommandResult<GoalDetail>> {
  return runCommand(async (tx) => {
    if (!(await applied(tx, actor, input.mutationId))) {
      await requireRole(tx, walletId, actor.userId, "deleteEntries");
      const archived = await tx
        .update(goalDeposits)
        .set({ archivedAt: now, archivedBy: actor.userId, version: bump(goalDeposits.version), updatedAt: now, updatedBy: actor.userId })
        .where(and(eq(goalDeposits.id, depositId), eq(goalDeposits.goalId, goalId), eq(goalDeposits.walletId, walletId), isNull(goalDeposits.archivedAt)))
        .returning({ id: goalDeposits.id });
      if (!archived.length) throw new CommandError("notFound");
      const extra = await refreshAchieved(tx, actor, walletId, goalId);
      await recordMutation(
        tx,
        actor,
        { mutationId: input.mutationId },
        { walletId, entity: "goal_deposits", entityId: depositId, op: "ARCHIVE", action: "ARCHIVE", changes: diff({ archived: false }, { archived: true }) },
        extra,
      );
    } else {
      await requireRole(tx, walletId, actor.userId, "view");
    }
    return goalDetail(tx, walletId, goalId);
  });
}
