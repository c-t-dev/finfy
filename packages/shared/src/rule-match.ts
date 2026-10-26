/**
 * Categorization rules: which entries a rule's conditions match. Pure and
 * import-free, so the server (applying rules), the screens (suggesting a
 * category while typing) and the tests agree.
 */

export type RuleCondition =
  | { field: "description"; op: "contains" | "equals" | "startsWith"; value: string }
  | { field: "amount"; min?: number; max?: number }
  | { field: "account"; accountId: string }
  | { field: "card"; creditCardId: string }
  | { field: "type"; type: "INCOME" | "EXPENSE" };

export type RuleAction = { set: "category"; categoryId: string } | { set: "tag"; tagId: string };

export interface MatchableEntry {
  type: string;
  description: string;
  amountMinor: number;
  accountId: string | null;
  creditCardId: string | null;
}

/** Rules only ever touch income, expenses and card purchases: never transfers, payments or adjustments. */
export function ruleCanTouch(type: string): boolean {
  return type === "INCOME" || type === "EXPENSE" || type === "CREDIT_CARD_PURCHASE";
}

/** Lowercase without accents, so "Padaria São João" matches "sao joao". */
export function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function matchesOne(entry: MatchableEntry, condition: RuleCondition): boolean {
  switch (condition.field) {
    case "description": {
      const text = normalizeText(entry.description);
      const value = normalizeText(condition.value);
      if (!value) return false;
      if (condition.op === "equals") return text === value;
      if (condition.op === "startsWith") return text.startsWith(value);
      return text.includes(value);
    }
    case "amount":
      return (condition.min === undefined || entry.amountMinor >= condition.min) && (condition.max === undefined || entry.amountMinor <= condition.max);
    case "account":
      return entry.accountId === condition.accountId;
    case "card":
      return entry.creditCardId === condition.creditCardId;
    case "type":
      // A card purchase is an expense.
      return condition.type === "INCOME" ? entry.type === "INCOME" : entry.type === "EXPENSE" || entry.type === "CREDIT_CARD_PURCHASE";
  }
}

/** Every condition must hold (AND); a rule without conditions matches nothing. */
export function ruleMatches(entry: MatchableEntry, conditions: RuleCondition[]): boolean {
  return ruleCanTouch(entry.type) && conditions.length > 0 && conditions.every((condition) => matchesOne(entry, condition));
}

export interface RuleLike {
  id: string;
  priority: number;
  isActive: boolean;
  conditions: RuleCondition[];
  actions: RuleAction[];
}

/**
 * What the active rules do to an entry, in priority order (lowest first):
 * the first matching rule with a category sets it; tags of every matching
 * rule add up.
 */
export function resolveRules(entry: MatchableEntry, rules: RuleLike[]): { categoryId: string | null; tagIds: string[]; ruleIds: string[] } {
  let categoryId: string | null = null;
  const tagIds = new Set<string>();
  const ruleIds: string[] = [];
  for (const rule of [...rules].sort((a, b) => a.priority - b.priority)) {
    if (!rule.isActive || !ruleMatches(entry, rule.conditions)) continue;
    ruleIds.push(rule.id);
    for (const action of rule.actions) {
      if (action.set === "category" && categoryId === null) categoryId = action.categoryId;
      if (action.set === "tag") tagIds.add(action.tagId);
    }
  }
  return { categoryId, tagIds: [...tagIds], ruleIds };
}
