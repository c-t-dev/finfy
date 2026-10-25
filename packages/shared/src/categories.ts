import { z } from "zod";
import { ACCOUNT_COLORS } from "./accounts";

/**
 * Categories: system ones (shared by every wallet, read-only, can be hidden
 * per wallet) and the wallet's own. At most two levels (wiki/finfy/data-model.md).
 */

export const CATEGORY_NAME_MAX = 40;
export const CATEGORY_COLORS = ACCOUNT_COLORS;

/** lucide icon names a category can use; the screens map each to a component. */
export const CATEGORY_ICONS = [
  "utensils",
  "coffee",
  "house",
  "car",
  "fuel",
  "bus",
  "plane",
  "heart-pulse",
  "dumbbell",
  "graduation-cap",
  "book-open",
  "party-popper",
  "music",
  "gamepad-2",
  "repeat",
  "shopping-bag",
  "shirt",
  "smartphone",
  "sparkles",
  "paw-print",
  "baby",
  "users",
  "wrench",
  "receipt",
  "landmark",
  "hand-heart",
  "gift",
  "briefcase",
  "laptop",
  "trending-up",
  "ticket",
  "badge-percent",
  "piggy-bank",
  "wallet",
  "tag",
  "ellipsis",
] as const;
export type CategoryIcon = (typeof CATEGORY_ICONS)[number];

/** Categories users pick: `BOTH` exists in the schema but is not offered yet. */
export const PICKABLE_KINDS = ["EXPENSE", "INCOME"] as const;

const categoryName = z.string().trim().min(1).max(CATEGORY_NAME_MAX);

export const createCategoryInput = z.object({
  id: z.uuid(),
  mutationId: z.uuid(),
  name: categoryName,
  kind: z.enum(PICKABLE_KINDS),
  /** A top-level category (system or the wallet's) of the same kind. */
  parentId: z.uuid().nullable().optional(),
  icon: z.enum(CATEGORY_ICONS),
  color: z.enum(CATEGORY_COLORS),
});
export type CreateCategoryInput = z.infer<typeof createCategoryInput>;

export const updateCategoryInput = z
  .object({
    mutationId: z.uuid(),
    baseVersion: z.number().int().positive(),
    name: categoryName.optional(),
    icon: z.enum(CATEGORY_ICONS).optional(),
    color: z.enum(CATEGORY_COLORS).optional(),
  })
  .refine((input) => input.name !== undefined || input.icon !== undefined || input.color !== undefined, {
    message: "nothing to change",
  });
export type UpdateCategoryInput = z.infer<typeof updateCategoryInput>;

export const categoryStateInput = z.object({ mutationId: z.uuid(), baseVersion: z.number().int().positive() });
export type CategoryStateInput = z.infer<typeof categoryStateInput>;

/** Hiding a system category is per wallet. */
export const categoryVisibilityInput = z.object({ mutationId: z.uuid() });
export type CategoryVisibilityInput = z.infer<typeof categoryVisibilityInput>;

export const categorySchema = z.object({
  id: z.uuid(),
  parentId: z.uuid().nullable(),
  /** Wallet categories have a name; system ones a `translationKey` (`categories.<key>`). */
  name: z.string().nullable(),
  translationKey: z.string().nullable(),
  kind: z.enum(["INCOME", "EXPENSE", "BOTH"]),
  isSystem: z.boolean(),
  icon: z.string().nullable(),
  color: z.string().nullable(),
  /** System category hidden in this wallet. */
  hidden: z.boolean(),
  archived: z.boolean(),
  version: z.number().int(),
});
export type Category = z.infer<typeof categorySchema>;

export const categoryListSchema = z.object({ categories: z.array(categorySchema) });
