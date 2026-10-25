import "server-only";
import { and, asc, eq, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import type {
  Category,
  CategoryStateInput,
  CategoryVisibilityInput,
  CreateCategoryInput,
  UpdateCategoryInput,
} from "@packages/shared/categories";
import { categories, hiddenCategories } from "@packages/shared/db/schema";
import { deterministicId } from "@packages/shared/ids";
import { CommandError, requireRole, runCommand, type CommandResult } from "@/lib/server/commands";
import { diff, findApplied, recordMutation, type Actor, type Change, type Tx } from "@/lib/server/write";

/**
 * Categories (wiki/finfy/data-model.md). System rows are shared and read-only;
 * a wallet hides them through `hidden_categories`. Wallet rows are created,
 * edited and archived by OWNER, ADMIN and EDITOR. Two levels at most.
 */

type CategoryRow = typeof categories.$inferSelect;

function toCategory(row: CategoryRow, hidden: boolean): Category {
  return {
    id: row.id,
    parentId: row.parentId,
    name: row.name,
    translationKey: row.translationKey,
    kind: row.kind,
    isSystem: row.isSystem,
    icon: row.icon,
    color: row.color,
    hidden,
    archived: row.archivedAt !== null,
    version: row.version,
  };
}

/** System categories plus the wallet's, with the wallet's hidden flags. */
async function selectCategories(tx: Tx, walletId: string, where: SQL | undefined): Promise<Category[]> {
  const rows = await tx
    .select({ category: categories, hiddenId: hiddenCategories.id })
    .from(categories)
    .leftJoin(
      hiddenCategories,
      and(
        eq(hiddenCategories.categoryId, categories.id),
        eq(hiddenCategories.walletId, walletId),
        isNull(hiddenCategories.archivedAt),
      ),
    )
    .where(and(or(isNull(categories.walletId), eq(categories.walletId, walletId)), where))
    .orderBy(asc(categories.isSystem), asc(categories.createdAt));
  return rows.map((row) => toCategory(row.category, row.hiddenId !== null));
}

/** `archived`: the wallet's archived categories instead of the active ones (system rows never archive). */
export async function listCategories(userId: string, walletId: string, archived: boolean): Promise<CommandResult<Category[]>> {
  return runCommand(async (tx) => {
    await requireRole(tx, walletId, userId, "view");
    return selectCategories(
      tx,
      walletId,
      archived ? and(isNotNull(categories.archivedAt), eq(categories.walletId, walletId)) : isNull(categories.archivedAt),
    );
  });
}

async function categoryById(tx: Tx, walletId: string, categoryId: string): Promise<Category> {
  const [category] = await selectCategories(tx, walletId, eq(categories.id, categoryId));
  if (!category) throw new CommandError("notFound");
  return category;
}

/**
 * A category a write in this wallet may point at: a system one or the
 * wallet's own, not archived. Shared with the transaction commands.
 */
export async function usableCategory(tx: Tx, walletId: string, categoryId: string): Promise<CategoryRow> {
  const [row] = await tx
    .select()
    .from(categories)
    .where(
      and(
        eq(categories.id, categoryId),
        or(isNull(categories.walletId), eq(categories.walletId, walletId)),
        isNull(categories.archivedAt),
      ),
    )
    .limit(1);
  if (!row) throw new CommandError("invalidInput");
  return row;
}

/** The wallet's own category, locked for update. System categories answer `forbidden`. */
async function loadOwn(tx: Tx, walletId: string, categoryId: string, archived: boolean): Promise<CategoryRow> {
  const [row] = await tx
    .select()
    .from(categories)
    .where(and(eq(categories.id, categoryId), or(isNull(categories.walletId), eq(categories.walletId, walletId))))
    .for("update")
    .limit(1);
  if (!row) throw new CommandError("notFound");
  if (row.isSystem) throw new CommandError("forbidden");
  if ((row.archivedAt !== null) !== archived) throw new CommandError("notFound");
  return row;
}

async function replay(tx: Tx, actor: Actor, mutationId: string, walletId: string, categoryId: string): Promise<Category | null> {
  const applied = await findApplied(tx, mutationId, actor.userId);
  if (applied === "foreign") throw new CommandError("invalidInput");
  if (applied === "new") return null;
  await requireRole(tx, walletId, actor.userId, "view");
  return categoryById(tx, walletId, categoryId);
}

export async function createCategory(actor: Actor, walletId: string, input: CreateCategoryInput): Promise<CommandResult<Category>> {
  return runCommand(async (tx) => {
    const replayed = await replay(tx, actor, input.mutationId, walletId, input.id);
    if (replayed) return replayed;
    await requireRole(tx, walletId, actor.userId, "editEntries");
    const [taken] = await tx.select({ id: categories.id }).from(categories).where(eq(categories.id, input.id)).limit(1);
    if (taken) throw new CommandError("invalidInput");
    if (input.parentId) {
      const parent = await usableCategory(tx, walletId, input.parentId);
      // Two levels at most, and a child has its parent's kind.
      if (parent.parentId !== null || parent.kind !== input.kind) throw new CommandError("invalidInput");
    }

    await tx.insert(categories).values({
      id: input.id,
      walletId,
      parentId: input.parentId ?? null,
      name: input.name,
      kind: input.kind,
      icon: input.icon,
      color: input.color,
      createdBy: actor.userId,
      updatedBy: actor.userId,
    });
    await recordMutation(
      tx,
      actor,
      { mutationId: input.mutationId },
      {
        walletId,
        entity: "categories",
        entityId: input.id,
        op: "CREATE",
        action: "CREATE",
        changes: diff(
          {},
          { name: input.name, kind: input.kind, parent_id: input.parentId ?? undefined, icon: input.icon, color: input.color },
        ),
      },
    );
    return categoryById(tx, walletId, input.id);
  });
}

/** Name, icon and color are free text: the last write wins. */
export async function updateCategory(
  actor: Actor,
  walletId: string,
  categoryId: string,
  input: UpdateCategoryInput,
): Promise<CommandResult<Category>> {
  return runCommand(async (tx) => {
    const replayed = await replay(tx, actor, input.mutationId, walletId, categoryId);
    if (replayed) return replayed;
    await requireRole(tx, walletId, actor.userId, "editEntries");
    const row = await loadOwn(tx, walletId, categoryId, false);
    const changes = diff(
      { name: row.name, icon: row.icon, color: row.color },
      { name: input.name, icon: input.icon, color: input.color },
    );
    if (Object.keys(changes).length === 0) return categoryById(tx, walletId, categoryId);

    await tx
      .update(categories)
      .set({
        name: input.name ?? row.name,
        icon: input.icon ?? row.icon,
        color: input.color ?? row.color,
        version: sql`${categories.version} + 1`,
        updatedAt: sql`now()`,
        updatedBy: actor.userId,
      })
      .where(eq(categories.id, categoryId));
    await recordMutation(
      tx,
      actor,
      { mutationId: input.mutationId, baseVersion: input.baseVersion },
      { walletId, entity: "categories", entityId: categoryId, op: "UPDATE", action: "UPDATE", changes },
    );
    return categoryById(tx, walletId, categoryId);
  });
}

/** Archiving a category archives its subcategories too; transactions keep pointing at them. */
export async function archiveCategory(
  actor: Actor,
  walletId: string,
  categoryId: string,
  input: CategoryStateInput,
): Promise<CommandResult<Category>> {
  return runCommand(async (tx) => {
    const replayed = await replay(tx, actor, input.mutationId, walletId, categoryId);
    if (replayed) return replayed;
    await requireRole(tx, walletId, actor.userId, "deleteEntries");
    await loadOwn(tx, walletId, categoryId, false);

    const archived = await tx
      .update(categories)
      .set({
        archivedAt: sql`now()`,
        archivedBy: actor.userId,
        version: sql`${categories.version} + 1`,
        updatedAt: sql`now()`,
        updatedBy: actor.userId,
      })
      .where(
        and(
          eq(categories.walletId, walletId),
          isNull(categories.archivedAt),
          or(eq(categories.id, categoryId), eq(categories.parentId, categoryId)),
        ),
      )
      .returning({ id: categories.id });
    const children: Change[] = archived
      .filter(({ id }) => id !== categoryId)
      .map(({ id }) => ({
        walletId,
        entity: "categories",
        entityId: id,
        op: "ARCHIVE",
        action: "ARCHIVE",
        changes: diff({ archived: false }, { archived: true }),
      }));
    await recordMutation(
      tx,
      actor,
      { mutationId: input.mutationId, baseVersion: input.baseVersion },
      {
        walletId,
        entity: "categories",
        entityId: categoryId,
        op: "ARCHIVE",
        action: "ARCHIVE",
        changes: diff({ archived: false }, { archived: true }),
      },
      children,
    );
    return categoryById(tx, walletId, categoryId);
  });
}

/** A subcategory can only come back while its parent is active. */
export async function restoreCategory(
  actor: Actor,
  walletId: string,
  categoryId: string,
  input: CategoryStateInput,
): Promise<CommandResult<Category>> {
  return runCommand(async (tx) => {
    const replayed = await replay(tx, actor, input.mutationId, walletId, categoryId);
    if (replayed) return replayed;
    await requireRole(tx, walletId, actor.userId, "editEntries");
    const row = await loadOwn(tx, walletId, categoryId, true);
    if (row.parentId) await usableCategory(tx, walletId, row.parentId);

    await tx
      .update(categories)
      .set({
        archivedAt: null,
        archivedBy: null,
        version: sql`${categories.version} + 1`,
        updatedAt: sql`now()`,
        updatedBy: actor.userId,
      })
      .where(eq(categories.id, categoryId));
    await recordMutation(
      tx,
      actor,
      { mutationId: input.mutationId, baseVersion: input.baseVersion },
      {
        walletId,
        entity: "categories",
        entityId: categoryId,
        op: "RESTORE",
        action: "RESTORE",
        changes: diff({ archived: true }, { archived: false }),
      },
    );
    return categoryById(tx, walletId, categoryId);
  });
}

/**
 * Hides or shows a system category in this wallet. The `hidden_categories`
 * row has a deterministic ID, so hiding again restores the same row and two
 * offline devices never create two.
 */
export async function setCategoryHidden(
  actor: Actor,
  walletId: string,
  categoryId: string,
  hidden: boolean,
  input: CategoryVisibilityInput,
): Promise<CommandResult<Category>> {
  return runCommand(async (tx) => {
    const replayed = await replay(tx, actor, input.mutationId, walletId, categoryId);
    if (replayed) return replayed;
    await requireRole(tx, walletId, actor.userId, "editEntries");
    const category = await categoryById(tx, walletId, categoryId);
    if (!category.isSystem) throw new CommandError("forbidden");
    if (category.hidden === hidden) return category;

    const rowId = deterministicId("hidden_category", walletId, categoryId);
    const [existing] = await tx.select().from(hiddenCategories).where(eq(hiddenCategories.id, rowId)).limit(1);
    if (!existing) {
      await tx.insert(hiddenCategories).values({ id: rowId, walletId, categoryId, createdBy: actor.userId, updatedBy: actor.userId });
    } else {
      await tx
        .update(hiddenCategories)
        .set({
          archivedAt: hidden ? null : sql`now()`,
          archivedBy: hidden ? null : actor.userId,
          version: sql`${hiddenCategories.version} + 1`,
          updatedAt: sql`now()`,
          updatedBy: actor.userId,
        })
        .where(eq(hiddenCategories.id, rowId));
    }
    await recordMutation(
      tx,
      actor,
      { mutationId: input.mutationId },
      {
        walletId,
        entity: "hidden_categories",
        entityId: rowId,
        op: !existing ? "CREATE" : hidden ? "RESTORE" : "ARCHIVE",
        action: hidden ? "CATEGORY_HIDDEN" : "CATEGORY_SHOWN",
        changes: diff({ category_id: null, hidden: !hidden }, { category_id: categoryId, hidden }),
      },
    );
    return categoryById(tx, walletId, categoryId);
  });
}
