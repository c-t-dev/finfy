import "server-only";
import { createHash } from "node:crypto";
import { desc, eq, sql } from "drizzle-orm";
import { newId } from "@packages/shared/ids";
import { auditLogs, syncMutations, MUTATION_OPS } from "@packages/shared/db/schema";
import type { getDb } from "@/lib/server/db";

/**
 * The one write path (wiki/finfy/data-model.md, "One write path"). Every
 * change to a synced row runs inside a database transaction that also records
 * the mutation (idempotency by `mutation_id`) and appends to the wallet's
 * audit log (wiki/decisoes/0006). Web requests and the future
 * `POST /api/sync/push` both end here.
 */

type Db = ReturnType<typeof getDb>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export type MutationOp = (typeof MUTATION_OPS)[number];

/** Who is writing: the signed-in user and the session's device. */
export interface Actor {
  userId: string;
  deviceId: string | null;
}

export type FieldChanges = Record<string, { from: unknown; to: unknown }>;

/** Field-level diff of the keys in `next`, skipping unchanged ones. */
export function diff(current: Record<string, unknown>, next: Record<string, unknown>): FieldChanges {
  const changes: FieldChanges = {};
  for (const [field, to] of Object.entries(next)) {
    if (to !== undefined && current[field] !== to) changes[field] = { from: current[field] ?? null, to };
  }
  return changes;
}

/**
 * Whether this `mutation_id` was already applied. A retry of an applied
 * mutation must not change anything again; the caller answers with the
 * current state instead. Another user's ID is refused.
 */
export async function findApplied(tx: Tx, mutationId: string, userId: string): Promise<"new" | "applied" | "foreign"> {
  const [row] = await tx
    .select({ userId: syncMutations.userId })
    .from(syncMutations)
    .where(eq(syncMutations.mutationId, mutationId))
    .limit(1);
  if (!row) return "new";
  return row.userId === userId ? "applied" : "foreign";
}

/** JSON with sorted keys, so the same entry always hashes the same. */
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : 1));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
}

/** SHA-256 of the previous hash and the entry: the wallet's hash chain. */
export function auditHash(prevHash: string | null, entry: Record<string, unknown>): string {
  return createHash("sha256")
    .update(`${prevHash ?? ""}\n${canonical(entry)}`)
    .digest("hex");
}

export interface Change {
  walletId: string;
  entity: string;
  entityId: string;
  op: MutationOp;
  /** Audit action; usually the op, or an access event such as `MEMBER_JOINED`. */
  action: string;
  changes: FieldChanges;
}

/**
 * Records an accepted mutation and its audit entries, in the caller's
 * transaction. The audit chain is per wallet: an advisory lock serializes
 * writers of the same wallet, and `recorded_at` uses the clock at insert time,
 * so the chain order is (`recorded_at`, `id`).
 */
export async function recordMutation(
  tx: Tx,
  actor: Actor,
  mutation: {
    mutationId: string;
    baseVersion?: number;
    occurredAt?: Date;
    /** Who caused it when not the person directly: a rule or a recurrence (with its ID). */
    source?: "APP" | "RULE" | "RECURRENCE";
    sourceRefId?: string;
  },
  primary: Change,
  extra: Change[] = [],
): Promise<void> {
  await tx.insert(syncMutations).values({
    mutationId: mutation.mutationId,
    walletId: primary.walletId,
    userId: actor.userId,
    deviceId: actor.deviceId,
    entity: primary.entity,
    entityId: primary.entityId,
    op: primary.op,
    changes: Object.fromEntries(Object.entries(primary.changes).map(([field, { to }]) => [field, to])),
    baseVersion: mutation.baseVersion,
    occurredAt: mutation.occurredAt,
    status: "ACCEPTED",
  });

  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${primary.walletId}, 0))`);
  for (const change of [primary, ...extra]) {
    const [last] = await tx
      .select({ hash: auditLogs.hash })
      .from(auditLogs)
      .where(eq(auditLogs.walletId, change.walletId))
      .orderBy(desc(auditLogs.recordedAt), desc(auditLogs.id))
      .limit(1);
    const [{ now }] = await tx.execute<{ now: string }>(sql`select clock_timestamp()::text as now`);
    const entry = {
      id: newId(),
      walletId: change.walletId,
      actorUserId: actor.userId,
      deviceId: actor.deviceId,
      source: mutation.source ?? "APP",
      sourceRefId: mutation.sourceRefId ?? null,
      action: change.action,
      entity: change.entity,
      entityId: change.entityId,
      changes: change.changes,
      occurredAt: mutation.occurredAt ?? null,
      recordedAt: new Date(now),
      mutationId: mutation.mutationId,
      correlationId: mutation.mutationId,
    };
    const prevHash = last?.hash ?? null;
    await tx.insert(auditLogs).values({ ...entry, prevHash, hash: auditHash(prevHash, entry) });
  }
}
