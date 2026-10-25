import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, asc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { users, walletInvites, walletMembers, wallets } from "@packages/shared/db/schema";
import { newId } from "@packages/shared/ids";
import {
  INVITE_DAYS,
  type ChangeRoleInput,
  type CreateInviteInput,
  type InviteActionInput,
  type InviteLink,
  type InvitePreview,
  type MemberActionInput,
  type Members,
  type PendingInvite,
} from "@packages/shared/members";
import { canChangeRole, canInvite, canRemoveMember, type WalletRole } from "@packages/shared/roles";
import { CommandError, requireRole, runCommand, type CommandResult } from "@/lib/server/commands";
import { getDb } from "@/lib/server/db";
import { diff, findApplied, recordMutation, type Actor, type Change, type Tx } from "@/lib/server/write";

/**
 * Members and invites (wiki/decisoes/0002 and 0003). Without e-mail, an
 * invite is a private link: 32 random bytes, only the SHA-256 stored. To
 * accept, a person needs the link **and** an account with the invited e-mail,
 * so neither a leaked link nor an account registered with someone else's
 * address is enough alone.
 */

const now = sql`now()`;
const bump = (version: AnyPgColumn) => sql`${version} + 1`;
const tokenHash = (token: string) => createHash("sha256").update(token).digest("base64url");

async function applied(tx: Tx, actor: Actor, mutationId: string): Promise<boolean> {
  const state = await findApplied(tx, mutationId, actor.userId);
  if (state === "foreign") throw new CommandError("invalidInput");
  return state === "applied";
}

const pendingInvite = and(isNull(walletInvites.acceptedAt), isNull(walletInvites.declinedAt), isNull(walletInvites.revokedAt));

type InviteRow = typeof walletInvites.$inferSelect;

async function toPending(tx: Tx, rows: InviteRow[]): Promise<PendingInvite[]> {
  const inviterIds = [...new Set(rows.map((row) => row.invitedBy))];
  const inviters = inviterIds.length
    ? await tx.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, inviterIds))
    : [];
  const names = new Map(inviters.map((inviter) => [inviter.id, inviter.name]));
  return rows.map((row) => ({
    id: row.id,
    email: row.invitedEmail,
    role: row.role as PendingInvite["role"],
    invitedByName: names.get(row.invitedBy) ?? "",
    expiresAt: row.expiresAt.toISOString(),
    expired: row.expiresAt.getTime() < Date.now(),
  }));
}

async function membersOf(tx: Tx, walletId: string, userId: string): Promise<Members> {
  const rows = await tx
    .select({ member: walletMembers, name: users.name, email: users.email })
    .from(walletMembers)
    .innerJoin(users, eq(users.id, walletMembers.userId))
    .where(and(eq(walletMembers.walletId, walletId), isNull(walletMembers.removedAt)))
    .orderBy(asc(walletMembers.joinedAt));
  const invites = await tx
    .select()
    .from(walletInvites)
    .where(and(eq(walletInvites.walletId, walletId), pendingInvite))
    .orderBy(asc(walletInvites.createdAt));
  return {
    members: rows.map((row) => ({
      id: row.member.id,
      userId: row.member.userId,
      name: row.name,
      email: row.email,
      role: row.member.role,
      isMe: row.member.userId === userId,
      joinedAt: row.member.joinedAt.toISOString(),
    })),
    invites: await toPending(tx, invites),
  };
}

export async function listMembers(userId: string, walletId: string): Promise<CommandResult<Members>> {
  return runCommand(async (tx) => {
    await requireRole(tx, walletId, userId, "view");
    return membersOf(tx, walletId, userId);
  });
}

/** A fresh token for an invite: returns the token and its hash. */
function newToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: tokenHash(token) };
}

const expiry = () => sql`now() + interval '${sql.raw(String(INVITE_DAYS))} days'`;

/**
 * Invites an e-mail. A pending invite to the same e-mail gets a new link
 * instead of a second invite. The answer is the same whether or not the
 * e-mail has an account.
 */
export async function createInvite(actor: Actor, walletId: string, input: CreateInviteInput): Promise<CommandResult<InviteLink>> {
  return runCommand(async (tx) => {
    // The token is only known at creation, so a retry cannot answer it again.
    if (await applied(tx, actor, input.mutationId)) throw new CommandError("invalidInput");
    const role = await requireRole(tx, walletId, actor.userId, "manageMembers");
    if (!canInvite(role, input.role)) throw new CommandError("forbidden");

    const [member] = await tx
      .select({ id: walletMembers.id })
      .from(walletMembers)
      .innerJoin(users, eq(users.id, walletMembers.userId))
      .where(and(eq(walletMembers.walletId, walletId), isNull(walletMembers.removedAt), eq(users.email, input.email)))
      .limit(1);
    if (member) throw new CommandError("alreadyMember");

    const { token, hash } = newToken();
    const [existing] = await tx
      .select()
      .from(walletInvites)
      .where(and(eq(walletInvites.walletId, walletId), sql`lower(${walletInvites.invitedEmail}) = ${input.email}`, pendingInvite))
      .for("update")
      .limit(1);
    let row: InviteRow;
    let change: Change;
    if (existing) {
      [row] = await tx
        .update(walletInvites)
        .set({ role: input.role, tokenHash: hash, expiresAt: expiry(), invitedBy: actor.userId, lastSentAt: now, sendCount: sql`${walletInvites.sendCount} + 1` })
        .where(eq(walletInvites.id, existing.id))
        .returning();
      change = { walletId, entity: "wallet_invites", entityId: row.id, op: "UPDATE", action: "INVITE_RESENT", changes: diff({ role: existing.role }, { role: input.role }) };
    } else {
      [row] = await tx
        .insert(walletInvites)
        .values({ id: newId(), walletId, invitedEmail: input.email, role: input.role, invitedBy: actor.userId, tokenHash: hash, expiresAt: expiry() })
        .returning();
      change = { walletId, entity: "wallet_invites", entityId: row.id, op: "CREATE", action: "INVITE_SENT", changes: diff({}, { email: input.email, role: input.role }) };
    }
    await recordMutation(tx, actor, { mutationId: input.mutationId }, change);
    const [invite] = await toPending(tx, [row]);
    return { invite, token };
  });
}

async function loadPendingInvite(tx: Tx, walletId: string, inviteId: string): Promise<InviteRow> {
  const [row] = await tx
    .select()
    .from(walletInvites)
    .where(and(eq(walletInvites.walletId, walletId), eq(walletInvites.id, inviteId), pendingInvite))
    .for("update")
    .limit(1);
  if (!row) throw new CommandError("notFound");
  return row;
}

/** A new link for a pending invite; the previous link stops working. */
export async function renewInvite(actor: Actor, walletId: string, inviteId: string, input: InviteActionInput): Promise<CommandResult<InviteLink>> {
  return runCommand(async (tx) => {
    if (await applied(tx, actor, input.mutationId)) throw new CommandError("invalidInput");
    const role = await requireRole(tx, walletId, actor.userId, "manageMembers");
    const existing = await loadPendingInvite(tx, walletId, inviteId);
    if (!canInvite(role, existing.role)) throw new CommandError("forbidden");
    const { token, hash } = newToken();
    const [row] = await tx
      .update(walletInvites)
      .set({ tokenHash: hash, expiresAt: expiry(), lastSentAt: now, sendCount: sql`${walletInvites.sendCount} + 1` })
      .where(eq(walletInvites.id, inviteId))
      .returning();
    await recordMutation(tx, actor, { mutationId: input.mutationId }, {
      walletId,
      entity: "wallet_invites",
      entityId: inviteId,
      op: "UPDATE",
      action: "INVITE_RESENT",
      changes: diff({ link: "old" }, { link: "new" }),
    });
    const [invite] = await toPending(tx, [row]);
    return { invite, token };
  });
}

export async function revokeInvite(actor: Actor, walletId: string, inviteId: string, input: InviteActionInput): Promise<CommandResult<Members>> {
  return runCommand(async (tx) => {
    if (!(await applied(tx, actor, input.mutationId))) {
      const role = await requireRole(tx, walletId, actor.userId, "manageMembers");
      const existing = await loadPendingInvite(tx, walletId, inviteId);
      if (!canInvite(role, existing.role)) throw new CommandError("forbidden");
      await tx.update(walletInvites).set({ revokedAt: now, revokedBy: actor.userId }).where(eq(walletInvites.id, inviteId));
      await recordMutation(tx, actor, { mutationId: input.mutationId }, {
        walletId,
        entity: "wallet_invites",
        entityId: inviteId,
        op: "ARCHIVE",
        action: "INVITE_REVOKED",
        changes: diff({ email: null }, { email: existing.invitedEmail }),
      });
    }
    return membersOf(tx, walletId, actor.userId);
  });
}

type MemberRow = typeof walletMembers.$inferSelect;

async function loadMember(tx: Tx, walletId: string, memberId: string): Promise<MemberRow> {
  const [row] = await tx
    .select()
    .from(walletMembers)
    .where(and(eq(walletMembers.walletId, walletId), eq(walletMembers.id, memberId), isNull(walletMembers.removedAt)))
    .for("update")
    .limit(1);
  if (!row) throw new CommandError("notFound");
  return row;
}

export async function changeMemberRole(actor: Actor, walletId: string, memberId: string, input: ChangeRoleInput): Promise<CommandResult<Members>> {
  return runCommand(async (tx) => {
    if (!(await applied(tx, actor, input.mutationId))) {
      const role = await requireRole(tx, walletId, actor.userId, "view");
      const member = await loadMember(tx, walletId, memberId);
      if (member.role === input.role) return membersOf(tx, walletId, actor.userId);
      if (!canChangeRole(role, member.role, input.role, member.userId === actor.userId)) throw new CommandError("forbidden");
      await tx
        .update(walletMembers)
        .set({ role: input.role, version: bump(walletMembers.version), updatedAt: now, updatedBy: actor.userId })
        .where(eq(walletMembers.id, memberId));
      await recordMutation(tx, actor, { mutationId: input.mutationId }, {
        walletId,
        entity: "wallet_members",
        entityId: memberId,
        op: "UPDATE",
        action: "MEMBER_ROLE_CHANGED",
        changes: diff({ role: member.role }, { role: input.role }),
      });
    }
    return membersOf(tx, walletId, actor.userId);
  });
}

async function removeMembership(tx: Tx, actor: Actor, walletId: string, member: MemberRow, action: string, mutationId: string) {
  await tx
    .update(walletMembers)
    .set({ removedAt: now, removedBy: actor.userId, version: bump(walletMembers.version), updatedAt: now, updatedBy: actor.userId })
    .where(eq(walletMembers.id, member.id));
  await recordMutation(tx, actor, { mutationId }, {
    walletId,
    entity: "wallet_members",
    entityId: member.id,
    op: "ARCHIVE",
    action,
    changes: diff({ user_id: null, role: member.role }, { user_id: member.userId, role: null }),
  });
}

/** Removes someone from the wallet; they lose access at once (roles are read on every request). */
export async function removeMember(actor: Actor, walletId: string, memberId: string, input: MemberActionInput): Promise<CommandResult<Members>> {
  return runCommand(async (tx) => {
    if (!(await applied(tx, actor, input.mutationId))) {
      const role = await requireRole(tx, walletId, actor.userId, "view");
      const member = await loadMember(tx, walletId, memberId);
      if (!canRemoveMember(role, member.role, member.userId === actor.userId)) throw new CommandError("forbidden");
      await removeMembership(tx, actor, walletId, member, "MEMBER_REMOVED", input.mutationId);
    }
    return membersOf(tx, walletId, actor.userId);
  });
}

/** Leaves the wallet; the owner has to transfer ownership first. */
export async function leaveWallet(actor: Actor, walletId: string, input: MemberActionInput): Promise<CommandResult<null>> {
  return runCommand(async (tx) => {
    if (await applied(tx, actor, input.mutationId)) return null;
    const role = await requireRole(tx, walletId, actor.userId, "view");
    if (role === "OWNER") throw new CommandError("ownerCannotLeave");
    const [member] = await tx
      .select()
      .from(walletMembers)
      .where(and(eq(walletMembers.walletId, walletId), eq(walletMembers.userId, actor.userId), isNull(walletMembers.removedAt)))
      .for("update")
      .limit(1);
    if (!member) throw new CommandError("notFound");
    await removeMembership(tx, actor, walletId, member, "MEMBER_LEFT", input.mutationId);
    return null;
  });
}

// ---------- The invited person ----------

/** A pending, unexpired invite by its token, or null. Used and expired ones still answer, to explain. */
async function inviteByToken(db: Tx | ReturnType<typeof getDb>, token: string) {
  const [row] = await db
    .select({ invite: walletInvites, walletName: wallets.name, walletArchivedAt: wallets.archivedAt, inviterName: users.name })
    .from(walletInvites)
    .innerJoin(wallets, eq(wallets.id, walletInvites.walletId))
    .innerJoin(users, eq(users.id, walletInvites.invitedBy))
    .where(eq(walletInvites.tokenHash, tokenHash(token)))
    .limit(1);
  return row ?? null;
}

export async function previewInvite(userId: string, userEmail: string, token: string): Promise<CommandResult<InvitePreview>> {
  return runCommand(async (tx) => {
    const row = await inviteByToken(tx, token);
    if (!row || row.walletArchivedAt) throw new CommandError("inviteInvalid");
    const { invite } = row;
    const used = invite.acceptedAt !== null || invite.declinedAt !== null || invite.revokedAt !== null;
    const [member] = await tx
      .select({ id: walletMembers.id })
      .from(walletMembers)
      .where(and(eq(walletMembers.walletId, invite.walletId), eq(walletMembers.userId, userId), isNull(walletMembers.removedAt)))
      .limit(1);
    return {
      walletName: row.walletName,
      invitedByName: row.inviterName,
      role: invite.role as InvitePreview["role"],
      email: invite.invitedEmail,
      status: used ? "USED" : invite.expiresAt.getTime() < Date.now() ? "EXPIRED" : "PENDING",
      matchesAccount: invite.invitedEmail.toLowerCase() === userEmail.toLowerCase(),
      alreadyMember: Boolean(member),
    };
  });
}

/** Accepting needs the link and the invited account; the new member gets the invited role. */
export async function respondToInvite(
  actor: Actor,
  userEmail: string,
  token: string,
  accept: boolean,
  input: MemberActionInput,
): Promise<CommandResult<{ walletId: string }>> {
  return runCommand(async (tx) => {
    const row = await inviteByToken(tx, token);
    if (!row) throw new CommandError("inviteInvalid");
    const walletId = row.invite.walletId;
    if (await applied(tx, actor, input.mutationId)) return { walletId };
    const [invite] = await tx
      .select()
      .from(walletInvites)
      .where(and(eq(walletInvites.id, row.invite.id), pendingInvite, gt(walletInvites.expiresAt, now)))
      .for("update")
      .limit(1);
    if (!invite || row.walletArchivedAt) throw new CommandError("inviteInvalid");
    if (invite.invitedEmail.toLowerCase() !== userEmail.toLowerCase()) throw new CommandError("inviteWrongAccount");

    if (!accept) {
      await tx.update(walletInvites).set({ declinedAt: now }).where(eq(walletInvites.id, invite.id));
      await recordMutation(tx, actor, { mutationId: input.mutationId }, {
        walletId,
        entity: "wallet_invites",
        entityId: invite.id,
        op: "UPDATE",
        action: "INVITE_DECLINED",
        changes: diff({ declined: false }, { declined: true }),
      });
      return { walletId };
    }

    const [member] = await tx
      .select({ id: walletMembers.id })
      .from(walletMembers)
      .where(and(eq(walletMembers.walletId, walletId), eq(walletMembers.userId, actor.userId), isNull(walletMembers.removedAt)))
      .limit(1);
    await tx.update(walletInvites).set({ acceptedAt: now, acceptedBy: actor.userId }).where(eq(walletInvites.id, invite.id));
    const changes: Change[] = [
      { walletId, entity: "wallet_invites", entityId: invite.id, op: "UPDATE", action: "INVITE_ACCEPTED", changes: diff({ accepted: false }, { accepted: true }) },
    ];
    if (!member) {
      const memberId = newId();
      await tx.insert(walletMembers).values({
        id: memberId,
        walletId,
        userId: actor.userId,
        role: invite.role as WalletRole,
        invitedBy: invite.invitedBy,
        createdBy: actor.userId,
        updatedBy: actor.userId,
      });
      changes.push({
        walletId,
        entity: "wallet_members",
        entityId: memberId,
        op: "CREATE",
        action: "MEMBER_JOINED",
        changes: diff({}, { user_id: actor.userId, role: invite.role }),
      });
    }
    const [first, ...rest] = changes;
    await recordMutation(tx, actor, { mutationId: input.mutationId }, first, rest);
    return { walletId };
  });
}
