import { sql } from "drizzle-orm";
import { check, date, index, integer, pgTable, smallint, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { ASSET_KINDS, ASSET_TYPES, FULL_BPS, GOAL_TEMPLATES } from "../../finance";
import { bigintNumber, enumCheck, syncedColumns, textEnum, timestamptz } from "../columns";
import { categories, sameWallet, transactions, walletIdColumn, walletScoped } from "./finance";

/** Budgets, goals and patrimony (wiki/finfy/data-model.md). All synced. */

export const budgets = pgTable(
  "budgets",
  {
    ...syncedColumns(),
    walletId: walletIdColumn(),
    name: text("name").notNull(),
  },
  (t) => [walletScoped("budgets", t)],
);

/**
 * One limit per budget, category and month. `id` is UUIDv5 of the four, so two
 * offline devices setting the same limit edit the same row.
 */
export const budgetItems = pgTable(
  "budget_items",
  {
    ...syncedColumns(),
    walletId: walletIdColumn(),
    budgetId: uuid("budget_id").notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
    year: smallint("year").notNull(),
    month: smallint("month").notNull(),
    amountMinor: bigintNumber("amount_minor").notNull(),
    /** Notify when spending reaches this share of the limit. */
    alertPercentage: smallint("alert_percentage"),
  },
  (t) => [
    sameWallet("budget_items_budget_fk", t, t.budgetId, budgets),
    uniqueIndex("budget_items_unique").on(t.budgetId, t.categoryId, t.year, t.month),
    index("budget_items_wallet_month_idx").on(t.walletId, t.year, t.month),
    check("budget_items_month_check", sql`${t.month} between 1 and 12`),
    check("budget_items_amount_check", sql`${t.amountMinor} >= 0`),
    check("budget_items_alert_check", sql`${t.alertPercentage} is null or ${t.alertPercentage} between 1 and 100`),
  ],
);

/** The saved amount is derived from the deposits. A return rate, when set, is used in the projection. */
export const goals = pgTable(
  "goals",
  {
    ...syncedColumns(),
    walletId: walletIdColumn(),
    name: text("name").notNull(),
    template: textEnum("template", GOAL_TEMPLATES).notNull().default("OTHER"),
    targetMinor: bigintNumber("target_minor").notNull(),
    initialMinor: bigintNumber("initial_minor").notNull().default(0),
    deadline: date("deadline", { mode: "string" }),
    expectedAnnualReturnBps: integer("expected_annual_return_bps"),
    achievedAt: timestamptz("achieved_at"),
  },
  (t) => [
    walletScoped("goals", t),
    enumCheck("goals_template_check", t.template, GOAL_TEMPLATES),
    check("goals_amounts_check", sql`${t.targetMinor} > 0 and ${t.initialMinor} >= 0`),
  ],
);

/** Positive adds to the goal, negative withdraws. Optionally tied to the transaction that moved the money. */
export const goalDeposits = pgTable(
  "goal_deposits",
  {
    ...syncedColumns(),
    walletId: walletIdColumn(),
    goalId: uuid("goal_id").notNull(),
    amountMinor: bigintNumber("amount_minor").notNull(),
    depositDate: date("deposit_date", { mode: "string" }).notNull(),
    notes: text("notes"),
    transactionId: uuid("transaction_id"),
  },
  (t) => [
    sameWallet("goal_deposits_goal_fk", t, t.goalId, goals),
    sameWallet("goal_deposits_transaction_fk", t, t.transactionId, transactions),
    index("goal_deposits_goal_idx").on(t.goalId),
    check("goal_deposits_amount_check", sql`${t.amountMinor} <> 0`),
  ],
);

/** Net worth = account balances + assets − liabilities − unpaid card purchases. */
export const assets = pgTable(
  "assets",
  {
    ...syncedColumns(),
    walletId: walletIdColumn(),
    kind: textEnum("kind", ASSET_KINDS).notNull(),
    type: textEnum("type", ASSET_TYPES).notNull(),
    name: text("name").notNull(),
    currentValueMinor: bigintNumber("current_value_minor").notNull(),
    purchaseValueMinor: bigintNumber("purchase_value_minor"),
    purchaseDate: date("purchase_date", { mode: "string" }),
    /** Share owned, in basis points (10000 = 100%). */
    ownershipBps: integer("ownership_bps").notNull().default(FULL_BPS),
    notes: text("notes"),
  },
  (t) => [
    walletScoped("assets", t),
    enumCheck("assets_kind_check", t.kind, ASSET_KINDS),
    enumCheck("assets_type_check", t.type, ASSET_TYPES),
    check("assets_value_check", sql`${t.currentValueMinor} >= 0`),
    check("assets_ownership_check", sql`${t.ownershipBps} between 1 and ${sql.raw(String(FULL_BPS))}`),
  ],
);

/** Links an asset to the loan or financing that paid for it. */
export const assetLiabilities = pgTable(
  "asset_liabilities",
  {
    ...syncedColumns(),
    walletId: walletIdColumn(),
    assetId: uuid("asset_id").notNull(),
    liabilityId: uuid("liability_id").notNull(),
  },
  (t) => [
    sameWallet("asset_liabilities_asset_fk", t, t.assetId, assets),
    sameWallet("asset_liabilities_liability_fk", t, t.liabilityId, assets),
    uniqueIndex("asset_liabilities_unique").on(t.assetId, t.liabilityId),
    check("asset_liabilities_distinct_check", sql`${t.assetId} <> ${t.liabilityId}`),
  ],
);
