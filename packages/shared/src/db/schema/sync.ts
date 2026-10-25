import { sql } from "drizzle-orm";
import { bigint, index, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { enumCheck, idColumn, textEnum, timestamptz } from "../columns";
import { devices, users } from "./identity";
import { wallets } from "./wallets";

/**
 * Sync and audit (wiki/decisoes/0005 and 0006). Web writes and the native
 * apps' `POST /api/sync/push` both land here through the same server commands.
 */

export const MUTATION_OPS = ["CREATE", "UPDATE", "ARCHIVE", "RESTORE"] as const;
export const MUTATION_STATUSES = ["ACCEPTED", "CONFLICT", "REJECTED"] as const;

/** Every write, idempotent by `mutation_id` (sent by the client, web included). */
export const syncMutations = pgTable(
  "sync_mutations",
  {
    mutationId: uuid("mutation_id").primaryKey(),
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => wallets.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    deviceId: uuid("device_id").references(() => devices.id),
    entity: text("entity").notNull(),
    entityId: uuid("entity_id").notNull(),
    op: textEnum("op", MUTATION_OPS).notNull(),
    /** Only the changed fields, with their new values. */
    changes: jsonb("changes").$type<Record<string, unknown>>().notNull(),
    /** Version the client was editing; drives the field-level merge. */
    baseVersion: bigint("base_version", { mode: "number" }),
    /** Device clock, informative only: it never decides a conflict. */
    occurredAt: timestamptz("occurred_at"),
    receivedAt: timestamptz("received_at").notNull().defaultNow(),
    status: textEnum("status", MUTATION_STATUSES).notNull(),
    reason: text("reason"),
  },
  (t) => [
    index("sync_mutations_wallet_received_idx").on(t.walletId, t.receivedAt),
    enumCheck("sync_mutations_op_check", t.op, MUTATION_OPS),
    enumCheck("sync_mutations_status_check", t.status, MUTATION_STATUSES),
  ],
);

export const CONFLICT_RESOLUTIONS = ["KEEP_SERVER", "APPLY_MINE"] as const;

/** Shown in the "Review conflicts" screen to the author of the losing edit. */
export const syncConflicts = pgTable(
  "sync_conflicts",
  {
    id: idColumn(),
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => wallets.id),
    mutationId: uuid("mutation_id")
      .notNull()
      .references(() => syncMutations.mutationId),
    entity: text("entity").notNull(),
    entityId: uuid("entity_id").notNull(),
    field: text("field").notNull(),
    serverValue: jsonb("server_value"),
    deviceValue: jsonb("device_value"),
    resolvedAt: timestamptz("resolved_at"),
    resolvedBy: uuid("resolved_by").references(() => users.id),
    resolution: textEnum("resolution", CONFLICT_RESOLUTIONS),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("sync_conflicts_open_idx").on(t.walletId).where(sql`${t.resolvedAt} is null`),
    enumCheck("sync_conflicts_resolution_check", t.resolution, CONFLICT_RESOLUTIONS),
  ],
);

export const AUDIT_SOURCES = ["APP", "SYNC", "RULE", "RECURRENCE", "IMPORT", "SYSTEM"] as const;

/**
 * Append-only, hash-chained per wallet (wiki/decisoes/0006). UPDATE and DELETE
 * are blocked by a trigger in the migrations. Every member sees everything.
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: idColumn(),
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => wallets.id),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    deviceId: uuid("device_id").references(() => devices.id),
    source: textEnum("source", AUDIT_SOURCES).notNull(),
    sourceRefId: uuid("source_ref_id"),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: uuid("entity_id").notNull(),
    /** Field-level diff: { field: { from, to } }. */
    changes: jsonb("changes").$type<Record<string, { from: unknown; to: unknown }>>(),
    occurredAt: timestamptz("occurred_at"),
    recordedAt: timestamptz("recorded_at").notNull().defaultNow(),
    mutationId: uuid("mutation_id"),
    correlationId: uuid("correlation_id"),
    prevHash: text("prev_hash"),
    hash: text("hash").notNull(),
  },
  (t) => [
    index("audit_logs_wallet_recorded_idx").on(t.walletId, t.recordedAt),
    index("audit_logs_entity_idx").on(t.entity, t.entityId),
    enumCheck("audit_logs_source_check", t.source, AUDIT_SOURCES),
  ],
);
