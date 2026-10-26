import "server-only";
import { and, asc, desc, eq, lt } from "drizzle-orm";
import type { ActivityPage, ChainCheck } from "@packages/shared/activity";
import { ACTIVITY_PAGE } from "@packages/shared/activity";
import { auditLogs, users } from "@packages/shared/db/schema";
import { requireRole, runCommand, type CommandResult } from "@/lib/server/commands";
import { auditHash } from "@/lib/server/write";

/** The audit log as a feed, and the hash-chain check (wiki/decisoes/0006: every member sees everything). */

export async function listActivity(userId: string, walletId: string, before: Date | null): Promise<CommandResult<ActivityPage>> {
  return runCommand(async (tx) => {
    await requireRole(tx, walletId, userId, "view");
    const rows = await tx
      .select({ log: auditLogs, actorName: users.name })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorUserId))
      .where(and(eq(auditLogs.walletId, walletId), before ? lt(auditLogs.recordedAt, before) : undefined))
      .orderBy(desc(auditLogs.recordedAt), desc(auditLogs.id))
      .limit(ACTIVITY_PAGE + 1);
    const page = rows.slice(0, ACTIVITY_PAGE);
    return {
      entries: page.map(({ log, actorName }) => ({
        id: log.id,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        changes: log.changes ?? null,
        actorName,
        source: log.source,
        recordedAt: log.recordedAt.toISOString(),
      })),
      nextBefore: rows.length > ACTIVITY_PAGE ? page[page.length - 1].log.recordedAt.toISOString() : null,
    };
  });
}

/** Recomputes every hash of the wallet's chain, oldest first (OWNER, ADMIN). */
export async function checkChain(userId: string, walletId: string): Promise<CommandResult<ChainCheck>> {
  return runCommand(async (tx) => {
    await requireRole(tx, walletId, userId, "editWallet");
    const rows = await tx
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.walletId, walletId))
      .orderBy(asc(auditLogs.recordedAt), asc(auditLogs.id));
    let previous: string | null = null;
    for (const row of rows) {
      const expected = auditHash(previous, {
        id: row.id,
        walletId: row.walletId,
        actorUserId: row.actorUserId,
        deviceId: row.deviceId,
        source: row.source,
        action: row.action,
        entity: row.entity,
        entityId: row.entityId,
        changes: row.changes,
        occurredAt: row.occurredAt,
        recordedAt: row.recordedAt,
        mutationId: row.mutationId,
        correlationId: row.correlationId,
      });
      if (row.prevHash !== previous || row.hash !== expected) return { valid: false, entries: rows.length, brokenAt: row.id };
      previous = row.hash;
    }
    return { valid: true, entries: rows.length, brokenAt: null };
  });
}
