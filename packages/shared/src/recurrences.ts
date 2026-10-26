import { z } from "zod";
import { RECURRENCE_FREQUENCIES } from "./finance";
import { AMOUNT_MAX, DESCRIPTION_MAX, isoDate } from "./transactions";

export * from "./schedule";

/**
 * Recurrences (wiki/finfy/data-model.md): a schedule that creates pending
 * entries, one per date, with ID `deterministicId("occurrence", recurrenceId,
 * date)`. Occurrences exist up to `RECURRENCE_HORIZON_DAYS` ahead; the app
 * tops them up when it opens.
 */

export const RECURRENCE_HORIZON_DAYS = 90;

const source = {
  /** Exactly one of account and card. */
  accountId: z.uuid().nullable().optional(),
  creditCardId: z.uuid().nullable().optional(),
};

export const createRecurrenceInput = z
  .object({
    id: z.uuid(),
    mutationId: z.uuid(),
    type: z.enum(["INCOME", "EXPENSE"]),
    description: z.string().trim().min(1).max(DESCRIPTION_MAX),
    amountMinor: z.number().int().positive().max(AMOUNT_MAX),
    ...source,
    categoryId: z.uuid(),
    frequency: z.enum(RECURRENCE_FREQUENCIES),
    startDate: isoDate,
    endDate: isoDate.nullable().optional(),
    /** The first occurrence is already paid (it is the entry being typed now). */
    firstPaid: z.boolean().optional(),
    /** An existing entry that becomes the first occurrence instead of a copy. */
    fromEntryId: z.uuid().optional(),
    tagIds: z.array(z.uuid()).max(10).optional(),
  })
  .refine((input) => Boolean(input.accountId) !== Boolean(input.creditCardId), { message: "account or card" })
  .refine((input) => !input.endDate || input.endDate >= input.startDate, { message: "end before start" });
export type CreateRecurrenceInput = z.infer<typeof createRecurrenceInput>;

/** Changes apply from today on: future pending occurrences are rebuilt; paid and past ones stay. */
export const updateRecurrenceInput = z
  .object({
    mutationId: z.uuid(),
    baseVersion: z.number().int().positive(),
    description: z.string().trim().min(1).max(DESCRIPTION_MAX).optional(),
    amountMinor: z.number().int().positive().max(AMOUNT_MAX).optional(),
    ...source,
    categoryId: z.uuid().optional(),
    frequency: z.enum(RECURRENCE_FREQUENCIES).optional(),
    endDate: isoDate.nullable().optional(),
  })
  .refine((input) => Object.keys(input).some((key) => key !== "mutationId" && key !== "baseVersion"), {
    message: "nothing to change",
  });
export type UpdateRecurrenceInput = z.infer<typeof updateRecurrenceInput>;

export const recurrenceStateInput = z.object({ mutationId: z.uuid(), baseVersion: z.number().int().positive() });
export type RecurrenceStateInput = z.infer<typeof recurrenceStateInput>;

export const refreshRecurrencesInput = z.object({ mutationId: z.uuid() });

export const recurrenceSchema = z.object({
  id: z.uuid(),
  type: z.enum(["INCOME", "EXPENSE"]),
  description: z.string(),
  amountMinor: z.number().int(),
  accountId: z.uuid().nullable(),
  creditCardId: z.uuid().nullable(),
  categoryId: z.uuid().nullable(),
  frequency: z.enum(RECURRENCE_FREQUENCIES),
  startDate: isoDate,
  endDate: isoDate.nullable(),
  /** Next date from today on, or null when the recurrence ended. */
  nextDate: isoDate.nullable(),
  archived: z.boolean(),
  version: z.number().int(),
});
export type Recurrence = z.infer<typeof recurrenceSchema>;

export const recurrenceListSchema = z.object({ recurrences: z.array(recurrenceSchema) });
export const refreshResultSchema = z.object({ created: z.number().int() });
