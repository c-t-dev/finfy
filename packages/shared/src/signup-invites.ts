import { z } from "zod";

/**
 * Sign-up invite codes (wiki/decisoes/0004): while sign-up is closed
 * (`SIGN_UP_MODE=invite`), a new account needs a code made by someone who
 * already has one. Single use, valid for SIGNUP_INVITE_DAYS.
 */

export const SIGNUP_INVITE_DAYS = 7;
/** Unused, unexpired codes one account may hold at a time. */
export const SIGNUP_INVITE_MAX_PENDING = 10;
export const SIGNUP_INVITE_NOTE_MAX = 60;

/** No 0/O, 1/I/L: easy to read aloud and to type. 16 of 31 symbols: about 79 bits. */
export const SIGNUP_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const SIGNUP_CODE_LENGTH = 16;

/** What the server hashes: upper case, letters and digits only. */
export const normalizeSignupCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** `ABCD-EFGH-JKMN-PQRS`, as shown to people. */
export const formatSignupCode = (code: string) => normalizeSignupCode(code).match(/.{1,4}/g)?.join("-") ?? "";

export const SIGNUP_INVITE_STATUSES = ["PENDING", "USED", "REVOKED", "EXPIRED"] as const;

export const signupInviteSchema = z.object({
  id: z.uuid(),
  note: z.string().nullable(),
  status: z.enum(SIGNUP_INVITE_STATUSES),
  createdAt: z.string(),
  expiresAt: z.string(),
  usedAt: z.string().nullable(),
  /** Name of the account created with the code. */
  usedByName: z.string().nullable(),
});
export type SignupInvite = z.infer<typeof signupInviteSchema>;

export const signupInviteListSchema = z.object({
  invites: z.array(signupInviteSchema),
  /** Whether sign-up needs a code right now (`SIGN_UP_MODE=invite`). */
  signUpClosed: z.boolean(),
});
export type SignupInviteList = z.infer<typeof signupInviteListSchema>;

export const createSignupInviteInput = z.object({
  note: z.string().trim().max(SIGNUP_INVITE_NOTE_MAX).optional(),
});

/** The code itself only comes back here, once. */
export const createdSignupInviteSchema = z.object({ invite: signupInviteSchema, code: z.string() });
export type CreatedSignupInvite = z.infer<typeof createdSignupInviteSchema>;
