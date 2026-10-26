import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import {
  ACCOUNT_TYPES,
  CARD_BRANDS,
  CATEGORY_KINDS,
  HOUSEHOLD_RELATIONSHIPS,
  INVOICE_STATUSES,
  RECURRENCE_FREQUENCIES,
  RECURRENCE_TYPES,
  TRANSACTION_LINK_TYPES,
  TRANSACTION_STATUSES,
  TRANSACTION_TYPES,
} from "../../finance";
import { bigintNumber, enumCheck, syncedColumns, textEnum, timestamptz } from "../columns";
import { wallets } from "./wallets";

/**
 * Financial core (wiki/finfy/data-model.md). Every table is synced and carries
 * `wallet_id`. References between rows of a wallet are composite foreign keys
 * on (`wallet_id`, `<x>_id`), so the database itself refuses a row that points
 * into another wallet. Categories are the exception: system categories have no
 * wallet, so the server commands check those.
 */

export const walletIdColumn = () =>
  uuid("wallet_id")
    .notNull()
    .references(() => wallets.id);

/** Target of the composite foreign keys: (`wallet_id`, `id`). */
export const walletScoped = (name: string, t: { walletId: AnyPgColumn; id: AnyPgColumn }) =>
  unique(`${name}_wallet_id_id_unique`).on(t.walletId, t.id);

/** (`wallet_id`, `column`) → (`wallet_id`, `id`) of `target`. */
export function sameWallet(
  name: string,
  from: { walletId: AnyPgColumn },
  column: AnyPgColumn,
  target: { walletId: AnyPgColumn; id: AnyPgColumn },
) {
  return foreignKey({ name, columns: [from.walletId, column], foreignColumns: [target.walletId, target.id] });
}

export const accounts = pgTable(
  "accounts",
  {
    ...syncedColumns(),
    walletId: walletIdColumn(),
    name: text("name").notNull(),
    type: textEnum("type", ACCOUNT_TYPES).notNull(),
    /** The balance is derived from this plus the paid transactions, never stored. */
    initialBalanceMinor: bigintNumber("initial_balance_minor").notNull().default(0),
    institutionCode: text("institution_code"),
    color: text("color"),
    icon: text("icon"),
    isDefault: boolean("is_default").notNull().default(false),
  },
  (t) => [
    walletScoped("accounts", t),
    uniqueIndex("accounts_one_default_unique")
      .on(t.walletId)
      .where(sql`${t.isDefault} and ${t.archivedAt} is null`),
    enumCheck("accounts_type_check", t.type, ACCOUNT_TYPES),
  ],
);

export const creditCards = pgTable(
  "credit_cards",
  {
    ...syncedColumns(),
    walletId: walletIdColumn(),
    name: text("name").notNull(),
    /** Account that pays the invoices. */
    paymentAccountId: uuid("payment_account_id").notNull(),
    brand: textEnum("brand", CARD_BRANDS).notNull(),
    limitMinor: bigintNumber("limit_minor").notNull().default(0),
    closingDay: smallint("closing_day").notNull(),
    dueDay: smallint("due_day").notNull(),
    color: text("color"),
  },
  (t) => [
    walletScoped("credit_cards", t),
    sameWallet("credit_cards_payment_account_fk", t, t.paymentAccountId, accounts),
    enumCheck("credit_cards_brand_check", t.brand, CARD_BRANDS),
    check("credit_cards_limit_check", sql`${t.limitMinor} >= 0`),
    check("credit_cards_closing_day_check", sql`${t.closingDay} between 1 and 31`),
    check("credit_cards_due_day_check", sql`${t.dueDay} between 1 and 31`),
  ],
);

/**
 * One invoice per card and month. Two offline devices can open the same one, so
 * its `id` is UUIDv5 of (`credit_card_id`, year, month) (`deterministicId`).
 */
export const creditCardInvoices = pgTable(
  "credit_card_invoices",
  {
    ...syncedColumns(),
    walletId: walletIdColumn(),
    creditCardId: uuid("credit_card_id").notNull(),
    referenceYear: smallint("reference_year").notNull(),
    referenceMonth: smallint("reference_month").notNull(),
    openingDate: date("opening_date", { mode: "string" }).notNull(),
    closingDate: date("closing_date", { mode: "string" }).notNull(),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    status: textEnum("status", INVOICE_STATUSES).notNull().default("OPEN"),
    paidAt: timestamptz("paid_at"),
    /** Single-column reference: a composite one would make the two tables' types circular. */
    paymentTransactionId: uuid("payment_transaction_id").references((): AnyPgColumn => transactions.id),
  },
  (t) => [
    walletScoped("credit_card_invoices", t),
    sameWallet("credit_card_invoices_card_fk", t, t.creditCardId, creditCards),
    uniqueIndex("credit_card_invoices_month_unique").on(t.creditCardId, t.referenceYear, t.referenceMonth),
    enumCheck("credit_card_invoices_status_check", t.status, INVOICE_STATUSES),
    check("credit_card_invoices_month_check", sql`${t.referenceMonth} between 1 and 12`),
    check("credit_card_invoices_dates_check", sql`${t.openingDate} <= ${t.closingDate} and ${t.closingDate} <= ${t.dueDate}`),
  ],
);

/**
 * System categories have `wallet_id` NULL, a `translation_key` instead of a
 * name, and go to every user. Wallet categories have a name. At most two
 * levels (checked by the server commands).
 */
export const categories = pgTable(
  "categories",
  {
    ...syncedColumns(),
    walletId: uuid("wallet_id").references(() => wallets.id),
    parentId: uuid("parent_id").references((): AnyPgColumn => categories.id),
    name: text("name"),
    translationKey: text("translation_key"),
    kind: textEnum("kind", CATEGORY_KINDS).notNull(),
    isSystem: boolean("is_system").notNull().default(false),
    icon: text("icon"),
    color: text("color"),
  },
  (t) => [
    index("categories_wallet_idx").on(t.walletId),
    uniqueIndex("categories_translation_key_unique").on(t.translationKey),
    enumCheck("categories_kind_check", t.kind, CATEGORY_KINDS),
    check(
      "categories_owner_check",
      sql`(${t.isSystem} and ${t.walletId} is null and ${t.translationKey} is not null)
        or (not ${t.isSystem} and ${t.walletId} is not null and ${t.name} is not null)`,
    ),
  ],
);

/**
 * System categories a wallet hides. Hiding is per wallet, so it cannot be a
 * flag on the shared system row. `id` is UUIDv5 of (`wallet_id`,
 * `category_id`); unhiding archives the row, hiding again restores it.
 */
export const hiddenCategories = pgTable(
  "hidden_categories",
  {
    ...syncedColumns(),
    walletId: walletIdColumn(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
  },
  (t) => [uniqueIndex("hidden_categories_unique").on(t.walletId, t.categoryId)],
);

/** "Who spent it" labels. Not app users. */
export const householdMembers = pgTable(
  "household_members",
  {
    ...syncedColumns(),
    walletId: walletIdColumn(),
    name: text("name").notNull(),
    relationship: textEnum("relationship", HOUSEHOLD_RELATIONSHIPS).notNull(),
    birthDate: date("birth_date", { mode: "string" }),
    color: text("color"),
  },
  (t) => [
    walletScoped("household_members", t),
    enumCheck("household_members_relationship_check", t.relationship, HOUSEHOLD_RELATIONSHIPS),
  ],
);

export const recurrences = pgTable(
  "recurrences",
  {
    ...syncedColumns(),
    walletId: walletIdColumn(),
    type: textEnum("type", RECURRENCE_TYPES).notNull(),
    description: text("description").notNull(),
    amountMinor: bigintNumber("amount_minor").notNull(),
    accountId: uuid("account_id"),
    creditCardId: uuid("credit_card_id"),
    categoryId: uuid("category_id").references(() => categories.id),
    frequency: textEnum("frequency", RECURRENCE_FREQUENCIES).notNull(),
    /** ISO weekdays (1 = Monday) for weekly frequencies. */
    weekdays: jsonb("weekdays").$type<number[]>(),
    /** Months (1–12) for frequencies that skip some. */
    months: jsonb("months").$type<number[]>(),
    dayOfMonth: smallint("day_of_month"),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }),
    /** How far (days, amount in basis points) a typed transaction may be from an occurrence to match it. */
    matchDayTolerance: smallint("match_day_tolerance").notNull().default(3),
    matchAmountToleranceBps: integer("match_amount_tolerance_bps").notNull().default(1000),
  },
  (t) => [
    walletScoped("recurrences", t),
    sameWallet("recurrences_account_fk", t, t.accountId, accounts),
    sameWallet("recurrences_credit_card_fk", t, t.creditCardId, creditCards),
    enumCheck("recurrences_type_check", t.type, RECURRENCE_TYPES),
    enumCheck("recurrences_frequency_check", t.frequency, RECURRENCE_FREQUENCIES),
    check("recurrences_amount_check", sql`${t.amountMinor} > 0`),
    check("recurrences_target_check", sql`num_nonnulls(${t.accountId}, ${t.creditCardId}) = 1`),
    check("recurrences_day_check", sql`${t.dayOfMonth} is null or ${t.dayOfMonth} between 1 and 31`),
    check("recurrences_dates_check", sql`${t.endDate} is null or ${t.endDate} >= ${t.startDate}`),
    check("recurrences_tolerance_check", sql`${t.matchDayTolerance} >= 0 and ${t.matchAmountToleranceBps} >= 0`),
  ],
);

/**
 * Account entries and card purchases. Exactly one of `account_id` and
 * `credit_card_id` is set. A recurrence occurrence has `recurrence_id` +
 * `occurrence_date`, and its `id` is UUIDv5 of both.
 */
export const transactions = pgTable(
  "transactions",
  {
    ...syncedColumns(),
    walletId: walletIdColumn(),
    accountId: uuid("account_id"),
    creditCardId: uuid("credit_card_id"),
    invoiceId: uuid("invoice_id"),
    categoryId: uuid("category_id").references(() => categories.id),
    householdMemberId: uuid("household_member_id"),
    recurrenceId: uuid("recurrence_id"),
    occurrenceDate: date("occurrence_date", { mode: "string" }),
    installmentGroupId: uuid("installment_group_id"),
    installmentNumber: smallint("installment_number"),
    installmentTotal: smallint("installment_total"),
    type: textEnum("type", TRANSACTION_TYPES).notNull(),
    status: textEnum("status", TRANSACTION_STATUSES).notNull(),
    description: text("description").notNull(),
    amountMinor: bigintNumber("amount_minor").notNull(),
    transactionDate: date("transaction_date", { mode: "string" }).notNull(),
    dueDate: date("due_date", { mode: "string" }),
    paidAt: timestamptz("paid_at"),
    notes: text("notes"),
    needsReview: boolean("needs_review").notNull().default(false),
  },
  (t) => [
    walletScoped("transactions", t),
    sameWallet("transactions_account_fk", t, t.accountId, accounts),
    sameWallet("transactions_credit_card_fk", t, t.creditCardId, creditCards),
    sameWallet("transactions_invoice_fk", t, t.invoiceId, creditCardInvoices),
    sameWallet("transactions_household_member_fk", t, t.householdMemberId, householdMembers),
    sameWallet("transactions_recurrence_fk", t, t.recurrenceId, recurrences),
    index("transactions_wallet_date_idx").on(t.walletId, t.transactionDate),
    index("transactions_wallet_category_idx").on(t.walletId, t.categoryId),
    index("transactions_wallet_account_idx").on(t.walletId, t.accountId),
    index("transactions_invoice_idx").on(t.invoiceId),
    index("transactions_installment_group_idx").on(t.installmentGroupId),
    uniqueIndex("transactions_occurrence_unique")
      .on(t.recurrenceId, t.occurrenceDate)
      .where(sql`${t.recurrenceId} is not null`),
    enumCheck("transactions_type_check", t.type, TRANSACTION_TYPES),
    enumCheck("transactions_status_check", t.status, TRANSACTION_STATUSES),
    check(
      "transactions_amount_check",
      sql`(${t.type} = 'ADJUSTMENT' and ${t.amountMinor} <> 0) or (${t.type} <> 'ADJUSTMENT' and ${t.amountMinor} > 0)`,
    ),
    check("transactions_target_check", sql`num_nonnulls(${t.accountId}, ${t.creditCardId}) = 1`),
    check(
      "transactions_card_type_check",
      sql`(${t.type} = 'CREDIT_CARD_PURCHASE') = (${t.creditCardId} is not null) or ${t.type} = 'REFUND'`,
    ),
    check("transactions_invoice_check", sql`${t.invoiceId} is null or ${t.creditCardId} is not null`),
    check(
      "transactions_occurrence_check",
      sql`(${t.recurrenceId} is null) = (${t.occurrenceDate} is null)`,
    ),
    check(
      "transactions_installments_check",
      sql`num_nonnulls(${t.installmentGroupId}, ${t.installmentNumber}, ${t.installmentTotal}) in (0, 3)
        and (${t.installmentNumber} is null or ${t.installmentNumber} between 1 and ${t.installmentTotal})`,
    ),
  ],
);

/** Both legs of a transfer, an invoice to its payment, a refund to its purchase. */
export const transactionLinks = pgTable(
  "transaction_links",
  {
    ...syncedColumns(),
    walletId: walletIdColumn(),
    sourceTransactionId: uuid("source_transaction_id").notNull(),
    targetTransactionId: uuid("target_transaction_id").notNull(),
    type: textEnum("type", TRANSACTION_LINK_TYPES).notNull(),
  },
  (t) => [
    sameWallet("transaction_links_source_fk", t, t.sourceTransactionId, transactions),
    sameWallet("transaction_links_target_fk", t, t.targetTransactionId, transactions),
    uniqueIndex("transaction_links_unique").on(t.sourceTransactionId, t.targetTransactionId, t.type),
    index("transaction_links_target_idx").on(t.targetTransactionId),
    enumCheck("transaction_links_type_check", t.type, TRANSACTION_LINK_TYPES),
    check("transaction_links_distinct_check", sql`${t.sourceTransactionId} <> ${t.targetTransactionId}`),
  ],
);

export const tags = pgTable(
  "tags",
  {
    ...syncedColumns(),
    walletId: walletIdColumn(),
    name: text("name").notNull(),
    color: text("color"),
  },
  (t) => [
    walletScoped("tags", t),
    uniqueIndex("tags_name_unique")
      .on(t.walletId, sql`lower(${t.name})`)
      .where(sql`${t.archivedAt} is null`),
  ],
);

/** `id` is UUIDv5 of (`transaction_id`, `tag_id`); removing a tag archives the row. */
export const transactionTags = pgTable(
  "transaction_tags",
  {
    ...syncedColumns(),
    walletId: walletIdColumn(),
    transactionId: uuid("transaction_id").notNull(),
    tagId: uuid("tag_id").notNull(),
  },
  (t) => [
    sameWallet("transaction_tags_transaction_fk", t, t.transactionId, transactions),
    sameWallet("transaction_tags_tag_fk", t, t.tagId, tags),
    uniqueIndex("transaction_tags_unique").on(t.transactionId, t.tagId),
    index("transaction_tags_tag_idx").on(t.tagId),
  ],
);

/** The file lives in object storage; uploading needs a connection. */
export const transactionAttachments = pgTable(
  "transaction_attachments",
  {
    ...syncedColumns(),
    walletId: walletIdColumn(),
    transactionId: uuid("transaction_id").notNull(),
    storageKey: text("storage_key").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigintNumber("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
  },
  (t) => [
    sameWallet("transaction_attachments_transaction_fk", t, t.transactionId, transactions),
    index("transaction_attachments_transaction_idx").on(t.transactionId),
    check("transaction_attachments_size_check", sql`${t.sizeBytes} >= 0`),
  ],
);

import type { RuleAction, RuleCondition } from "../../rule-match";
export type { RuleAction, RuleCondition };

/** Never applied to transfers or to system categories. */
export const categorizationRules = pgTable(
  "categorization_rules",
  {
    ...syncedColumns(),
    walletId: walletIdColumn(),
    name: text("name").notNull(),
    priority: integer("priority").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    applyToHistory: boolean("apply_to_history").notNull().default(false),
    conditions: jsonb("conditions").$type<RuleCondition[]>().notNull(),
    actions: jsonb("actions").$type<RuleAction[]>().notNull(),
  },
  (t) => [index("categorization_rules_wallet_priority_idx").on(t.walletId, t.priority)],
);
