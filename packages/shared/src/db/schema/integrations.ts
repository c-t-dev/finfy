import { index, jsonb, pgTable, primaryKey, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { AgentEntryReceipt, AgentScope } from "../../integrations";
import { createdAt, idColumn, timestamptz } from "../columns";
import { users } from "./identity";

export const agentConnections = pgTable("agent_connections", {
  id: idColumn(),
  userId: uuid("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  tokenHash: text("token_hash").notNull(),
  walletIds: uuid("wallet_ids").array().notNull(),
  scopes: text("scopes").array().$type<AgentScope[]>().notNull(),
  createdAt: createdAt(),
  revokedAt: timestamptz("revoked_at"),
}, (t) => [
  uniqueIndex("agent_connections_token_hash_unique").on(t.tokenHash),
  index("agent_connections_user_idx").on(t.userId),
]);

export const agentPurchaseRequests = pgTable("agent_purchase_requests", {
  connectionId: uuid("connection_id").notNull().references(() => agentConnections.id),
  requestId: uuid("request_id").notNull(),
  requestHash: text("request_hash").notNull(),
  purchaseId: uuid("purchase_id").notNull(),
  invoiceId: uuid("invoice_id").notNull(),
}, (t) => [primaryKey({ columns: [t.connectionId, t.requestId] })]);

export const agentEntryRequests = pgTable("agent_entry_requests", {
  connectionId: uuid("connection_id").notNull().references(() => agentConnections.id),
  requestId: uuid("request_id").notNull(),
  requestHash: text("request_hash").notNull(),
  receipt: jsonb("receipt").$type<AgentEntryReceipt>().notNull(),
}, (t) => [primaryKey({ columns: [t.connectionId, t.requestId] })]);
