import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { can, type WalletAction, type WalletRole } from "@packages/shared/roles";
import { walletMembers, wallets } from "@packages/shared/db/schema";
import type { WalletError } from "@packages/shared/wallets";
import { getDb } from "@/lib/server/db";
import type { Tx } from "@/lib/server/write";

/**
 * Shared pieces of the server commands (wallets, accounts and what follows):
 * one transaction per command, errors as stable codes, and the role check
 * that runs on every request (roles never live in the session).
 */

export type CommandResult<T> = { ok: true; value: T } | { ok: false; error: WalletError; retryAfterSeconds?: number };

/** Thrown inside a command's transaction to roll it back and answer with a code. */
export class CommandError extends Error {
  constructor(readonly code: WalletError) {
    super(code);
  }
}

export function fail(error: WalletError, retryAfterSeconds?: number): { ok: false; error: WalletError; retryAfterSeconds?: number } {
  return { ok: false, error, retryAfterSeconds };
}

/** Runs a command in one transaction, turning CommandError into a result. */
export async function runCommand<T>(body: (tx: Tx) => Promise<T>): Promise<CommandResult<T>> {
  try {
    return { ok: true, value: await getDb().transaction(body) };
  } catch (error) {
    if (error instanceof CommandError) return fail(error.code);
    throw error;
  }
}

/**
 * The user's role in an active wallet, checked against `action`. A wallet the
 * user cannot see answers `notFound`, never `forbidden`, so its existence is
 * not revealed.
 */
export async function requireRole(
  tx: Tx | ReturnType<typeof getDb>,
  walletId: string,
  userId: string,
  action: WalletAction,
): Promise<WalletRole> {
  const [row] = await tx
    .select({ role: walletMembers.role })
    .from(walletMembers)
    .innerJoin(wallets, eq(wallets.id, walletMembers.walletId))
    .where(
      and(
        eq(walletMembers.walletId, walletId),
        eq(walletMembers.userId, userId),
        isNull(walletMembers.removedAt),
        isNull(wallets.archivedAt),
      ),
    )
    .limit(1);
  if (!row) throw new CommandError("notFound");
  if (!can(row.role, action)) throw new CommandError("forbidden");
  return row.role;
}
