import { z } from "zod";
import { createPurchaseInput } from "./cards";
import { createEntryInput, createTransferInput } from "./transactions";
import { createRecurrenceInput } from "./recurrences";
import { CATEGORY_KINDS } from "./finance";
import { CURRENCY_CODES } from "./wallets";

export const ACCOUNT_PLANS = ["FREE", "PAID"] as const;
export const AGENT_SCOPES = ["invoices:read", "entries:create"] as const;
const supportedScopes = [...AGENT_SCOPES, "purchases:create"] as const;
const scopes = z.array(z.enum(supportedScopes)).min(1).max(2);
const connectionScopes = z.union([
  z.tuple([z.literal("invoices:read")]),
  z.tuple([z.literal("invoices:read"), z.enum(["entries:create", "purchases:create"])]),
  z.tuple([z.enum(["entries:create", "purchases:create"]), z.literal("invoices:read")]),
]);
const currency = z.enum(CURRENCY_CODES);

export const connectionInput = z.strictObject({
  name: z.string().trim().min(1).max(80),
  walletIds: z.array(z.uuid()).min(1).max(30),
  scopes: connectionScopes,
});
export const connectionSchema = connectionInput.extend({ scopes, id: z.uuid(), revoked: z.boolean() });
export const connectionsSchema = z.object({
  plan: z.enum(ACCOUNT_PLANS),
  connections: z.array(connectionSchema),
});
export const createdConnectionSchema = connectionSchema.extend({ token: z.string() });
export const agentWalletSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  currencyCode: currency,
  scopes,
});
export const agentInvoicesSchema = z.array(z.object({
  cardId: z.uuid(),
  cardName: z.string(),
  nextInvoice: z.object({ dueDate: z.iso.date(), totalMinor: z.number().int() }).nullable(),
}));
export const agentTargetsSchema = z.object({
  cards: z.array(z.object({ id: z.uuid(), name: z.string() })),
  categories: z.array(z.object({ id: z.uuid(), name: z.string(), parentId: z.uuid().nullable() })),
});
export const agentPurchaseInput = createPurchaseInput.pick({
  categoryId: true, description: true, amountMinor: true, transactionDate: true,
}).extend({ requestId: z.uuid(), currencyCode: currency }).strict();
export const agentReceiptSchema = z.object({ purchaseId: z.uuid(), invoiceId: z.uuid() });

const requestFields = { requestId: z.uuid(), currencyCode: currency };
export const agentEntryInput = z.discriminatedUnion("kind", [
  createEntryInput.omit({ id: true, mutationId: true })
    .extend({ ...requestFields, kind: z.literal("entry") }).strict(),
  z.strictObject(createTransferInput.shape).omit({ id: true, inId: true, mutationId: true })
    .extend({ ...requestFields, kind: z.literal("transfer") }),
  createPurchaseInput.omit({ id: true, mutationId: true })
    .extend({ ...requestFields, kind: z.literal("purchase"), cardId: z.uuid() }).strict(),
  z.strictObject(createRecurrenceInput.shape).omit({ id: true, mutationId: true, fromEntryId: true })
    .extend({ ...requestFields, kind: z.literal("recurrence") }),
]);

const namedTarget = z.object({ id: z.uuid(), name: z.string() });
export const agentEntryTargetsSchema = z.object({
  accounts: z.array(namedTarget),
  cards: z.array(namedTarget),
  categories: z.array(namedTarget.extend({ parentId: z.uuid().nullable(), kind: z.enum(CATEGORY_KINDS) })),
  tags: z.array(namedTarget),
});
export const agentEntryReceiptSchema = z.object({
  kind: z.enum(["entry", "transfer", "purchase", "recurrence"]),
  ids: z.array(z.uuid()).min(1),
});

export type AgentScope = (typeof supportedScopes)[number];
export type AgentEntryInput = z.infer<typeof agentEntryInput>;
export type AgentEntryReceipt = z.infer<typeof agentEntryReceiptSchema>;
export type ConnectionInput = z.infer<typeof connectionInput>;
export type Connections = z.infer<typeof connectionsSchema>;
export type CreatedConnection = z.infer<typeof createdConnectionSchema>;
export type AgentPurchaseInput = z.infer<typeof agentPurchaseInput>;
