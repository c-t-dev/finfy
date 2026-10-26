import { z } from "zod";
import { AMOUNT_MAX } from "./transactions";

export * from "./rule-match";

/**
 * Categorization rules (wiki/finfy/data-model.md): conditions combined with
 * AND, actions that set the category and add tags. The matching itself is in
 * rule-match.ts.
 */

export const RULE_NAME_MAX = 60;

export const ruleConditionSchema = z.discriminatedUnion("field", [
  z.object({ field: z.literal("description"), op: z.enum(["contains", "equals", "startsWith"]), value: z.string().trim().min(1).max(120) }),
  z.object({ field: z.literal("amount"), min: z.number().int().min(0).max(AMOUNT_MAX).optional(), max: z.number().int().min(0).max(AMOUNT_MAX).optional() }),
  z.object({ field: z.literal("account"), accountId: z.uuid() }),
  z.object({ field: z.literal("card"), creditCardId: z.uuid() }),
  z.object({ field: z.literal("type"), type: z.enum(["INCOME", "EXPENSE"]) }),
]);

export const ruleActionSchema = z.discriminatedUnion("set", [
  z.object({ set: z.literal("category"), categoryId: z.uuid() }),
  z.object({ set: z.literal("tag"), tagId: z.uuid() }),
]);

const conditions = z.array(ruleConditionSchema).min(1).max(10);
const actions = z.array(ruleActionSchema).min(1).max(10);

export const createRuleInput = z.object({
  id: z.uuid(),
  mutationId: z.uuid(),
  name: z.string().trim().min(1).max(RULE_NAME_MAX),
  priority: z.number().int().min(0).max(1000).optional(),
  isActive: z.boolean(),
  applyToHistory: z.boolean(),
  conditions,
  actions,
});
export type CreateRuleInput = z.infer<typeof createRuleInput>;

export const updateRuleInput = z
  .object({
    mutationId: z.uuid(),
    name: z.string().trim().min(1).max(RULE_NAME_MAX).optional(),
    priority: z.number().int().min(0).max(1000).optional(),
    isActive: z.boolean().optional(),
    applyToHistory: z.boolean().optional(),
    conditions: conditions.optional(),
    actions: actions.optional(),
  })
  .refine((input) => Object.keys(input).length > 1, { message: "nothing to change" });
export type UpdateRuleInput = z.infer<typeof updateRuleInput>;

export const ruleActionInput = z.object({ mutationId: z.uuid() });
export const previewRuleInput = z.object({ conditions });
export type PreviewRuleInput = z.infer<typeof previewRuleInput>;

export const ruleSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  priority: z.number().int(),
  isActive: z.boolean(),
  applyToHistory: z.boolean(),
  conditions: z.array(ruleConditionSchema),
  actions: z.array(ruleActionSchema),
  version: z.number().int(),
});
export type Rule = z.infer<typeof ruleSchema>;

export const ruleListSchema = z.object({ rules: z.array(ruleSchema) });
export const rulePreviewSchema = z.object({
  count: z.number().int(),
  /** Up to 5 matching entries, newest first. */
  sample: z.array(z.object({ id: z.uuid(), description: z.string(), amountMinor: z.number().int(), transactionDate: z.string() })),
});
export type RulePreview = z.infer<typeof rulePreviewSchema>;
export const ruleApplyResultSchema = z.object({ changed: z.number().int() });
