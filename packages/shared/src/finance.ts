/**
 * Value lists of the financial core (wiki/finfy/data-model.md). Pure data, so
 * clients and the server share them: the schema turns each list into a `text`
 * column with a `CHECK`, and the screens use the same lists for their pickers.
 */

export const ACCOUNT_TYPES = ["CHECKING", "SAVINGS", "CASH", "INVESTMENT", "BENEFITS", "OTHER"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const CARD_BRANDS = ["VISA", "MASTERCARD", "ELO", "AMEX", "HIPERCARD", "OTHER"] as const;
export type CardBrand = (typeof CARD_BRANDS)[number];

/** `CLOSED` and `OVERDUE` are derived from the dates, never stored. */
export const INVOICE_STATUSES = ["OPEN", "PAID"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const CATEGORY_KINDS = ["INCOME", "EXPENSE", "BOTH"] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

/** `amount_minor` is always positive and the type gives the direction; `ADJUSTMENT` is the only signed one. */
export const TRANSACTION_TYPES = [
  "INCOME",
  "EXPENSE",
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "CREDIT_CARD_PURCHASE",
  "CREDIT_CARD_PAYMENT",
  "ADJUSTMENT",
  "REFUND",
] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_STATUSES = ["PENDING", "PAID", "CANCELED"] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const TRANSACTION_LINK_TYPES = ["TRANSFER", "INVOICE_PAYMENT", "REFUND"] as const;
export type TransactionLinkType = (typeof TRANSACTION_LINK_TYPES)[number];

export const RECURRENCE_TYPES = ["INCOME", "EXPENSE"] as const;
export type RecurrenceType = (typeof RECURRENCE_TYPES)[number];

export const RECURRENCE_FREQUENCIES = [
  "DAILY",
  "WEEKLY",
  "BIWEEKLY",
  "MONTHLY",
  "BIMONTHLY",
  "QUARTERLY",
  "SEMIANNUAL",
  "YEARLY",
] as const;
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

export const HOUSEHOLD_RELATIONSHIPS = ["SELF", "PARTNER", "CHILD", "PARENT", "SIBLING", "PET", "OTHER"] as const;
export type HouseholdRelationship = (typeof HOUSEHOLD_RELATIONSHIPS)[number];

export const GOAL_TEMPLATES = [
  "EMERGENCY_FUND",
  "RETIREMENT",
  "TRAVEL",
  "HOUSE",
  "CAR",
  "EDUCATION",
  "DEBT_PAYOFF",
  "OTHER",
] as const;
export type GoalTemplate = (typeof GOAL_TEMPLATES)[number];

export const ASSET_KINDS = ["ASSET", "LIABILITY"] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export const ASSET_TYPES = [
  "REAL_ESTATE",
  "VEHICLE",
  "ELECTRONICS",
  "BUSINESS",
  "COLLECTIBLE",
  "RIGHTS",
  "INVESTMENT",
  "LOAN",
  "FINANCING",
  "OTHER",
] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

/** Basis points: 10000 = 100%. Used for ownership shares and rates. */
export const FULL_BPS = 10000;
