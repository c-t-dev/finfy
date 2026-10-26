import "server-only";
import { and, asc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import type { AccountColor } from "@packages/shared/accounts";
import { tags, transactionTags, transactions } from "@packages/shared/db/schema";
import { deterministicId } from "@packages/shared/ids";
import type { CreateTagInput, SetEntryTagsInput, Tag, UpdateTagInput } from "@packages/shared/tags";
import { CommandError, requireRole, runCommand, type CommandResult } from "@/lib/server/commands";
import { diff, findApplied, recordMutation, type Actor, type Change, type Tx } from "@/lib/server/write";

/**
 * Tags (wiki/finfy/data-model.md). A tag on an entry is a `transaction_tags`
 * row with ID `deterministicId("transaction_tag", transactionId, tagId)`:
 * removing it archives the row and adding it again restores the same row,
 * so two offline devices never create two.
 */

type TagRow = typeof tags.$inferSelect;
const now = sql`now()`;

const toTag = (row: TagRow): Tag => ({
  id: row.id,
  name: row.name,
  color: (row.color ?? "gray") as AccountColor,
  archived: row.archivedAt !== null,
  version: row.version,
});

/** Active tag IDs of each entry. */
export async function tagsByEntry(tx: Tx, entryIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (!entryIds.length) return map;
  const rows = await tx
    .select({ transactionId: transactionTags.transactionId, tagId: transactionTags.tagId })
    .from(transactionTags)
    .innerJoin(tags, eq(tags.id, transactionTags.tagId))
    .where(and(inArray(transactionTags.transactionId, entryIds), isNull(transactionTags.archivedAt), isNull(tags.archivedAt)));
  for (const row of rows) map.set(row.transactionId, [...(map.get(row.transactionId) ?? []), row.tagId]);
  return map;
}

/**
 * Makes each entry carry exactly `tagIds`, inside the caller's transaction.
 * Every tag must be an active tag of the wallet. Returns the audit changes.
 */
export async function applyTags(tx: Tx, actor: Actor, walletId: string, entryIds: string[], tagIds: string[]): Promise<Change[]> {
  const wanted = [...new Set(tagIds)];
  if (wanted.length) {
    const found = await tx
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.walletId, walletId), inArray(tags.id, wanted), isNull(tags.archivedAt)));
    if (found.length !== wanted.length) throw new CommandError("invalidInput");
  }
  const existing = entryIds.length
    ? await tx.select().from(transactionTags).where(inArray(transactionTags.transactionId, entryIds)).for("update")
    : [];
  const changes: Change[] = [];
  for (const entryId of entryIds) {
    const rows = existing.filter((row) => row.transactionId === entryId);
    for (const tagId of wanted) {
      const row = rows.find((item) => item.tagId === tagId);
      const id = deterministicId("transaction_tag", entryId, tagId);
      if (!row) {
        await tx.insert(transactionTags).values({ id, walletId, transactionId: entryId, tagId, createdBy: actor.userId, updatedBy: actor.userId });
        changes.push({ walletId, entity: "transaction_tags", entityId: id, op: "CREATE", action: "CREATE", changes: diff({}, { transaction_id: entryId, tag_id: tagId }) });
      } else if (row.archivedAt) {
        await tx
          .update(transactionTags)
          .set({ archivedAt: null, archivedBy: null, version: sql`${transactionTags.version} + 1`, updatedAt: now, updatedBy: actor.userId })
          .where(eq(transactionTags.id, row.id));
        changes.push({ walletId, entity: "transaction_tags", entityId: row.id, op: "RESTORE", action: "RESTORE", changes: diff({ archived: true }, { archived: false }) });
      }
    }
    for (const row of rows) {
      if (row.archivedAt || wanted.includes(row.tagId)) continue;
      await tx
        .update(transactionTags)
        .set({ archivedAt: now, archivedBy: actor.userId, version: sql`${transactionTags.version} + 1`, updatedAt: now, updatedBy: actor.userId })
        .where(eq(transactionTags.id, row.id));
      changes.push({ walletId, entity: "transaction_tags", entityId: row.id, op: "ARCHIVE", action: "ARCHIVE", changes: diff({ archived: false }, { archived: true }) });
    }
  }
  return changes;
}

async function applied(tx: Tx, actor: Actor, mutationId: string): Promise<boolean> {
  const state = await findApplied(tx, mutationId, actor.userId);
  if (state === "foreign") throw new CommandError("invalidInput");
  return state === "applied";
}

export async function listTags(userId: string, walletId: string, archived: boolean): Promise<CommandResult<Tag[]>> {
  return runCommand(async (tx) => {
    await requireRole(tx, walletId, userId, "view");
    const rows = await tx
      .select()
      .from(tags)
      .where(and(eq(tags.walletId, walletId), archived ? isNotNull(tags.archivedAt) : isNull(tags.archivedAt)))
      .orderBy(asc(sql`lower(${tags.name})`));
    return rows.map(toTag);
  });
}

async function activeByName(tx: Tx, walletId: string, name: string): Promise<TagRow | undefined> {
  const [row] = await tx
    .select()
    .from(tags)
    .where(and(eq(tags.walletId, walletId), isNull(tags.archivedAt), sql`lower(${tags.name}) = lower(${name})`))
    .limit(1);
  return row;
}

/** A name that already exists answers the existing tag instead of failing. */
export async function createTag(actor: Actor, walletId: string, input: CreateTagInput): Promise<CommandResult<Tag>> {
  return runCommand(async (tx) => {
    if (await applied(tx, actor, input.mutationId)) {
      await requireRole(tx, walletId, actor.userId, "view");
      const [row] = await tx.select().from(tags).where(eq(tags.id, input.id)).limit(1);
      const match = row ?? (await activeByName(tx, walletId, input.name));
      if (!match) throw new CommandError("notFound");
      return toTag(match);
    }
    await requireRole(tx, walletId, actor.userId, "editEntries");
    const same = await activeByName(tx, walletId, input.name);
    if (same) return toTag(same);
    const [taken] = await tx.select({ id: tags.id }).from(tags).where(eq(tags.id, input.id)).limit(1);
    if (taken) throw new CommandError("invalidInput");
    const [row] = await tx
      .insert(tags)
      .values({ id: input.id, walletId, name: input.name, color: input.color, createdBy: actor.userId, updatedBy: actor.userId })
      .returning();
    await recordMutation(tx, actor, { mutationId: input.mutationId }, {
      walletId,
      entity: "tags",
      entityId: row.id,
      op: "CREATE",
      action: "CREATE",
      changes: diff({}, { name: input.name, color: input.color }),
    });
    return toTag(row);
  });
}

async function loadTag(tx: Tx, walletId: string, tagId: string, archived: boolean): Promise<TagRow> {
  const [row] = await tx
    .select()
    .from(tags)
    .where(and(eq(tags.walletId, walletId), eq(tags.id, tagId), archived ? isNotNull(tags.archivedAt) : isNull(tags.archivedAt)))
    .for("update")
    .limit(1);
  if (!row) throw new CommandError("notFound");
  return row;
}

/** Renaming to a name another active tag has is refused (`invalidInput`). */
export async function updateTag(actor: Actor, walletId: string, tagId: string, input: UpdateTagInput): Promise<CommandResult<Tag>> {
  return runCommand(async (tx) => {
    if (!(await applied(tx, actor, input.mutationId))) {
      await requireRole(tx, walletId, actor.userId, "editEntries");
      const row = await loadTag(tx, walletId, tagId, false);
      if (input.name) {
        const same = await activeByName(tx, walletId, input.name);
        if (same && same.id !== tagId) throw new CommandError("invalidInput");
      }
      const changes = diff({ name: row.name, color: row.color }, { name: input.name, color: input.color });
      if (Object.keys(changes).length) {
        await tx
          .update(tags)
          .set({ name: input.name ?? row.name, color: input.color ?? row.color, version: sql`${tags.version} + 1`, updatedAt: now, updatedBy: actor.userId })
          .where(eq(tags.id, tagId));
        await recordMutation(tx, actor, { mutationId: input.mutationId }, { walletId, entity: "tags", entityId: tagId, op: "UPDATE", action: "UPDATE", changes });
      }
    } else {
      await requireRole(tx, walletId, actor.userId, "view");
    }
    const [row] = await tx.select().from(tags).where(eq(tags.id, tagId)).limit(1);
    return toTag(row);
  });
}

/** Archived tags disappear from entries and pickers; restoring brings them back (unless the name is taken again). */
export async function setTagArchived(
  actor: Actor,
  walletId: string,
  tagId: string,
  archived: boolean,
  input: { mutationId: string },
): Promise<CommandResult<Tag>> {
  return runCommand(async (tx) => {
    if (!(await applied(tx, actor, input.mutationId))) {
      await requireRole(tx, walletId, actor.userId, archived ? "deleteEntries" : "editEntries");
      const row = await loadTag(tx, walletId, tagId, !archived);
      if (!archived && (await activeByName(tx, walletId, row.name))) throw new CommandError("invalidInput");
      await tx
        .update(tags)
        .set({
          archivedAt: archived ? now : null,
          archivedBy: archived ? actor.userId : null,
          version: sql`${tags.version} + 1`,
          updatedAt: now,
          updatedBy: actor.userId,
        })
        .where(eq(tags.id, tagId));
      await recordMutation(tx, actor, { mutationId: input.mutationId }, {
        walletId,
        entity: "tags",
        entityId: tagId,
        op: archived ? "ARCHIVE" : "RESTORE",
        action: archived ? "ARCHIVE" : "RESTORE",
        changes: diff({ archived: !archived }, { archived }),
      });
    } else {
      await requireRole(tx, walletId, actor.userId, "view");
    }
    const [row] = await tx.select().from(tags).where(eq(tags.id, tagId)).limit(1);
    return toTag(row);
  });
}

/** Replaces an entry's tags; on a card purchase, every installment gets them. */
export async function setEntryTags(actor: Actor, walletId: string, entryId: string, input: SetEntryTagsInput): Promise<CommandResult<{ tagIds: string[] }>> {
  return runCommand(async (tx) => {
    const [row] = await tx
      .select()
      .from(transactions)
      .where(and(eq(transactions.walletId, walletId), eq(transactions.id, entryId), isNull(transactions.archivedAt)))
      .limit(1);
    if (!row) throw new CommandError("notFound");
    const group = row.installmentGroupId
      ? (
          await tx
            .select({ id: transactions.id })
            .from(transactions)
            .where(and(eq(transactions.installmentGroupId, row.installmentGroupId), isNull(transactions.archivedAt)))
        ).map((item) => item.id)
      : [entryId];
    if (!(await applied(tx, actor, input.mutationId))) {
      await requireRole(tx, walletId, actor.userId, "editEntries");
      const changes = await applyTags(tx, actor, walletId, group, input.tagIds);
      if (changes.length) {
        const [first, ...rest] = changes;
        await recordMutation(tx, actor, { mutationId: input.mutationId }, first, rest);
      }
    } else {
      await requireRole(tx, walletId, actor.userId, "view");
    }
    return { tagIds: (await tagsByEntry(tx, [entryId])).get(entryId) ?? [] };
  });
}
