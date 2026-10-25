import { z } from "zod";
import { GOAL_TEMPLATES } from "./finance";
import { AMOUNT_MAX, isoDate, NOTES_MAX } from "./transactions";

/**
 * Budgets and goals (wiki/finfy/data-model.md, "Planning"). Each wallet has
 * one budget, created on first use; its items are monthly limits per
 * top-level expense category. Goals track a target with manual deposits.
 */

export const GOAL_NAME_MAX = 60;
export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const amount = z.number().int().min(0).max(AMOUNT_MAX);

/** Sets (or replaces) the limit of a category in a month. */
export const setBudgetItemInput = z.object({
  mutationId: z.uuid(),
  categoryId: z.uuid(),
  amountMinor: amount,
  /** Warn when spending reaches this share of the limit. */
  alertPercentage: z.number().int().min(1).max(100).nullable().optional(),
});
export type SetBudgetItemInput = z.infer<typeof setBudgetItemInput>;

export const removeBudgetItemInput = z.object({ mutationId: z.uuid(), categoryId: z.uuid() });
export type RemoveBudgetItemInput = z.infer<typeof removeBudgetItemInput>;

/** Copies last month's limits into this month, keeping limits already set here. */
export const copyBudgetInput = z.object({ mutationId: z.uuid() });
export type CopyBudgetInput = z.infer<typeof copyBudgetInput>;

export const budgetItemSchema = z.object({
  id: z.uuid(),
  categoryId: z.uuid(),
  amountMinor: z.number().int(),
  alertPercentage: z.number().int().nullable(),
  /** Paid expenses and card purchases of the month in the category and its subcategories. */
  spentMinor: z.number().int(),
  version: z.number().int(),
});
export type BudgetItem = z.infer<typeof budgetItemSchema>;

export const budgetMonthSchema = z.object({
  month: z.string(),
  items: z.array(budgetItemSchema),
  /** Expenses of the month in categories without a limit. */
  unbudgetedSpentMinor: z.number().int(),
});
export type BudgetMonth = z.infer<typeof budgetMonthSchema>;

const goalName = z.string().trim().min(1).max(GOAL_NAME_MAX);

export const createGoalInput = z.object({
  id: z.uuid(),
  mutationId: z.uuid(),
  name: goalName,
  template: z.enum(GOAL_TEMPLATES),
  targetMinor: z.number().int().positive().max(AMOUNT_MAX),
  initialMinor: amount,
  deadline: isoDate.nullable(),
});
export type CreateGoalInput = z.infer<typeof createGoalInput>;

export const updateGoalInput = z
  .object({
    mutationId: z.uuid(),
    baseVersion: z.number().int().positive(),
    name: goalName.optional(),
    template: z.enum(GOAL_TEMPLATES).optional(),
    targetMinor: z.number().int().positive().max(AMOUNT_MAX).optional(),
    initialMinor: amount.optional(),
    deadline: isoDate.nullable().optional(),
  })
  .refine((input) => Object.keys(input).some((key) => key !== "mutationId" && key !== "baseVersion"), {
    message: "nothing to change",
  });
export type UpdateGoalInput = z.infer<typeof updateGoalInput>;

export const goalStateInput = z.object({ mutationId: z.uuid(), baseVersion: z.number().int().positive() });
export type GoalStateInput = z.infer<typeof goalStateInput>;

/** Positive adds to the goal, negative takes out. */
export const createDepositInput = z.object({
  id: z.uuid(),
  mutationId: z.uuid(),
  amountMinor: z
    .number()
    .int()
    .min(-AMOUNT_MAX)
    .max(AMOUNT_MAX)
    .refine((value) => value !== 0),
  depositDate: isoDate,
  notes: z.string().trim().max(NOTES_MAX).nullable().optional(),
});
export type CreateDepositInput = z.infer<typeof createDepositInput>;

export const depositStateInput = z.object({ mutationId: z.uuid() });

export const depositSchema = z.object({
  id: z.uuid(),
  amountMinor: z.number().int(),
  depositDate: isoDate,
  notes: z.string().nullable(),
});
export type Deposit = z.infer<typeof depositSchema>;

export const goalSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  template: z.enum(GOAL_TEMPLATES),
  targetMinor: z.number().int(),
  initialMinor: z.number().int(),
  /** Initial amount plus deposits. */
  savedMinor: z.number().int(),
  deadline: isoDate.nullable(),
  achieved: z.boolean(),
  archived: z.boolean(),
  version: z.number().int(),
});
export type Goal = z.infer<typeof goalSchema>;

export const goalListSchema = z.object({ goals: z.array(goalSchema) });
export const goalDetailSchema = z.object({ goal: goalSchema, deposits: z.array(depositSchema) });
export type GoalDetail = z.infer<typeof goalDetailSchema>;

/** Months from `today` until the deadline, counting the current one (at least 1). */
export function monthsUntil(today: string, deadline: string): number {
  const [y1, m1] = today.split("-").map(Number);
  const [y2, m2] = deadline.split("-").map(Number);
  return Math.max(1, (y2 - y1) * 12 + (m2 - m1) + 1);
}

/** What to save per month to reach the target by the deadline, rounded up to the minor unit. */
export function monthlyNeeded(goal: Pick<Goal, "targetMinor" | "savedMinor" | "deadline">, today: string): number | null {
  if (!goal.deadline) return null;
  const missing = goal.targetMinor - goal.savedMinor;
  if (missing <= 0) return 0;
  return Math.ceil(missing / monthsUntil(today, goal.deadline));
}
