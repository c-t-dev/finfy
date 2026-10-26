import { z } from "zod";
import { ACCOUNT_COLORS } from "./accounts";

/**
 * Tags of a wallet (wiki/finfy/data-model.md). Names are unique per wallet
 * ignoring case; entries reference tags by ID, never by name.
 */

export const TAG_NAME_MAX = 30;
export const TAGS_PER_ENTRY_MAX = 10;

const tagName = z.string().trim().min(1).max(TAG_NAME_MAX);

/** Creating a name that already exists answers the existing tag. */
export const createTagInput = z.object({
  id: z.uuid(),
  mutationId: z.uuid(),
  name: tagName,
  color: z.enum(ACCOUNT_COLORS),
});
export type CreateTagInput = z.infer<typeof createTagInput>;

export const updateTagInput = z
  .object({
    mutationId: z.uuid(),
    name: tagName.optional(),
    color: z.enum(ACCOUNT_COLORS).optional(),
  })
  .refine((input) => input.name !== undefined || input.color !== undefined, { message: "nothing to change" });
export type UpdateTagInput = z.infer<typeof updateTagInput>;

export const tagStateInput = z.object({ mutationId: z.uuid() });

/** Replaces the tags of an entry (all installments of a card purchase). */
export const setEntryTagsInput = z.object({
  mutationId: z.uuid(),
  tagIds: z.array(z.uuid()).max(TAGS_PER_ENTRY_MAX),
});
export type SetEntryTagsInput = z.infer<typeof setEntryTagsInput>;

export const tagSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  color: z.enum(ACCOUNT_COLORS),
  archived: z.boolean(),
  version: z.number().int(),
});
export type Tag = z.infer<typeof tagSchema>;

export const tagListSchema = z.object({ tags: z.array(tagSchema) });
