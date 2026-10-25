import { z } from "zod";
import { ACCOUNT_TYPES } from "./finance";

/**
 * Accounts inside a wallet: inputs and responses shared by the screens and
 * the API (wiki/finfy/data-model.md). Writes carry a client `id`, a
 * `mutationId` and the `baseVersion` being edited, like every synced write.
 */

export const ACCOUNT_NAME_MAX = 60;

/** Colors an account can take; the screens map each to a theme color. */
export const ACCOUNT_COLORS = ["blue", "green", "orange", "red", "purple", "pink", "teal", "gray"] as const;
export type AccountColor = (typeof ACCOUNT_COLORS)[number];

/** Initial balances above this are almost certainly a typo (10^13 minor units). */
const MAX_MINOR = 10_000_000_000_000;

const accountName = z.string().trim().min(1).max(ACCOUNT_NAME_MAX);
const amountMinor = z.number().int().min(-MAX_MINOR).max(MAX_MINOR);

export const createAccountInput = z.object({
  id: z.uuid(),
  mutationId: z.uuid(),
  name: accountName,
  type: z.enum(ACCOUNT_TYPES),
  initialBalanceMinor: amountMinor,
  color: z.enum(ACCOUNT_COLORS),
  isDefault: z.boolean().optional(),
});
export type CreateAccountInput = z.infer<typeof createAccountInput>;

export const updateAccountInput = z
  .object({
    mutationId: z.uuid(),
    baseVersion: z.number().int().positive(),
    name: accountName.optional(),
    type: z.enum(ACCOUNT_TYPES).optional(),
    initialBalanceMinor: amountMinor.optional(),
    color: z.enum(ACCOUNT_COLORS).optional(),
    /** Only `true`: an account stops being the main one when another becomes it. */
    isDefault: z.literal(true).optional(),
  })
  .refine((input) => Object.keys(input).some((key) => key !== "mutationId" && key !== "baseVersion"), {
    message: "nothing to change",
  });
export type UpdateAccountInput = z.infer<typeof updateAccountInput>;

/** Archive and restore carry only the mutation and the version. */
export const accountStateInput = z.object({ mutationId: z.uuid(), baseVersion: z.number().int().positive() });
export type AccountStateInput = z.infer<typeof accountStateInput>;

export const accountSchema = z.object({
  id: z.uuid(),
  walletId: z.uuid(),
  name: z.string(),
  type: z.enum(ACCOUNT_TYPES),
  initialBalanceMinor: z.number().int(),
  /** Initial balance plus paid, non-archived transactions; computed, never stored. */
  balanceMinor: z.number().int(),
  color: z.enum(ACCOUNT_COLORS),
  isDefault: z.boolean(),
  archived: z.boolean(),
  version: z.number().int(),
});
export type Account = z.infer<typeof accountSchema>;

export const accountListSchema = z.object({ accounts: z.array(accountSchema) });
