import "server-only";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { newId } from "@packages/shared/ids";
import { can, type WalletAction, type WalletRole } from "@packages/shared/roles";
import { securityEvents, userCredentials, walletMembers, wallets } from "@packages/shared/db/schema";
import type {
  ArchiveWalletInput,
  CreateWalletInput,
  UpdateWalletInput,
  Wallet,
  WalletError,
} from "@packages/shared/wallets";
import { verifyPassword } from "@/lib/server/auth/password";
import { hitRateLimit } from "@/lib/server/auth/rate-limit";
import { getDb } from "@/lib/server/db";
import { diff, findApplied, recordMutation, type Actor, type Tx } from "@/lib/server/write";

/**
 * Wallet commands (wiki/decisoes/0002). Each one checks the member's role on
 * every call (roles never live in the session) and writes through
 * `recordMutation`, so it is idempotent and audited.
 */

export type WalletResult<T> = { ok: true; value: T } | { ok: false; error: WalletError; retryAfterSeconds?: number };

const fail = (error: WalletError, retryAfterSeconds?: number): { ok: false; error: WalletError; retryAfterSeconds?: number } => ({
  ok: false,
  error,
  retryAfterSeconds,
});

/** Thrown inside a transaction to roll it back and answer with a code. */
class CommandError extends Error {
  constructor(readonly code: WalletError) {
    super(code);
  }
}

const walletColumns = {
  id: wallets.id,
  name: wallets.name,
  currencyCode: wallets.currencyCode,
  currencyLockedAt: wallets.currencyLockedAt,
  version: wallets.version,
  role: walletMembers.role,
};

type WalletRow = { id: string; name: string; currencyCode: string; currencyLockedAt: Date | null; version: number; role: WalletRole };

function toWallet(row: WalletRow): Wallet {
  return {
    id: row.id,
    name: row.name,
    currencyCode: row.currencyCode as Wallet["currencyCode"],
    currencyLocked: row.currencyLockedAt !== null,
    role: row.role,
    version: row.version,
  };
}

/** Active wallets where the user is an active member, oldest first. */
export async function listWallets(userId: string): Promise<Wallet[]> {
  const rows = await getDb()
    .select(walletColumns)
    .from(walletMembers)
    .innerJoin(wallets, eq(wallets.id, walletMembers.walletId))
    .where(and(eq(walletMembers.userId, userId), isNull(walletMembers.removedAt), isNull(wallets.archivedAt)))
    .orderBy(asc(wallets.createdAt));
  return rows.map(toWallet);
}

/** The wallet and the user's role, locked for update; fails when absent, archived or not a member. */
async function loadForWrite(tx: Tx, walletId: string, userId: string, action: WalletAction): Promise<WalletRow> {
  const [row] = await tx
    .select(walletColumns)
    .from(wallets)
    .innerJoin(
      walletMembers,
      and(eq(walletMembers.walletId, wallets.id), eq(walletMembers.userId, userId), isNull(walletMembers.removedAt)),
    )
    .where(and(eq(wallets.id, walletId), isNull(wallets.archivedAt)))
    .for("update", { of: wallets })
    .limit(1);
  // Not a member and missing look the same: no hint that the wallet exists.
  if (!row) throw new CommandError("notFound");
  if (!can(row.role, action)) throw new CommandError("forbidden");
  return row;
}

async function current(tx: Tx, walletId: string, userId: string): Promise<Wallet | null> {
  const [row] = await tx
    .select(walletColumns)
    .from(wallets)
    .innerJoin(walletMembers, and(eq(walletMembers.walletId, wallets.id), eq(walletMembers.userId, userId)))
    .where(eq(wallets.id, walletId))
    .limit(1);
  return row ? toWallet(row) : null;
}

/** Runs a command in one transaction, turning CommandError into a result. */
async function run<T>(body: (tx: Tx) => Promise<T>): Promise<WalletResult<T>> {
  try {
    return { ok: true, value: await getDb().transaction(body) };
  } catch (error) {
    if (error instanceof CommandError) return fail(error.code);
    throw error;
  }
}

export async function createWallet(actor: Actor, input: CreateWalletInput): Promise<WalletResult<Wallet>> {
  return run(async (tx) => {
    const applied = await findApplied(tx, input.mutationId, actor.userId);
    if (applied === "foreign") throw new CommandError("invalidInput");
    if (applied === "applied") {
      const wallet = await current(tx, input.id, actor.userId);
      if (!wallet) throw new CommandError("notFound");
      return wallet;
    }
    const [taken] = await tx.select({ id: wallets.id }).from(wallets).where(eq(wallets.id, input.id)).limit(1);
    if (taken) throw new CommandError("invalidInput");

    await tx.insert(wallets).values({
      id: input.id,
      name: input.name,
      currencyCode: input.currencyCode,
      createdBy: actor.userId,
      updatedBy: actor.userId,
    });
    const memberId = newId();
    await tx.insert(walletMembers).values({
      id: memberId,
      walletId: input.id,
      userId: actor.userId,
      role: "OWNER",
      createdBy: actor.userId,
      updatedBy: actor.userId,
    });
    await recordMutation(
      tx,
      actor,
      { mutationId: input.mutationId },
      {
        walletId: input.id,
        entity: "wallets",
        entityId: input.id,
        op: "CREATE",
        action: "CREATE",
        changes: diff({}, { name: input.name, currency_code: input.currencyCode }),
      },
      [
        {
          walletId: input.id,
          entity: "wallet_members",
          entityId: memberId,
          op: "CREATE",
          action: "MEMBER_JOINED",
          changes: diff({}, { user_id: actor.userId, role: "OWNER" }),
        },
      ],
    );
    return toWallet({ id: input.id, name: input.name, currencyCode: input.currencyCode, currencyLockedAt: null, version: 1, role: "OWNER" });
  });
}

/**
 * Rename and change currency. The name is free text: the last write wins and
 * the overwritten value stays in the audit log. The currency is critical: it
 * can only change before the first entry, and only from the latest version.
 */
export async function updateWallet(actor: Actor, walletId: string, input: UpdateWalletInput): Promise<WalletResult<Wallet>> {
  return run(async (tx) => {
    const applied = await findApplied(tx, input.mutationId, actor.userId);
    if (applied === "foreign") throw new CommandError("invalidInput");
    if (applied === "applied") {
      const wallet = await current(tx, walletId, actor.userId);
      if (!wallet) throw new CommandError("notFound");
      return wallet;
    }

    const row = await loadForWrite(tx, walletId, actor.userId, "editWallet");
    const changes = diff({ name: row.name, currency_code: row.currencyCode }, { name: input.name, currency_code: input.currencyCode });
    if (changes.currency_code) {
      if (row.currencyLockedAt) throw new CommandError("currencyLocked");
      if (input.baseVersion !== row.version) throw new CommandError("versionConflict");
    }
    if (Object.keys(changes).length === 0) return toWallet(row);

    const [updated] = await tx
      .update(wallets)
      .set({
        name: input.name ?? row.name,
        currencyCode: input.currencyCode ?? row.currencyCode,
        version: sql`${wallets.version} + 1`,
        updatedAt: sql`now()`,
        updatedBy: actor.userId,
      })
      .where(eq(wallets.id, walletId))
      .returning({ version: wallets.version });
    await recordMutation(
      tx,
      actor,
      { mutationId: input.mutationId, baseVersion: input.baseVersion },
      { walletId, entity: "wallets", entityId: walletId, op: "UPDATE", action: "UPDATE", changes },
    );
    return toWallet({
      ...row,
      name: input.name ?? row.name,
      currencyCode: input.currencyCode ?? row.currencyCode,
      version: updated.version,
    });
  });
}

/** OWNER only, with the password again. Archived wallets keep their data and history. */
export async function archiveWallet(
  actor: Actor,
  walletId: string,
  input: ArchiveWalletInput,
  meta: { ip: string | null; userAgent: string | null },
): Promise<WalletResult<null>> {
  const limit = await hitRateLimit("stepUpByUser", actor.userId);
  if (!limit.allowed) return fail("rateLimited", limit.retryAfterSeconds);

  const db = getDb();
  const [credentials] = await db.select().from(userCredentials).where(eq(userCredentials.userId, actor.userId)).limit(1);
  const check = credentials
    ? await verifyPassword({ hash: credentials.passwordHash, pepperVersion: credentials.pepperVersion }, input.password)
    : { ok: false };
  if (!check.ok) {
    await db
      .insert(securityEvents)
      .values({ userId: actor.userId, type: "STEP_UP_FAILED", ip: meta.ip, userAgent: meta.userAgent, metadata: { walletId } });
    return fail("invalidCredentials");
  }

  return run(async (tx) => {
    const applied = await findApplied(tx, input.mutationId, actor.userId);
    if (applied === "foreign") throw new CommandError("invalidInput");
    if (applied === "applied") return null;

    await loadForWrite(tx, walletId, actor.userId, "archiveWallet");
    await tx
      .update(wallets)
      .set({
        archivedAt: sql`now()`,
        archivedBy: actor.userId,
        version: sql`${wallets.version} + 1`,
        updatedAt: sql`now()`,
        updatedBy: actor.userId,
      })
      .where(eq(wallets.id, walletId));
    await recordMutation(
      tx,
      actor,
      { mutationId: input.mutationId, baseVersion: input.baseVersion },
      {
        walletId,
        entity: "wallets",
        entityId: walletId,
        op: "ARCHIVE",
        action: "ARCHIVE",
        changes: diff({ archived: false }, { archived: true }),
      },
    );
    return null;
  });
}
