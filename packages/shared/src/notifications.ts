import { z } from "zod";

/**
 * In-app notifications (wiki/finfy/data-model.md, `notifications`). They are
 * computed from the current state on each read, so they are never stale;
 * only "read" is stored, per user and notification key. Texts come from the
 * message files by `type`, filled with `payload` (wiki/decisoes/0011).
 */

export const NOTIFICATION_TYPES = ["BUDGET_NEAR", "BUDGET_OVER", "INVOICE_DUE", "INVOICE_OVERDUE", "PENDING_DUE"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Days before the due date an unpaid invoice shows up. */
export const INVOICE_DUE_DAYS = 5;

export const notificationSchema = z.object({
  /** Stable identity of the situation, e.g. `budget-over:<wallet>:<category>:2026-10`. */
  key: z.string(),
  type: z.enum(NOTIFICATION_TYPES),
  walletId: z.uuid(),
  walletName: z.string(),
  /** Category (id or system key), card, amounts, dates: what the text needs. */
  payload: z.record(z.string(), z.union([z.string(), z.number(), z.null()])),
  /** Where the app opens when the notification is clicked. */
  path: z.string(),
  read: z.boolean(),
});
export type AppNotification = z.infer<typeof notificationSchema>;

export const notificationListSchema = z.object({ notifications: z.array(notificationSchema), unread: z.number().int() });
export type NotificationList = z.infer<typeof notificationListSchema>;

export const markReadInput = z.object({ keys: z.array(z.string().max(200)).min(1).max(100) });
