/** Server schema (Postgres). The rules are in wiki/finfy/data-model.md. */
export * from "./identity";
export * from "./wallets";
export * from "./finance";
export * from "./planning";
export * from "./sync";

/**
 * Tables published to PowerSync (`CREATE PUBLICATION powersync FOR TABLE ...`).
 * Never `FOR ALL TABLES`: credentials, sessions, tokens, the e-mail outbox and
 * the audit log must not flow through the sync service. `currencies` is not
 * synced either: clients ship the same list in `@packages/shared/money`.
 */
export const SYNCED_TABLES = [
  "wallets",
  "wallet_members",
  "accounts",
  "credit_cards",
  "credit_card_invoices",
  "categories",
  "hidden_categories",
  "household_members",
  "recurrences",
  "transactions",
  "transaction_links",
  "tags",
  "transaction_tags",
  "transaction_attachments",
  "categorization_rules",
  "budgets",
  "budget_items",
  "goals",
  "goal_deposits",
  "assets",
  "asset_liabilities",
] as const;
