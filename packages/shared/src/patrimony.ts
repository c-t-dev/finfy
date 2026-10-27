import { z } from "zod";
import { ASSET_TYPES, FULL_BPS } from "./finance";
import { AMOUNT_MAX, isoDate, NOTES_MAX } from "./transactions";

/**
 * Patrimony (wiki/finfy/data-model.md): assets and liabilities a wallet owns,
 * by an ownership share. Net worth = account balances + assets − liabilities
 * − purchases on unpaid card invoices, each asset and liability counted by
 * its share.
 */

export const ASSET_NAME_MAX = 60;

/** Which types each kind takes. */
export const TYPES_BY_KIND = {
  ASSET: ["REAL_ESTATE", "VEHICLE", "ELECTRONICS", "BUSINESS", "COLLECTIBLE", "RIGHTS", "INVESTMENT", "OTHER"],
  LIABILITY: ["LOAN", "FINANCING", "OTHER"],
} as const satisfies Record<"ASSET" | "LIABILITY", readonly (typeof ASSET_TYPES)[number][]>;

const value = z.number().int().min(0).max(AMOUNT_MAX);

const linkedIds = z.array(z.uuid()).refine((ids) => new Set(ids).size === ids.length, { message: "duplicate link" });

const fields = {
  name: z.string().trim().min(1).max(ASSET_NAME_MAX),
  type: z.enum(ASSET_TYPES),
  currentValueMinor: value,
  purchaseValueMinor: value.nullable(),
  purchaseDate: isoDate.nullable(),
  /** Basis points, 1–10000 (100%). */
  ownershipBps: z.number().int().min(1).max(FULL_BPS),
  notes: z.string().trim().max(NOTES_MAX).nullable(),
};

export const createAssetInput = z
  .object({ id: z.uuid(), mutationId: z.uuid(), kind: z.enum(["ASSET", "LIABILITY"]), linkedIds: linkedIds.optional(), ...fields })
  .refine((input) => (TYPES_BY_KIND[input.kind] as readonly string[]).includes(input.type), { message: "type does not fit the kind" });
export type CreateAssetInput = z.infer<typeof createAssetInput>;

export const updateAssetInput = z
  .object({
    mutationId: z.uuid(),
    baseVersion: z.number().int().positive(),
    linkedIds: linkedIds.optional(),
    name: fields.name.optional(),
    type: fields.type.optional(),
    currentValueMinor: value.optional(),
    purchaseValueMinor: value.nullable().optional(),
    purchaseDate: isoDate.nullable().optional(),
    ownershipBps: fields.ownershipBps.optional(),
    notes: fields.notes.optional(),
  })
  .refine((input) => Object.keys(input).some((key) => key !== "mutationId" && key !== "baseVersion"), { message: "nothing to change" });
export type UpdateAssetInput = z.infer<typeof updateAssetInput>;

export const assetStateInput = z.object({ mutationId: z.uuid(), baseVersion: z.number().int().positive() });
export type AssetStateInput = z.infer<typeof assetStateInput>;

export const assetSchema = z.object({
  id: z.uuid(),
  kind: z.enum(["ASSET", "LIABILITY"]),
  type: z.enum(ASSET_TYPES),
  name: z.string(),
  currentValueMinor: z.number().int(),
  purchaseValueMinor: z.number().int().nullable(),
  purchaseDate: isoDate.nullable(),
  ownershipBps: z.number().int(),
  notes: z.string().nullable(),
  linkedIds: z.array(z.uuid()),
  linkedAssets: z.array(z.object({ id: z.uuid(), name: z.string(), currentValueMinor: z.number().int(), ownershipBps: z.number().int(), archived: z.boolean() })),
  archived: z.boolean(),
  version: z.number().int(),
});
export type Asset = z.infer<typeof assetSchema>;

export const assetListSchema = z.object({ assets: z.array(assetSchema) });

export const netWorthSchema = z.object({
  accountsMinor: z.number().int(),
  assetsMinor: z.number().int(),
  liabilitiesMinor: z.number().int(),
  /** Actual outstanding card debt, including committed installments but no future forecasts. */
  cardDebtMinor: z.number().int().describe("Purchases already made on unpaid non-archived invoices, including future installments of completed purchases; future forecasts are excluded."),
  netWorthMinor: z.number().int(),
});
export type NetWorth = z.infer<typeof netWorthSchema>;

/** The owned part of a value, rounded to the minor unit. */
export function ownedPart(valueMinor: number, ownershipBps: number): number {
  return Math.round((valueMinor * ownershipBps) / FULL_BPS);
}
