import "server-only";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { categorizationRules, categories, tags, transactions } from "@packages/shared/db/schema";
import {
  resolveRules,
  ruleMatches,
  type CreateRuleInput,
  type PreviewRuleInput,
  type Rule,
  type RuleAction,
  type RuleCondition,
  type RulePreview,
  type UpdateRuleInput,
} from "@packages/shared/rules";
import { CommandError, requireRole, runCommand, type CommandResult } from "@/lib/server/commands";
import { applyTags, tagsByEntry } from "@/lib/server/tags";
import { diff, findApplied, recordMutation, type Actor, type Change, type Tx } from "@/lib/server/write";

/**
 * Categorization rules (wiki/finfy/data-model.md). Matching is the pure
 * `ruleMatches`/`resolveRules`. Rules never touch transfers, payments or
 * adjustments, and only run on history when the user asks (on save with
 * "apply to history", or "Apply now"); every change is audited with source
 * RULE and the rule's ID.
 */

type RuleRow = typeof categorizationRules.$inferSelect;
const now = sql`now()`;
const ELIGIBLE = ["INCOME", "EXPENSE", "CREDIT_CARD_PURCHASE"] as const;

const toRule = (row: RuleRow): Rule => ({
  id: row.id,
  name: row.name,
  priority: row.priority,
  isActive: row.isActive,
  applyToHistory: row.applyToHistory,
  conditions: row.conditions as Rule["conditions"],
  actions: row.actions as Rule["actions"],
  version: row.version,
});

async function applied(tx: Tx, actor: Actor, mutationId: string): Promise<boolean> {
  const state = await findApplied(tx, mutationId, actor.userId);
  if (state === "foreign") throw new CommandError("invalidInput");
  return state === "applied";
}

/** Accounts, cards, categories and tags in a rule must belong to the wallet. */
async function checkRule(tx: Tx, walletId: string, conditions: RuleCondition[], actions: RuleAction[]) {
  for (const action of actions) {
    if (action.set === "category") {
      const [row] = await tx
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.id, action.categoryId), isNull(categories.archivedAt), sql`(${categories.walletId} is null or ${categories.walletId} = ${walletId})`))
        .limit(1);
      if (!row) throw new CommandError("invalidInput");
    } else {
      const [row] = await tx.select({ id: tags.id }).from(tags).where(and(eq(tags.id, action.tagId), eq(tags.walletId, walletId), isNull(tags.archivedAt))).limit(1);
      if (!row) throw new CommandError("invalidInput");
    }
  }
  for (const condition of conditions) {
    if (condition.field === "account" || condition.field === "card") {
      const id = condition.field === "account" ? condition.accountId : condition.creditCardId;
      const table = condition.field === "account" ? sql`accounts` : sql`credit_cards`;
      const [row] = await tx.execute<{ id: string }>(sql`select id from ${table} where id = ${id} and wallet_id = ${walletId} limit 1`);
      if (!row) throw new CommandError("invalidInput");
    }
    if (condition.field === "amount" && condition.min !== undefined && condition.max !== undefined && condition.min > condition.max) {
      throw new CommandError("invalidInput");
    }
  }
}

/** Active entries rules may touch, newest first. */
async function candidates(tx: Tx, walletId: string) {
  return tx
    .select({
      id: transactions.id,
      type: transactions.type,
      description: transactions.description,
      amountMinor: transactions.amountMinor,
      accountId: transactions.accountId,
      creditCardId: transactions.creditCardId,
      categoryId: transactions.categoryId,
      transactionDate: transactions.transactionDate,
    })
    .from(transactions)
    .where(and(eq(transactions.walletId, walletId), isNull(transactions.archivedAt), inArray(transactions.type, [...ELIGIBLE])))
    .orderBy(desc(transactions.transactionDate), desc(transactions.createdAt));
}

export async function listRules(userId: string, walletId: string): Promise<CommandResult<Rule[]>> {
  return runCommand(async (tx) => {
    await requireRole(tx, walletId, userId, "view");
    const rows = await tx
      .select()
      .from(categorizationRules)
      .where(and(eq(categorizationRules.walletId, walletId), isNull(categorizationRules.archivedAt)))
      .orderBy(asc(categorizationRules.priority), asc(categorizationRules.createdAt));
    return rows.map(toRule);
  });
}

export async function previewRule(userId: string, walletId: string, input: PreviewRuleInput): Promise<CommandResult<RulePreview>> {
  return runCommand(async (tx) => {
    await requireRole(tx, walletId, userId, "view");
    const matching = (await candidates(tx, walletId)).filter((entry) => ruleMatches(entry, input.conditions as RuleCondition[]));
    return {
      count: matching.length,
      sample: matching.slice(0, 5).map(({ id, description, amountMinor, transactionDate }) => ({ id, description, amountMinor, transactionDate })),
    };
  });
}

/**
 * Applies one rule to the existing entries it matches: its category (when it
 * has one and the entry's category is different) and its tags (added to the
 * ones already there). Category fits the entry's direction: an income rule
 * never puts an expense category on an income.
 */
async function applyToHistory(tx: Tx, actor: Actor, walletId: string, row: RuleRow): Promise<{ changed: number; changes: Change[] }> {
  const rule = toRule(row);
  const matching = (await candidates(tx, walletId)).filter((entry) => ruleMatches(entry, rule.conditions));
  if (!matching.length) return { changed: 0, changes: [] };
  const target = resolveRules(matching[0], [{ ...rule, isActive: true }]);
  const [category] = target.categoryId
    ? await tx.select({ kind: categories.kind }).from(categories).where(eq(categories.id, target.categoryId)).limit(1)
    : [];
  const currentTags = await tagsByEntry(tx, matching.map((entry) => entry.id));
  const changes: Change[] = [];
  let changed = 0;
  for (const entry of matching) {
    let touched = false;
    const direction = entry.type === "INCOME" ? "INCOME" : "EXPENSE";
    if (target.categoryId && category && (category.kind === direction || category.kind === "BOTH") && entry.categoryId !== target.categoryId) {
      await tx
        .update(transactions)
        .set({ categoryId: target.categoryId, version: sql`${transactions.version} + 1`, updatedAt: now, updatedBy: actor.userId })
        .where(eq(transactions.id, entry.id));
      changes.push({ walletId, entity: "transactions", entityId: entry.id, op: "UPDATE", action: "UPDATE", changes: diff({ category_id: entry.categoryId }, { category_id: target.categoryId }) });
      touched = true;
    }
    const have = currentTags.get(entry.id) ?? [];
    const missing = target.tagIds.filter((id) => !have.includes(id));
    if (missing.length) {
      changes.push(...(await applyTags(tx, actor, walletId, [entry.id], [...have, ...missing])));
      touched = true;
    }
    if (touched) changed += 1;
  }
  return { changed, changes };
}

async function loadRule(tx: Tx, walletId: string, ruleId: string): Promise<RuleRow> {
  const [row] = await tx
    .select()
    .from(categorizationRules)
    .where(and(eq(categorizationRules.walletId, walletId), eq(categorizationRules.id, ruleId), isNull(categorizationRules.archivedAt)))
    .for("update")
    .limit(1);
  if (!row) throw new CommandError("notFound");
  return row;
}

export async function createRule(actor: Actor, walletId: string, input: CreateRuleInput): Promise<CommandResult<Rule>> {
  return runCommand(async (tx) => {
    if (await applied(tx, actor, input.mutationId)) {
      await requireRole(tx, walletId, actor.userId, "view");
      return toRule(await loadRule(tx, walletId, input.id));
    }
    await requireRole(tx, walletId, actor.userId, "editEntries");
    await checkRule(tx, walletId, input.conditions as RuleCondition[], input.actions as RuleAction[]);
    const [taken] = await tx.select({ id: categorizationRules.id }).from(categorizationRules).where(eq(categorizationRules.id, input.id)).limit(1);
    if (taken) throw new CommandError("invalidInput");
    // New rules go last unless a priority is given.
    const [{ next }] = await tx
      .select({ next: sql<number>`coalesce(max(${categorizationRules.priority}), -1) + 1` })
      .from(categorizationRules)
      .where(and(eq(categorizationRules.walletId, walletId), isNull(categorizationRules.archivedAt)));
    const [row] = await tx
      .insert(categorizationRules)
      .values({
        id: input.id,
        walletId,
        name: input.name,
        priority: input.priority ?? Number(next),
        isActive: input.isActive,
        applyToHistory: input.applyToHistory,
        conditions: input.conditions as RuleCondition[],
        actions: input.actions as RuleAction[],
        createdBy: actor.userId,
        updatedBy: actor.userId,
      })
      .returning();
    const history = input.applyToHistory && input.isActive ? (await applyToHistory(tx, actor, walletId, row)).changes : [];
    await recordMutation(
      tx,
      actor,
      { mutationId: input.mutationId, source: history.length ? "RULE" : "APP", sourceRefId: history.length ? row.id : undefined },
      {
        walletId,
        entity: "categorization_rules",
        entityId: row.id,
        op: "CREATE",
        action: "CREATE",
        changes: diff({}, { name: input.name, priority: row.priority }),
      },
      history,
    );
    return toRule(row);
  });
}

/** Edits; with "apply to history" on, the rule runs again on existing entries (Minhas Economias did not). */
export async function updateRule(actor: Actor, walletId: string, ruleId: string, input: UpdateRuleInput): Promise<CommandResult<Rule>> {
  return runCommand(async (tx) => {
    if (await applied(tx, actor, input.mutationId)) {
      await requireRole(tx, walletId, actor.userId, "view");
      return toRule(await loadRule(tx, walletId, ruleId));
    }
    await requireRole(tx, walletId, actor.userId, "editEntries");
    const row = await loadRule(tx, walletId, ruleId);
    await checkRule(tx, walletId, (input.conditions ?? row.conditions) as RuleCondition[], (input.actions ?? row.actions) as RuleAction[]);
    const [updated] = await tx
      .update(categorizationRules)
      .set({
        name: input.name ?? row.name,
        priority: input.priority ?? row.priority,
        isActive: input.isActive ?? row.isActive,
        applyToHistory: input.applyToHistory ?? row.applyToHistory,
        conditions: (input.conditions ?? row.conditions) as RuleCondition[],
        actions: (input.actions ?? row.actions) as RuleAction[],
        version: sql`${categorizationRules.version} + 1`,
        updatedAt: now,
        updatedBy: actor.userId,
      })
      .where(eq(categorizationRules.id, ruleId))
      .returning();
    const changes = diff(
      { name: row.name, priority: row.priority, is_active: row.isActive, apply_to_history: row.applyToHistory, conditions: JSON.stringify(row.conditions), actions: JSON.stringify(row.actions) },
      {
        name: input.name,
        priority: input.priority,
        is_active: input.isActive,
        apply_to_history: input.applyToHistory,
        conditions: input.conditions ? JSON.stringify(input.conditions) : undefined,
        actions: input.actions ? JSON.stringify(input.actions) : undefined,
      },
    );
    const history = updated.applyToHistory && updated.isActive ? (await applyToHistory(tx, actor, walletId, updated)).changes : [];
    await recordMutation(
      tx,
      actor,
      { mutationId: input.mutationId, source: history.length ? "RULE" : "APP", sourceRefId: history.length ? ruleId : undefined },
      { walletId, entity: "categorization_rules", entityId: ruleId, op: "UPDATE", action: "UPDATE", changes },
      history,
    );
    return toRule(updated);
  });
}

export async function archiveRule(actor: Actor, walletId: string, ruleId: string, mutationId: string): Promise<CommandResult<null>> {
  return runCommand(async (tx) => {
    if (await applied(tx, actor, mutationId)) return null;
    await requireRole(tx, walletId, actor.userId, "deleteEntries");
    await loadRule(tx, walletId, ruleId);
    await tx
      .update(categorizationRules)
      .set({ archivedAt: now, archivedBy: actor.userId, version: sql`${categorizationRules.version} + 1`, updatedAt: now, updatedBy: actor.userId })
      .where(eq(categorizationRules.id, ruleId));
    await recordMutation(tx, actor, { mutationId }, {
      walletId,
      entity: "categorization_rules",
      entityId: ruleId,
      op: "ARCHIVE",
      action: "ARCHIVE",
      changes: diff({ archived: false }, { archived: true }),
    });
    return null;
  });
}

/** "Apply now": runs the rule on existing entries. */
export async function applyRuleNow(actor: Actor, walletId: string, ruleId: string, mutationId: string): Promise<CommandResult<{ changed: number }>> {
  return runCommand(async (tx) => {
    if (await applied(tx, actor, mutationId)) return { changed: 0 };
    await requireRole(tx, walletId, actor.userId, "editEntries");
    const row = await loadRule(tx, walletId, ruleId);
    const { changed, changes } = await applyToHistory(tx, actor, walletId, row);
    if (changes.length) {
      const [first, ...rest] = changes;
      await recordMutation(tx, actor, { mutationId, source: "RULE", sourceRefId: ruleId }, first, rest);
    }
    return { changed };
  });
}
