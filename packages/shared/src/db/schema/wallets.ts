import { sql } from "drizzle-orm";
import { char, index, jsonb, pgTable, smallint, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { LOCALES } from "../../i18n/locales";
import { WALLET_ROLES } from "../../roles";
import { createdAt, enumCheck, idColumn, syncedColumns, textEnum, timestamptz } from "../columns";
import { currencies, users } from "./identity";

/**
 * Wallets and sharing (wiki/decisoes/0001, 0002 and 0003). `wallets` and
 * `wallet_members` are synced; invites, transfers, e-mails and notifications
 * stay on the server.
 */

/** Synced. Ownership lives only in `wallet_members` (no `owner_id`). */
export const wallets = pgTable("wallets", {
  ...syncedColumns(),
  name: text("name").notNull(),
  currencyCode: char("currency_code", { length: 3 })
    .notNull()
    .references(() => currencies.code),
  /** Set on the first entry; the currency cannot change after that. */
  currencyLockedAt: timestamptz("currency_locked_at"),
});

/** Synced, so the device knows the user's role in each wallet. */
export const walletMembers = pgTable(
  "wallet_members",
  {
    ...syncedColumns(),
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => wallets.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    role: textEnum("role", WALLET_ROLES).notNull(),
    invitedBy: uuid("invited_by").references(() => users.id),
    joinedAt: timestamptz("joined_at").notNull().defaultNow(),
    removedAt: timestamptz("removed_at"),
    removedBy: uuid("removed_by").references(() => users.id),
  },
  (t) => [
    uniqueIndex("wallet_members_active_unique").on(t.walletId, t.userId).where(sql`${t.removedAt} is null`),
    // Exactly one active OWNER per wallet.
    uniqueIndex("wallet_members_one_owner_unique")
      .on(t.walletId)
      .where(sql`${t.role} = 'OWNER' and ${t.removedAt} is null`),
    index("wallet_members_user_active_idx").on(t.userId).where(sql`${t.removedAt} is null`),
    enumCheck("wallet_members_role_check", t.role, WALLET_ROLES),
  ],
);

/** The token is single use; only its hash is stored. */
export const walletInvites = pgTable(
  "wallet_invites",
  {
    id: idColumn(),
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => wallets.id),
    invitedEmail: text("invited_email").notNull(),
    role: textEnum("role", WALLET_ROLES).notNull(),
    invitedBy: uuid("invited_by")
      .notNull()
      .references(() => users.id),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamptz("expires_at").notNull(),
    acceptedAt: timestamptz("accepted_at"),
    acceptedBy: uuid("accepted_by").references(() => users.id),
    declinedAt: timestamptz("declined_at"),
    revokedAt: timestamptz("revoked_at"),
    revokedBy: uuid("revoked_by").references(() => users.id),
    lastSentAt: timestamptz("last_sent_at").notNull().defaultNow(),
    sendCount: smallint("send_count").notNull().default(1),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("wallet_invites_token_hash_unique").on(t.tokenHash),
    // One pending invite per wallet and e-mail.
    uniqueIndex("wallet_invites_pending_unique")
      .on(t.walletId, sql`lower(${t.invitedEmail})`)
      .where(sql`${t.acceptedAt} is null and ${t.declinedAt} is null and ${t.revokedAt} is null`),
    enumCheck("wallet_invites_role_check", t.role, ["ADMIN", "EDITOR", "VIEWER"]),
  ],
);

export const PREVIOUS_OWNER_ACTIONS = ["STAY_ADMIN", "LEAVE"] as const;

/** Two-step ownership transfer: the recipient must accept (wiki/decisoes/0002). */
export const walletOwnershipTransfers = pgTable(
  "wallet_ownership_transfers",
  {
    id: idColumn(),
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => wallets.id),
    fromUserId: uuid("from_user_id")
      .notNull()
      .references(() => users.id),
    toUserId: uuid("to_user_id")
      .notNull()
      .references(() => users.id),
    previousOwnerAction: textEnum("previous_owner_action", PREVIOUS_OWNER_ACTIONS).notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamptz("expires_at").notNull(),
    acceptedAt: timestamptz("accepted_at"),
    declinedAt: timestamptz("declined_at"),
    canceledAt: timestamptz("canceled_at"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("wallet_ownership_transfers_token_hash_unique").on(t.tokenHash),
    uniqueIndex("wallet_ownership_transfers_pending_unique")
      .on(t.walletId)
      .where(sql`${t.acceptedAt} is null and ${t.declinedAt} is null and ${t.canceledAt} is null`),
    enumCheck("wallet_ownership_transfers_action_check", t.previousOwnerAction, PREVIOUS_OWNER_ACTIONS),
  ],
);

export const EMAIL_STATUSES = ["PENDING", "SENT", "FAILED"] as const;

/** Read by a cron job; e-mails go out in the recipient's language (wiki/decisoes/0011). */
export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: idColumn(),
    toEmail: text("to_email").notNull(),
    template: text("template").notNull(),
    locale: textEnum("locale", LOCALES).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: textEnum("status", EMAIL_STATUSES).notNull().default("PENDING"),
    attempts: smallint("attempts").notNull().default(0),
    sentAt: timestamptz("sent_at"),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [
    index("email_outbox_pending_idx").on(t.createdAt).where(sql`${t.status} = 'PENDING'`),
    enumCheck("email_outbox_locale_check", t.locale, LOCALES),
    enumCheck("email_outbox_status_check", t.status, EMAIL_STATUSES),
  ],
);

/**
 * In-app notifications. `type` is a translation key plus `payload`: the text
 * is rendered in the reader's language, never stored (wiki/decisoes/0011).
 */
export const notifications = pgTable(
  "notifications",
  {
    id: idColumn(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    walletId: uuid("wallet_id").references(() => wallets.id),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    readAt: timestamptz("read_at"),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_read_idx").on(t.userId, t.readAt)],
);


/**
 * Each member's Home layout per wallet (wiki/decisoes/0019): the visible
 * blocks in order, with their width. A personal preference: not synced yet,
 * not audited, never shown to other members. ID `deterministicId("home_layout",
 * userId, walletId)`, so a later sync can create the same row on two devices.
 */
export const homeLayouts = pgTable(
  "home_layouts",
  {
    id: idColumn(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => wallets.id),
    /** `[{ key, size }]`, read with `readHomeLayout` from `@packages/shared/home`. */
    widgets: jsonb("widgets").$type<unknown[]>().notNull(),
    createdAt: createdAt(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("home_layouts_user_wallet_idx").on(t.userId, t.walletId)],
);
