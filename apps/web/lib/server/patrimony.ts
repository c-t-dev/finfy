import "server-only";
import { and, asc, eq, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import { accounts, assetLiabilities, assets, creditCardInvoices, transactions } from "@packages/shared/db/schema";
import { deterministicId } from "@packages/shared/ids";
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
import { diff, findApplied, recordMutation, type Actor, type Change, type Tx } from "@/lib/server/write";

/**
 * Patrimony (wiki/finfy/data-model.md). Values are estimates the user types,
 * so value fields are last-write-wins; relationship replacement checks version.
 * Net worth follows the data model:
 * accounts + assets − liabilities − unpaid card purchases, by ownership share.
 */

type AssetRow = typeof assets.$inferSelect;
const now = sql`now()`;

const toAsset = (row: AssetRow, linkedIds: string[] = []): Asset => ({
  linkedIds,
  linkedAssets: [],
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
    return hydrateAssets(tx, walletId, rows);
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
  return (await hydrateAssets(tx, walletId, [row]))[0];
}

/** Batch relationship context, including archived peers, without multiplying list queries. */
async function hydrateAssets(tx: Tx, walletId: string, rows: AssetRow[]): Promise<Asset[]> {
  if (!rows.length) return [];
  const ids = rows.map((row) => row.id);
  const links = await tx.select().from(assetLiabilities).where(and(
    eq(assetLiabilities.walletId, walletId), isNull(assetLiabilities.archivedAt),
    or(inArray(assetLiabilities.assetId, ids), inArray(assetLiabilities.liabilityId, ids)),
  ));
  const peerIds = [...new Set(links.flatMap((link) => [link.assetId, link.liabilityId]))];
  const peers = peerIds.length ? await tx.select().from(assets).where(and(eq(assets.walletId, walletId), inArray(assets.id, peerIds))) : [];
  const byId = new Map(peers.map((peer) => [peer.id, peer]));
  return rows.map((row) => {
    const linkedIds = links.filter((link) => link.assetId === row.id || link.liabilityId === row.id)
      .map((link) => link.assetId === row.id ? link.liabilityId : link.assetId).sort();
    const linkedAssets = linkedIds.flatMap((id) => {
      const peer = byId.get(id);
      return peer ? [{ id: peer.id, name: peer.name, currentValueMinor: peer.currentValueMinor, ownershipBps: peer.ownershipBps, archived: peer.archivedAt !== null }] : [];
    });
    return { ...toAsset(row, linkedIds), linkedAssets };
  });
}

/** Serialize relationship edits from either endpoint and endpoint archive operations. */
async function lockLinks(tx: Tx, walletId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${walletId}, 1))`);
}

async function replaceLinks(tx: Tx, actor: Actor, walletId: string, row: AssetRow, ids: string[]): Promise<Change[]> {
  const previous = await byId(tx, walletId, row.id);
  for (const id of [...ids].sort()) {
    if (previous.linkedAssets.some((peer) => peer.id === id && peer.archived)) continue;
    const target = await loadAsset(tx, walletId, id);
    if (target.kind === row.kind) throw new CommandError("invalidInput");
  }
  const existing = await tx.select().from(assetLiabilities).where(and(eq(assetLiabilities.walletId, walletId), or(eq(assetLiabilities.assetId, row.id), eq(assetLiabilities.liabilityId, row.id))));
  const changes: Change[] = [];
  for (const link of existing) {
    const other = link.assetId === row.id ? link.liabilityId : link.assetId;
    const active = ids.includes(other);
    if (active === (link.archivedAt === null)) continue;
    await tx.update(assetLiabilities).set({ archivedAt: active ? null : now, archivedBy: active ? null : actor.userId, updatedAt: now, updatedBy: actor.userId, version: sql`${assetLiabilities.version} + 1` }).where(eq(assetLiabilities.id, link.id));
    changes.push({ walletId, entity: "asset_liabilities", entityId: link.id, op: active ? "RESTORE" : "ARCHIVE", action: active ? "RESTORE" : "ARCHIVE", changes: diff({ archived: active }, { archived: !active }) });
  }
  for (const id of ids) {
    if (existing.some((link) => link.assetId === id || link.liabilityId === id)) continue;
    const assetId = row.kind === "ASSET" ? row.id : id;
    const liabilityId = row.kind === "LIABILITY" ? row.id : id;
    const values = { id: deterministicId("asset_liabilities", assetId, liabilityId), walletId, assetId, liabilityId, createdBy: actor.userId, updatedBy: actor.userId };
    await tx.insert(assetLiabilities).values(values);
    changes.push({ walletId, entity: "asset_liabilities", entityId: values.id, op: "CREATE", action: "CREATE", changes: diff({}, { asset_id: values.assetId, liability_id: values.liabilityId }) });
  }
  for (const id of new Set([...previous.linkedIds, ...ids])) {
    if (previous.linkedIds.includes(id) === ids.includes(id)) continue;
    await tx.update(assets).set({ version: sql`${assets.version} + 1`, updatedAt: now, updatedBy: actor.userId }).where(eq(assets.id, id));
    const peer = await byId(tx, walletId, id);
    const before = ids.includes(id) ? peer.linkedIds.filter((value) => value !== row.id) : [...peer.linkedIds, row.id];
    changes.push({ walletId, entity: "assets", entityId: id, op: "UPDATE", action: "UPDATE", changes: diff({ linked_ids: before }, { linked_ids: peer.linkedIds }) });
  }
  return changes;
}

export async function createAsset(actor: Actor, walletId: string, input: CreateAssetInput): Promise<CommandResult<Asset>> {
  return runCommand(async (tx) => {
    await lockLinks(tx, walletId);
    if (await applied(tx, actor, input.mutationId)) {
      await requireRole(tx, walletId, actor.userId, "view");
      return byId(tx, walletId, input.id);
    }
    await requireRole(tx, walletId, actor.userId, "editEntries");
    const [taken] = await tx.select({ id: assets.id }).from(assets).where(eq(assets.id, input.id)).limit(1);
    if (taken) throw new CommandError("invalidInput");
    const { mutationId: _, linkedIds, ...values } = input;
    const [row] = await tx.insert(assets).values({ ...values, walletId, createdBy: actor.userId, updatedBy: actor.userId }).returning();
    const links = await replaceLinks(tx, actor, walletId, row, linkedIds ?? []);
    await recordMutation(tx, actor, { mutationId: input.mutationId }, {
      walletId,
      entity: "assets",
      entityId: row.id,
      op: "CREATE",
      action: "CREATE",
      changes: diff({}, { kind: input.kind, type: input.type, name: input.name, current_value_minor: input.currentValueMinor, ownership_bps: input.ownershipBps, linked_ids: linkedIds ?? [] }),
    }, links);
    return byId(tx, walletId, row.id);
  });
}

export async function updateAsset(actor: Actor, walletId: string, id: string, input: UpdateAssetInput): Promise<CommandResult<Asset>> {
  return runCommand(async (tx) => {
    await lockLinks(tx, walletId);
    if (await applied(tx, actor, input.mutationId)) {
      await requireRole(tx, walletId, actor.userId, "view");
      return byId(tx, walletId, id);
    }
    await requireRole(tx, walletId, actor.userId, "editEntries");
    const row = await loadAsset(tx, walletId, id);
    if (input.linkedIds && input.baseVersion !== row.version) throw new CommandError("versionConflict");
    const previous = await byId(tx, walletId, id);
    const links = input.linkedIds ? await replaceLinks(tx, actor, walletId, row, input.linkedIds) : [];
    if (input.type && !(TYPES_BY_KIND[row.kind] as readonly string[]).includes(input.type)) throw new CommandError("invalidInput");
    const changes = diff(
      { name: row.name, type: row.type, current_value_minor: row.currentValueMinor, purchase_value_minor: row.purchaseValueMinor, purchase_date: row.purchaseDate, ownership_bps: row.ownershipBps, notes: row.notes },
      { name: input.name, type: input.type, current_value_minor: input.currentValueMinor, purchase_value_minor: input.purchaseValueMinor, purchase_date: input.purchaseDate, ownership_bps: input.ownershipBps, notes: input.notes },
    );
    if (links.length) Object.assign(changes, diff({ linked_ids: previous.linkedIds }, { linked_ids: input.linkedIds }));
    if (!Object.keys(changes).length && !links.length) return byId(tx, walletId, id);
    const { mutationId: _, baseVersion: __, linkedIds: ___, ...values } = input;
    const [updated] = await tx
      .update(assets)
      .set({ ...values, version: sql`${assets.version} + 1`, updatedAt: now, updatedBy: actor.userId })
      .where(eq(assets.id, id))
      .returning();
    await recordMutation(tx, actor, { mutationId: input.mutationId, baseVersion: input.baseVersion }, { walletId, entity: "assets", entityId: id, op: "UPDATE", action: "UPDATE", changes }, links);
    return byId(tx, walletId, updated.id);
  });
}

export async function setAssetArchived(actor: Actor, walletId: string, id: string, archived: boolean, input: AssetStateInput): Promise<CommandResult<Asset>> {
  return runCommand(async (tx) => {
    await lockLinks(tx, walletId);
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
