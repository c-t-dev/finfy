import "server-only";
import { signedAmount } from "./account-balance";
import { and, asc, desc, eq, isNotNull, isNull, ne, sql, type SQL } from "drizzle-orm";
import type {
  Account,
  AccountColor,
  AccountStateInput,
  CreateAccountInput,
  UpdateAccountInput,
} from "@packages/shared/accounts";
import { accounts, transactions, wallets } from "@packages/shared/db/schema";
import type { AccountType } from "@packages/shared/finance";
import { CommandError, requireRole, runCommand, type CommandResult } from "@/lib/server/commands";
import { getDb } from "@/lib/server/db";
import { diff, findApplied, recordMutation, type Actor, type Change, type Tx } from "@/lib/server/write";

/**
 * Account commands (wiki/finfy/data-model.md). Permissions follow the matrix
 * in wiki/decisoes/0002: OWNER, ADMIN and EDITOR create, edit and archive;
 * VIEWER only reads. The balance is derived, never stored.
 */

const movements = {
  accountId: transactions.accountId,
  total: sql<string>`coalesce(sum(${signedAmount}), 0)`.as("total"),
};

type AccountRow = typeof accounts.$inferSelect;

function toAccount(row: AccountRow, movementsMinor: number): Account {
  return {
    id: row.id,
    walletId: row.walletId,
    name: row.name,
    type: row.type,
    initialBalanceMinor: row.initialBalanceMinor,
    balanceMinor: row.initialBalanceMinor + movementsMinor,
    color: (row.color ?? "blue") as AccountColor,
    isDefault: row.isDefault,
    archived: row.archivedAt !== null,
    version: row.version,
  };
}

async function selectAccounts(db: Tx | ReturnType<typeof getDb>, where: SQL | undefined): Promise<Account[]> {
  const sums = db
    .select(movements)
    .from(transactions)
    .where(and(eq(transactions.status, "PAID"), isNull(transactions.archivedAt), isNotNull(transactions.accountId)))
    .groupBy(transactions.accountId)
    .as("sums");
  const rows = await db
    .select({ account: accounts, total: sums.total })
    .from(accounts)
    .leftJoin(sums, eq(sums.accountId, accounts.id))
    .where(where)
    .orderBy(desc(accounts.isDefault), asc(accounts.createdAt));
  return rows.map((row) => toAccount(row.account, Number(row.total ?? 0)));
}

export async function listAccounts(userId: string, walletId: string, archived: boolean): Promise<CommandResult<Account[]>> {
  return runCommand(async (tx) => {
    await requireRole(tx, walletId, userId, "view");
    return selectAccounts(
      tx,
      and(eq(accounts.walletId, walletId), archived ? isNotNull(accounts.archivedAt) : isNull(accounts.archivedAt)),
    );
  });
}

async function accountById(tx: Tx, walletId: string, accountId: string): Promise<Account> {
  const [account] = await selectAccounts(tx, and(eq(accounts.walletId, walletId), eq(accounts.id, accountId)));
  if (!account) throw new CommandError("notFound");
  return account;
}

/** The account locked for update, in this wallet, active or archived as asked. */
async function loadForWrite(tx: Tx, walletId: string, accountId: string, archived: boolean): Promise<AccountRow> {
  const [row] = await tx
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.walletId, walletId),
        eq(accounts.id, accountId),
        archived ? isNotNull(accounts.archivedAt) : isNull(accounts.archivedAt),
      ),
    )
    .for("update")
    .limit(1);
  if (!row) throw new CommandError("notFound");
  return row;
}

/** Unsets the current main account (other than `exceptId`), returning the audit change. */
async function clearDefault(tx: Tx, actor: Actor, walletId: string, exceptId: string): Promise<Change[]> {
  const cleared = await tx
    .update(accounts)
    .set({ isDefault: false, version: sql`${accounts.version} + 1`, updatedAt: sql`now()`, updatedBy: actor.userId })
    .where(and(eq(accounts.walletId, walletId), eq(accounts.isDefault, true), ne(accounts.id, exceptId)))
    .returning({ id: accounts.id });
  return cleared.map(({ id }) => ({
    walletId,
    entity: "accounts",
    entityId: id,
    op: "UPDATE" as const,
    action: "UPDATE",
    changes: diff({ is_default: true }, { is_default: false }),
  }));
}

/**
 * Money now exists in the wallet's currency, so it can no longer change
 * (wiki/decisoes/0001). Returns the audit change when it was not locked yet.
 */
export async function lockCurrency(tx: Tx, actor: Actor, walletId: string): Promise<Change[]> {
  const locked = await tx
    .update(wallets)
    .set({ currencyLockedAt: sql`now()`, version: sql`${wallets.version} + 1`, updatedAt: sql`now()`, updatedBy: actor.userId })
    .where(and(eq(wallets.id, walletId), isNull(wallets.currencyLockedAt)))
    .returning({ id: wallets.id });
  return locked.map(() => ({
    walletId,
    entity: "wallets",
    entityId: walletId,
    op: "UPDATE" as const,
    action: "CURRENCY_LOCKED",
    changes: diff({ currency_locked: false }, { currency_locked: true }),
  }));
}

/** A retry of an applied mutation answers with the current state. */
async function replay(tx: Tx, actor: Actor, mutationId: string, walletId: string, accountId: string): Promise<Account | null> {
  const applied = await findApplied(tx, mutationId, actor.userId);
  if (applied === "foreign") throw new CommandError("invalidInput");
  if (applied === "new") return null;
  await requireRole(tx, walletId, actor.userId, "view");
  return accountById(tx, walletId, accountId);
}

export async function createAccount(actor: Actor, walletId: string, input: CreateAccountInput): Promise<CommandResult<Account>> {
  return runCommand(async (tx) => {
    const replayed = await replay(tx, actor, input.mutationId, walletId, input.id);
    if (replayed) return replayed;
    await requireRole(tx, walletId, actor.userId, "editEntries");
    const [taken] = await tx.select({ id: accounts.id }).from(accounts).where(eq(accounts.id, input.id)).limit(1);
    if (taken) throw new CommandError("invalidInput");

    // The first account is the main one; asking for it moves the mark here.
    const [currentDefault] = await tx
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.walletId, walletId), eq(accounts.isDefault, true), isNull(accounts.archivedAt)))
      .limit(1);
    const isDefault = input.isDefault === true || !currentDefault;
    const extra = isDefault ? await clearDefault(tx, actor, walletId, input.id) : [];

    await tx.insert(accounts).values({
      id: input.id,
      walletId,
      name: input.name,
      type: input.type,
      initialBalanceMinor: input.initialBalanceMinor,
      color: input.color,
      isDefault,
      createdBy: actor.userId,
      updatedBy: actor.userId,
    });
    if (input.initialBalanceMinor !== 0) extra.push(...(await lockCurrency(tx, actor, walletId)));

    await recordMutation(
      tx,
      actor,
      { mutationId: input.mutationId },
      {
        walletId,
        entity: "accounts",
        entityId: input.id,
        op: "CREATE",
        action: "CREATE",
        changes: diff(
          {},
          {
            name: input.name,
            type: input.type,
            initial_balance_minor: input.initialBalanceMinor,
            color: input.color,
            is_default: isDefault,
          },
        ),
      },
      extra,
    );
    return accountById(tx, walletId, input.id);
  });
}

/**
 * Name and color are free text: the last write wins and the old value stays
 * in the audit log. Type and initial balance change money, so they only
 * change from the latest version (`versionConflict` otherwise).
 */
export async function updateAccount(
  actor: Actor,
  walletId: string,
  accountId: string,
  input: UpdateAccountInput,
): Promise<CommandResult<Account>> {
  return runCommand(async (tx) => {
    const replayed = await replay(tx, actor, input.mutationId, walletId, accountId);
    if (replayed) return replayed;
    await requireRole(tx, walletId, actor.userId, "editEntries");
    const row = await loadForWrite(tx, walletId, accountId, false);

    const changes = diff(
      {
        name: row.name,
        type: row.type,
        initial_balance_minor: row.initialBalanceMinor,
        color: row.color,
        is_default: row.isDefault,
      },
      {
        name: input.name,
        type: input.type,
        initial_balance_minor: input.initialBalanceMinor,
        color: input.color,
        is_default: input.isDefault,
      },
    );
    if ((changes.type || changes.initial_balance_minor) && input.baseVersion !== row.version) {
      throw new CommandError("versionConflict");
    }
    if (Object.keys(changes).length === 0) return accountById(tx, walletId, accountId);

    const extra = changes.is_default ? await clearDefault(tx, actor, walletId, accountId) : [];
    await tx
      .update(accounts)
      .set({
        name: input.name ?? row.name,
        type: (input.type ?? row.type) as AccountType,
        initialBalanceMinor: input.initialBalanceMinor ?? row.initialBalanceMinor,
        color: input.color ?? row.color,
        isDefault: input.isDefault ?? row.isDefault,
        version: sql`${accounts.version} + 1`,
        updatedAt: sql`now()`,
        updatedBy: actor.userId,
      })
      .where(eq(accounts.id, accountId));
    if (changes.initial_balance_minor && input.initialBalanceMinor !== 0) {
      extra.push(...(await lockCurrency(tx, actor, walletId)));
    }

    await recordMutation(
      tx,
      actor,
      { mutationId: input.mutationId, baseVersion: input.baseVersion },
      { walletId, entity: "accounts", entityId: accountId, op: "UPDATE", action: "UPDATE", changes },
      extra,
    );
    return accountById(tx, walletId, accountId);
  });
}

/** Archived accounts keep their transactions. If it was the main one, the oldest active account takes over. */
export async function archiveAccount(
  actor: Actor,
  walletId: string,
  accountId: string,
  input: AccountStateInput,
): Promise<CommandResult<Account>> {
  return runCommand(async (tx) => {
    const replayed = await replay(tx, actor, input.mutationId, walletId, accountId);
    if (replayed) return replayed;
    await requireRole(tx, walletId, actor.userId, "deleteEntries");
    const row = await loadForWrite(tx, walletId, accountId, false);

    await tx
      .update(accounts)
      .set({
        archivedAt: sql`now()`,
        archivedBy: actor.userId,
        isDefault: false,
        version: sql`${accounts.version} + 1`,
        updatedAt: sql`now()`,
        updatedBy: actor.userId,
      })
      .where(eq(accounts.id, accountId));

    const extra: Change[] = [];
    if (row.isDefault) {
      const [next] = await tx
        .select({ id: accounts.id })
        .from(accounts)
        .where(and(eq(accounts.walletId, walletId), isNull(accounts.archivedAt)))
        .orderBy(asc(accounts.createdAt))
        .limit(1);
      if (next) {
        await tx
          .update(accounts)
          .set({ isDefault: true, version: sql`${accounts.version} + 1`, updatedAt: sql`now()`, updatedBy: actor.userId })
          .where(eq(accounts.id, next.id));
        extra.push({
          walletId,
          entity: "accounts",
          entityId: next.id,
          op: "UPDATE",
          action: "UPDATE",
          changes: diff({ is_default: false }, { is_default: true }),
        });
      }
    }

    await recordMutation(
      tx,
      actor,
      { mutationId: input.mutationId, baseVersion: input.baseVersion },
      {
        walletId,
        entity: "accounts",
        entityId: accountId,
        op: "ARCHIVE",
        action: "ARCHIVE",
        changes: diff({ archived: false, is_default: row.isDefault }, { archived: true, is_default: false }),
      },
      extra,
    );
    return accountById(tx, walletId, accountId);
  });
}

/** Brings an archived account back; it becomes the main one if the wallet has none. */
export async function restoreAccount(
  actor: Actor,
  walletId: string,
  accountId: string,
  input: AccountStateInput,
): Promise<CommandResult<Account>> {
  return runCommand(async (tx) => {
    const replayed = await replay(tx, actor, input.mutationId, walletId, accountId);
    if (replayed) return replayed;
    await requireRole(tx, walletId, actor.userId, "editEntries");
    await loadForWrite(tx, walletId, accountId, true);

    const [currentDefault] = await tx
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.walletId, walletId), eq(accounts.isDefault, true), isNull(accounts.archivedAt)))
      .limit(1);
    await tx
      .update(accounts)
      .set({
        archivedAt: null,
        archivedBy: null,
        isDefault: !currentDefault,
        version: sql`${accounts.version} + 1`,
        updatedAt: sql`now()`,
        updatedBy: actor.userId,
      })
      .where(eq(accounts.id, accountId));

    await recordMutation(
      tx,
      actor,
      { mutationId: input.mutationId, baseVersion: input.baseVersion },
      {
        walletId,
        entity: "accounts",
        entityId: accountId,
        op: "RESTORE",
        action: "RESTORE",
        changes: diff({ archived: true, is_default: false }, { archived: false, is_default: !currentDefault }),
      },
    );
    return accountById(tx, walletId, accountId);
  });
}
