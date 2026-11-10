import { z } from "zod";
import { createPurchaseInput } from "./cards";
import { CURRENCY_CODES } from "./wallets";

export const ACCOUNT_PLANS = ["FREE", "PAID"] as const;
export const AGENT_SCOPES = ["invoices:read", "purchases:create"] as const;
const scopes = z.array(z.enum(AGENT_SCOPES)).min(1).max(2);
const currency = z.enum(CURRENCY_CODES);

export const connectionInput = z.strictObject({
  name: z.string().trim().min(1).max(80),
  walletIds: z.array(z.uuid()).min(1).max(30),
  scopes,
});
export const connectionSchema = connectionInput.extend({ id: z.uuid(), revoked: z.boolean() });
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

export type AgentScope = (typeof AGENT_SCOPES)[number];
export type ConnectionInput = z.infer<typeof connectionInput>;
export type Connections = z.infer<typeof connectionsSchema>;
export type CreatedConnection = z.infer<typeof createdConnectionSchema>;
export type AgentPurchaseInput = z.infer<typeof agentPurchaseInput>;
