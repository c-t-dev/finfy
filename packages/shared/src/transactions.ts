import { z } from "zod";

/**
 * Entries (transactions) of a wallet: inputs and responses shared by the
 * screens and the API (wiki/finfy/data-model.md, "Financial core"). Amounts
 * are positive minor units; the type gives the direction. A transfer is two
 * rows (TRANSFER_OUT and TRANSFER_IN) linked by `transaction_links`.
 */

export const DESCRIPTION_MAX = 120;
export const NOTES_MAX = 1000;
/** Largest amount accepted (10^13 minor units): above it is almost certainly a typo. */
export const AMOUNT_MAX = 10_000_000_000_000;

/** What the user picks in the form; card purchases come with the cards. */
export const ENTRY_KINDS = ["EXPENSE", "INCOME", "TRANSFER"] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

export const isoDate = z.iso.date();
const description = z.string().trim().min(1).max(DESCRIPTION_MAX);
const amountMinor = z.number().int().positive().max(AMOUNT_MAX);
const notes = z.string().trim().max(NOTES_MAX).nullable();
const status = z.enum(["PAID", "PENDING"]);

export const createEntryInput = z.object({
  id: z.uuid(),
  mutationId: z.uuid(),
  type: z.enum(["EXPENSE", "INCOME"]),
  accountId: z.uuid(),
  categoryId: z.uuid(),
  description,
  amountMinor,
  transactionDate: isoDate,
  status,
  notes: notes.optional(),
  /** Saved in the same write as the entry. */
  tagIds: z.array(z.uuid()).max(10).optional(),
});
export type CreateEntryInput = z.infer<typeof createEntryInput>;

/** `id` is the outgoing leg; `inId` the incoming one. */
export const createTransferInput = z
  .object({
    id: z.uuid(),
    inId: z.uuid(),
    mutationId: z.uuid(),
    fromAccountId: z.uuid(),
    toAccountId: z.uuid(),
    description,
    amountMinor,
    transactionDate: isoDate,
    status,
    notes: notes.optional(),
  })
  .refine((input) => input.fromAccountId !== input.toAccountId && input.id !== input.inId, {
    message: "a transfer needs two different accounts",
  });
export type CreateTransferInput = z.infer<typeof createTransferInput>;

/**
 * Editing a transfer leg changes both legs' amount, date, status, description
 * and notes; `accountId` moves only this leg.
 */
export const updateEntryInput = z
  .object({
    mutationId: z.uuid(),
    baseVersion: z.number().int().positive(),
    accountId: z.uuid().optional(),
    categoryId: z.uuid().optional(),
    description: description.optional(),
    amountMinor: amountMinor.optional(),
    transactionDate: isoDate.optional(),
    status: status.optional(),
    notes: notes.optional(),
  })
  .refine((input) => Object.keys(input).some((key) => key !== "mutationId" && key !== "baseVersion"), {
    message: "nothing to change",
  });
export type UpdateEntryInput = z.infer<typeof updateEntryInput>;

/** Archiving one leg of a transfer archives both. */
export const entryStateInput = z.object({ mutationId: z.uuid(), baseVersion: z.number().int().positive() });
export type EntryStateInput = z.infer<typeof entryStateInput>;

export const entryFilter = z.object({
  from: isoDate,
  to: isoDate,
  accountId: z.uuid().optional(),
  categoryId: z.uuid().optional(),
  q: z.string().trim().max(DESCRIPTION_MAX).optional(),
  tagId: z.uuid().optional(),
});
export type EntryFilter = z.infer<typeof entryFilter>;

export const entrySchema = z.object({
  id: z.uuid(),
  type: z.enum([
    "INCOME",
    "EXPENSE",
    "TRANSFER_IN",
    "TRANSFER_OUT",
    "CREDIT_CARD_PURCHASE",
    "CREDIT_CARD_PAYMENT",
    "ADJUSTMENT",
    "REFUND",
  ]),
  status: z.enum(["PAID", "PENDING", "CANCELED"]),
  accountId: z.uuid().nullable(),
  creditCardId: z.uuid().nullable(),
  invoiceId: z.uuid().nullable(),
  categoryId: z.uuid().nullable(),
  description: z.string(),
  amountMinor: z.number().int(),
  transactionDate: isoDate,
  /** Derived invoice due date for card purchases; transactionDate stays unchanged. */
  statementDate: isoDate.optional(),
  notes: z.string().nullable(),
  /** The other leg of a transfer (or the linked transaction of an invoice payment). */
  linkedTransactionId: z.uuid().nullable(),
  /** Account of the other transfer leg, for "From A to B" labels. */
  counterpartAccountId: z.uuid().nullable(),
  installmentNumber: z.number().int().nullable(),
  installmentTotal: z.number().int().nullable(),
  tagIds: z.array(z.uuid()),
  /** Set on occurrences of a recurrence. */
  recurrenceId: z.uuid().nullable(),
  version: z.number().int(),
});
export type Entry = z.infer<typeof entrySchema>;

/** Paid totals of the filtered period; transfers between the wallet's accounts are not income or expense. */
export const entrySummarySchema = z.object({
  accumulatedBalanceMinor: z.number().int().describe("Projected balance through to: confirmedBalanceMinor plus accumulatedPendingMinor; only accountId applies."),
  confirmedBalanceMinor: z.number().int().describe("Opening balances plus paid account movements through to."),
  accumulatedPendingMinor: z.number().int().describe("Signed pending account movements and unpaid card purchases due through to, attributed to the card payment account."),
  incomeMinor: z.number().int(),
  expenseMinor: z.number().int(),
  pendingIncomeMinor: z.number().int(),
  pendingExpenseMinor: z.number().int(),
});
export type EntrySummary = z.infer<typeof entrySummarySchema>;

export const entryListSchema = z.object({ entries: z.array(entrySchema), summary: entrySummarySchema });
export type EntryList = z.infer<typeof entryListSchema>;
export const entryRowsSchema = entryListSchema.pick({ entries: true });
export type EntryRows = z.infer<typeof entryRowsSchema>;
export const entrySummaryResponseSchema = entryListSchema.pick({ summary: true });
export type EntrySummaryResponse = z.infer<typeof entrySummaryResponseSchema>;

/** First and last day of a `YYYY-MM` month, as ISO dates. */
export function monthRange(month: string): { from: string; to: string } {
  const [year, monthNumber] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

/** `YYYY-MM` shifted by `delta` months. */
export function addMonths(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
