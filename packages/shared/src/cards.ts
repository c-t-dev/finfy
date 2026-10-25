import { z } from "zod";
import { ACCOUNT_COLORS } from "./accounts";
import { CARD_BRANDS } from "./finance";
import { DESCRIPTION_MAX, NOTES_MAX, AMOUNT_MAX, isoDate, entrySchema } from "./transactions";

/**
 * Credit cards and invoices (wiki/finfy/data-model.md): inputs and responses.
 * The invoice math lives in invoice-math.ts.
 */

export const CARD_NAME_MAX = 60;
export const INSTALLMENTS_MAX = 48;

export * from "./invoice-math";

// ---------- Inputs and responses ----------

const cardName = z.string().trim().min(1).max(CARD_NAME_MAX);
const day = z.number().int().min(1).max(31);

export const createCardInput = z.object({
  id: z.uuid(),
  mutationId: z.uuid(),
  name: cardName,
  paymentAccountId: z.uuid(),
  brand: z.enum(CARD_BRANDS),
  limitMinor: z.number().int().min(0).max(AMOUNT_MAX),
  closingDay: day,
  dueDay: day,
  color: z.enum(ACCOUNT_COLORS),
});
export type CreateCardInput = z.infer<typeof createCardInput>;

/** Closing and due days only affect invoices opened after the change. */
export const updateCardInput = z
  .object({
    mutationId: z.uuid(),
    baseVersion: z.number().int().positive(),
    name: cardName.optional(),
    paymentAccountId: z.uuid().optional(),
    brand: z.enum(CARD_BRANDS).optional(),
    limitMinor: z.number().int().min(0).max(AMOUNT_MAX).optional(),
    closingDay: day.optional(),
    dueDay: day.optional(),
    color: z.enum(ACCOUNT_COLORS).optional(),
  })
  .refine((input) => Object.keys(input).some((key) => key !== "mutationId" && key !== "baseVersion"), {
    message: "nothing to change",
  });
export type UpdateCardInput = z.infer<typeof updateCardInput>;

export const cardStateInput = z.object({ mutationId: z.uuid(), baseVersion: z.number().int().positive() });
export type CardStateInput = z.infer<typeof cardStateInput>;

/** `id` is the first installment's; the others get deterministic IDs from it. */
export const createPurchaseInput = z.object({
  id: z.uuid(),
  mutationId: z.uuid(),
  categoryId: z.uuid(),
  description: z.string().trim().min(1).max(DESCRIPTION_MAX),
  /** Total of the purchase; split across installments. */
  amountMinor: z.number().int().positive().max(AMOUNT_MAX),
  transactionDate: isoDate,
  installments: z.number().int().min(1).max(INSTALLMENTS_MAX),
  notes: z.string().trim().max(NOTES_MAX).nullable().optional(),
});
export type CreatePurchaseInput = z.infer<typeof createPurchaseInput>;

/** Text fields apply to every installment of the purchase; amount and date need a new purchase. */
export const updatePurchaseInput = z
  .object({
    mutationId: z.uuid(),
    categoryId: z.uuid().optional(),
    description: z.string().trim().min(1).max(DESCRIPTION_MAX).optional(),
    notes: z.string().trim().max(NOTES_MAX).nullable().optional(),
  })
  .refine((input) => input.categoryId !== undefined || input.description !== undefined || input.notes !== undefined, {
    message: "nothing to change",
  });
export type UpdatePurchaseInput = z.infer<typeof updatePurchaseInput>;

export const purchaseStateInput = z.object({ mutationId: z.uuid() });
export type PurchaseStateInput = z.infer<typeof purchaseStateInput>;

/** Pays the whole invoice from an account; `paymentId` is the new payment entry. */
export const payInvoiceInput = z.object({
  mutationId: z.uuid(),
  paymentId: z.uuid(),
  accountId: z.uuid(),
  paymentDate: isoDate,
  /** Must equal the invoice total: partial payments are not supported yet. */
  amountMinor: z.number().int().positive().max(AMOUNT_MAX),
});
export type PayInvoiceInput = z.infer<typeof payInvoiceInput>;

export const reopenInvoiceInput = z.object({ mutationId: z.uuid() });
export type ReopenInvoiceInput = z.infer<typeof reopenInvoiceInput>;

export const invoiceSchema = z.object({
  id: z.uuid(),
  creditCardId: z.uuid(),
  referenceYear: z.number().int(),
  referenceMonth: z.number().int(),
  openingDate: isoDate,
  closingDate: isoDate,
  dueDate: isoDate,
  state: z.enum(["OPEN", "CLOSED", "OVERDUE", "PAID"]),
  totalMinor: z.number().int(),
  paymentTransactionId: z.uuid().nullable(),
  version: z.number().int(),
});
export type Invoice = z.infer<typeof invoiceSchema>;

export const cardSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  paymentAccountId: z.uuid(),
  brand: z.enum(CARD_BRANDS),
  limitMinor: z.number().int(),
  closingDay: z.number().int(),
  dueDay: z.number().int(),
  color: z.enum(ACCOUNT_COLORS),
  /** Purchases in unpaid invoices: what the limit has used. */
  usedMinor: z.number().int(),
  /** The invoice today's purchases go to. */
  currentInvoice: invoiceSchema.nullable(),
  archived: z.boolean(),
  version: z.number().int(),
});
export type Card = z.infer<typeof cardSchema>;

export const cardListSchema = z.object({ cards: z.array(cardSchema) });
export const invoiceListSchema = z.object({ invoices: z.array(invoiceSchema) });
export const invoiceDetailSchema = z.object({ invoice: invoiceSchema, purchases: z.array(entrySchema) });
export type InvoiceDetail = z.infer<typeof invoiceDetailSchema>;
