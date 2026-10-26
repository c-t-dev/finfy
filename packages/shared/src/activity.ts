import { z } from "zod";

/** The wallet's activity feed: its audit log, newest first (wiki/decisoes/0006). */

export const ACTIVITY_PAGE = 50;

export const activityEntrySchema = z.object({
  id: z.uuid(),
  action: z.string(),
  entity: z.string(),
  entityId: z.uuid(),
  /** Field-level diff: { field: { from, to } }. */
  changes: z.record(z.string(), z.object({ from: z.unknown(), to: z.unknown() })).nullable(),
  actorName: z.string().nullable(),
  source: z.string(),
  recordedAt: z.string(),
});
export type ActivityEntry = z.infer<typeof activityEntrySchema>;

export const activityPageSchema = z.object({
  entries: z.array(activityEntrySchema),
  /** Pass as `before` to load older entries; null at the start of the history. */
  nextBefore: z.string().nullable(),
});
export type ActivityPage = z.infer<typeof activityPageSchema>;

/** Result of recomputing the hash chain. */
export const chainCheckSchema = z.object({
  valid: z.boolean(),
  entries: z.number().int(),
  /** First entry whose hash does not match, when the chain is broken. */
  brokenAt: z.uuid().nullable(),
});
export type ChainCheck = z.infer<typeof chainCheckSchema>;
