import { z } from "zod";
import { emailSchema } from "./auth";
import { WALLET_ROLES } from "./roles";

/**
 * Wallet members and invites (wiki/decisoes/0002 and 0003). While finfy sends
 * no e-mail, an invite is a private link: the inviter shares it, and only the
 * account with the invited e-mail can accept it with that link.
 */

/** Days an invite link stays valid. */
export const INVITE_DAYS = 7;
export const INVITE_ROLES = ["ADMIN", "EDITOR", "VIEWER"] as const;

export const createInviteInput = z.object({
  mutationId: z.uuid(),
  email: emailSchema,
  role: z.enum(INVITE_ROLES),
});
export type CreateInviteInput = z.infer<typeof createInviteInput>;

/** Revoke, or issue a new link (the old one stops working). */
export const inviteActionInput = z.object({ mutationId: z.uuid() });
export type InviteActionInput = z.infer<typeof inviteActionInput>;

export const changeRoleInput = z.object({ mutationId: z.uuid(), role: z.enum(INVITE_ROLES) });
export type ChangeRoleInput = z.infer<typeof changeRoleInput>;

export const memberActionInput = z.object({ mutationId: z.uuid() });
export type MemberActionInput = z.infer<typeof memberActionInput>;

export const memberSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  name: z.string(),
  email: z.string(),
  role: z.enum(WALLET_ROLES),
  isMe: z.boolean(),
  joinedAt: z.string(),
});
export type Member = z.infer<typeof memberSchema>;

export const pendingInviteSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  role: z.enum(INVITE_ROLES),
  invitedByName: z.string(),
  expiresAt: z.string(),
  expired: z.boolean(),
});
export type PendingInvite = z.infer<typeof pendingInviteSchema>;

export const membersSchema = z.object({ members: z.array(memberSchema), invites: z.array(pendingInviteSchema) });
export type Members = z.infer<typeof membersSchema>;

/** Answer to creating or re-issuing an invite: the only time the token is shown. */
export const inviteLinkSchema = z.object({ invite: pendingInviteSchema, token: z.string() });
export type InviteLink = z.infer<typeof inviteLinkSchema>;

/** What the invited person sees when opening the link. */
export const invitePreviewSchema = z.object({
  walletName: z.string(),
  invitedByName: z.string(),
  role: z.enum(INVITE_ROLES),
  email: z.string(),
  status: z.enum(["PENDING", "EXPIRED", "USED"]),
  /** The signed-in account has the invited e-mail. */
  matchesAccount: z.boolean(),
  alreadyMember: z.boolean(),
});
export type InvitePreview = z.infer<typeof invitePreviewSchema>;

export const acceptedInviteSchema = z.object({ walletId: z.uuid() });

/** Tokens are 43 URL-safe characters (32 random bytes). */
export const INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
