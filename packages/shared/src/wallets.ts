import { z } from "zod";
import { CURRENCIES, type CurrencyCode } from "./money";
import { WALLET_ROLES } from "./roles";

/**
 * Wallet inputs and responses, shared by the screens and the API
 * (wiki/decisoes/0002). Writes follow the sync rules even on the web: the
 * client makes the IDs, sends a `mutationId` so a retry is applied once, and
 * sends the `baseVersion` it was editing (wiki/finfy/data-model.md).
 */

export const WALLET_NAME_MAX = 60;

/** Stable codes the wallet API returns; the client translates them (errors.wallet.*). */
export const WALLET_ERRORS = [
  "invalidInput",
  "unauthenticated",
  "forbiddenOrigin",
  "forbidden",
  "notFound",
  "currencyLocked",
  "versionConflict",
  "invoicePaid",
  "alreadyMember",
  "inviteInvalid",
  "inviteWrongAccount",
  "ownerCannotLeave",
  "invalidCredentials",
  "rateLimited",
  "unavailable",
] as const;
export type WalletError = (typeof WALLET_ERRORS)[number];

export const CURRENCY_CODES = Object.keys(CURRENCIES) as [CurrencyCode, ...CurrencyCode[]];

const walletName = z.string().trim().min(1).max(WALLET_NAME_MAX);
const mutationId = z.uuid();
const baseVersion = z.number().int().positive();

export const createWalletInput = z.object({
  id: z.uuid(),
  mutationId,
  name: walletName,
  currencyCode: z.enum(CURRENCY_CODES),
});
export type CreateWalletInput = z.infer<typeof createWalletInput>;

export const updateWalletInput = z
  .object({
    mutationId,
    baseVersion,
    name: walletName.optional(),
    currencyCode: z.enum(CURRENCY_CODES).optional(),
  })
  .refine((input) => input.name !== undefined || input.currencyCode !== undefined, { message: "nothing to change" });
export type UpdateWalletInput = z.infer<typeof updateWalletInput>;

/** Archiving is OWNER only and asks for the password again (step-up, wiki/decisoes/0004). */
export const archiveWalletInput = z.object({
  mutationId,
  baseVersion,
  password: z.string().min(1).max(512),
});
export type ArchiveWalletInput = z.infer<typeof archiveWalletInput>;

/** A wallet as the signed-in member sees it. */
export const walletSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  currencyCode: z.enum(CURRENCY_CODES),
  /** True after the first entry: the currency cannot change any more. */
  currencyLocked: z.boolean(),
  role: z.enum(WALLET_ROLES),
  version: z.number().int(),
});
export type Wallet = z.infer<typeof walletSchema>;

export const walletListSchema = z.object({ wallets: z.array(walletSchema) });
