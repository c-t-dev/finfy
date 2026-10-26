import "server-only";
import { and, asc, eq, isNotNull, isNull, ne, sql } from "drizzle-orm";
import { accounts, assets, creditCardInvoices, transactions } from "@packages/shared/db/schema";
import { BALANCE_SIGN } from "@packages/shared/finance";
import {
  ownedPart,
  TYPES_BY_KIND,
  type Asset,
  type AssetStateInput,
  type CreateAssetInput,
  type NetWorth,
  type UpdateAssetInput,
} from "@packages/shared/patrimony";
import { CommandError, requireRole, runCommand, type CommandResult } from "@/lib/server/commands";
import { diff, findApplied, recordMutation, type Actor, type Tx } from "@/lib/server/write";

/**
 * Patrimony (wiki/finfy/data-model.md). Values are estimates the user types,
 * so every field is last-write-wins. Net worth follows the data model:
 * accounts + assets − liabilities − unpaid card purchases, by ownership share.
 */

type AssetRow = typeof assets.$inferSelect;
const now = sql`now()`;

const toAsset = (row: AssetRow): Asset => ({
  id: row.id,
  kind: row.kind,
  type: row.type,
  name: row.name,
  currentValueMinor: row.currentValueMinor,
  purchaseValueMinor: row.purchaseValueMinor,
  purchaseDate: row.purchaseDate,
  ownershipBps: row.ownershipBps,
  notes: row.notes,
  archived: row.archivedAt !== null,
  version: row.version,
});

async function applied(tx: Tx, actor: Actor, mutationId: string): Promise<boolean> {
  const state = await findApplied(tx, mutationId, actor.userId);
  if (state === "foreign") throw new CommandError("invalidInput");
  return state === "applied";
}

export async function listAssets(userId: string, walletId: string, archived: boolean): Promise<CommandResult<Asset[]>> {
  return runCommand(async (tx) => {
    await requireRole(tx, walletId, userId, "view");
    const rows = await tx
      .select()
      .from(assets)
      .where(and(eq(assets.walletId, walletId), archived ? isNotNull(assets.archivedAt) : isNull(assets.archivedAt)))
      .orderBy(asc(assets.kind), asc(assets.createdAt));
    return rows.map(toAsset);
  });
}

const signed = sql.join(
  [sql`case ${transactions.type}`, ...Object.entries(BALANCE_SIGN).map(([type, sign]) => sql` when ${type} then ${transactions.amountMinor} * ${sql.raw(String(sign))}`), sql` else 0 end`],
  sql``,
);

export async function netWorth(userId: string, walletId: string): Promise<CommandResult<NetWorth>> {
  return runCommand(async (tx) => {
    await requireRole(tx, walletId, userId, "view");
    const [initial] = await tx
      .select({ total: sql<string>`coalesce(sum(${accounts.initialBalanceMinor}), 0)` })
      .from(accounts)
      .where(and(eq(accounts.walletId, walletId), isNull(accounts.archivedAt)));
    const [moved] = await tx
      .select({ total: sql<string>`coalesce(sum(${signed}), 0)` })
      .from(transactions)
      .innerJoin(accounts, eq(accounts.id, transactions.accountId))
      .where(and(eq(transactions.walletId, walletId), eq(transactions.status, "PAID"), isNull(transactions.archivedAt), isNull(accounts.archivedAt)));
    const [cardDebt] = await tx
      .select({ total: sql<string>`coalesce(sum(${transactions.amountMinor}), 0)` })
      .from(transactions)
      .innerJoin(creditCardInvoices, eq(creditCardInvoices.id, transactions.invoiceId))
      .where(
        and(
          eq(transactions.walletId, walletId),
          eq(transactions.type, "CREDIT_CARD_PURCHASE"),
          isNull(transactions.archivedAt),
          ne(transactions.status, "CANCELED"),
          eq(creditCardInvoices.status, "OPEN"),
        ),
      );
    const rows = await tx.select().from(assets).where(and(eq(assets.walletId, walletId), isNull(assets.archivedAt)));
    const owned = (kind: "ASSET" | "LIABILITY") =>
      rows.filter((row) => row.kind === kind).reduce((sum, row) => sum + ownedPart(row.currentValueMinor, row.ownershipBps), 0);
    const accountsMinor = Number(initial.total) + Number(moved.total);
    const assetsMinor = owned("ASSET");
    const liabilitiesMinor = owned("LIABILITY");
    const cardDebtMinor = Number(cardDebt.total);
    return {
      accountsMinor,
      assetsMinor,
      liabilitiesMinor,
      cardDebtMinor,
      netWorthMinor: accountsMinor + assetsMinor - liabilitiesMinor - cardDebtMinor,
    };
  });
}

async function loadAsset(tx: Tx, walletId: string, id: string, archived = false): Promise<AssetRow> {
  const [row] = await tx
    .select()
    .from(assets)
    .where(and(eq(assets.walletId, walletId), eq(assets.id, id), archived ? isNotNull(assets.archivedAt) : isNull(assets.archivedAt)))
    .for("update")
    .limit(1);
  if (!row) throw new CommandError("notFound");
  return row;
}

async function byId(tx: Tx, walletId: string, id: string): Promise<Asset> {
  const [row] = await tx.select().from(assets).where(and(eq(assets.walletId, walletId), eq(assets.id, id))).limit(1);
  if (!row) throw new CommandError("notFound");
  return toAsset(row);
}

export async function createAsset(actor: Actor, walletId: string, input: CreateAssetInput): Promise<CommandResult<Asset>> {
  return runCommand(async (tx) => {
    if (await applied(tx, actor, input.mutationId)) {
      await requireRole(tx, walletId, actor.userId, "view");
      return byId(tx, walletId, input.id);
    }
    await requireRole(tx, walletId, actor.userId, "editEntries");
    const [taken] = await tx.select({ id: assets.id }).from(assets).where(eq(assets.id, input.id)).limit(1);
    if (taken) throw new CommandError("invalidInput");
    const { mutationId: _, ...values } = input;
    const [row] = await tx.insert(assets).values({ ...values, walletId, createdBy: actor.userId, updatedBy: actor.userId }).returning();
    await recordMutation(tx, actor, { mutationId: input.mutationId }, {
      walletId,
      entity: "assets",
      entityId: row.id,
      op: "CREATE",
      action: "CREATE",
      changes: diff({}, { kind: input.kind, type: input.type, name: input.name, current_value_minor: input.currentValueMinor, ownership_bps: input.ownershipBps }),
    });
    return toAsset(row);
  });
}

export async function updateAsset(actor: Actor, walletId: string, id: string, input: UpdateAssetInput): Promise<CommandResult<Asset>> {
  return runCommand(async (tx) => {
    if (await applied(tx, actor, input.mutationId)) {
      await requireRole(tx, walletId, actor.userId, "view");
      return byId(tx, walletId, id);
    }
    await requireRole(tx, walletId, actor.userId, "editEntries");
    const row = await loadAsset(tx, walletId, id);
    if (input.type && !(TYPES_BY_KIND[row.kind] as readonly string[]).includes(input.type)) throw new CommandError("invalidInput");
    const changes = diff(
      { name: row.name, type: row.type, current_value_minor: row.currentValueMinor, purchase_value_minor: row.purchaseValueMinor, purchase_date: row.purchaseDate, ownership_bps: row.ownershipBps, notes: row.notes },
      { name: input.name, type: input.type, current_value_minor: input.currentValueMinor, purchase_value_minor: input.purchaseValueMinor, purchase_date: input.purchaseDate, ownership_bps: input.ownershipBps, notes: input.notes },
    );
    if (!Object.keys(changes).length) return toAsset(row);
    const { mutationId: _, baseVersion: __, ...values } = input;
    const [updated] = await tx
      .update(assets)
      .set({ ...values, version: sql`${assets.version} + 1`, updatedAt: now, updatedBy: actor.userId })
      .where(eq(assets.id, id))
      .returning();
    await recordMutation(tx, actor, { mutationId: input.mutationId, baseVersion: input.baseVersion }, { walletId, entity: "assets", entityId: id, op: "UPDATE", action: "UPDATE", changes });
    return toAsset(updated);
  });
}

export async function setAssetArchived(actor: Actor, walletId: string, id: string, archived: boolean, input: AssetStateInput): Promise<CommandResult<Asset>> {
  return runCommand(async (tx) => {
    if (!(await applied(tx, actor, input.mutationId))) {
      await requireRole(tx, walletId, actor.userId, archived ? "deleteEntries" : "editEntries");
      await loadAsset(tx, walletId, id, !archived);
      await tx
        .update(assets)
        .set({ archivedAt: archived ? now : null, archivedBy: archived ? actor.userId : null, version: sql`${assets.version} + 1`, updatedAt: now, updatedBy: actor.userId })
        .where(eq(assets.id, id));
      await recordMutation(tx, actor, { mutationId: input.mutationId, baseVersion: input.baseVersion }, {
        walletId,
        entity: "assets",
        entityId: id,
        op: archived ? "ARCHIVE" : "RESTORE",
        action: archived ? "ARCHIVE" : "RESTORE",
        changes: diff({ archived: !archived }, { archived }),
      });
    } else {
      await requireRole(tx, walletId, actor.userId, "view");
    }
    return byId(tx, walletId, id);
  });
}
