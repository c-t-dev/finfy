/**
 * Server schema (Postgres). The financial core (accounts, cards, transactions,
 * categories...) is still a draft in wiki/finfy/data-model.md and is added
 * once it is approved.
 */
export * from "./identity";
export * from "./wallets";
export * from "./sync";

/**
 * Tables published to PowerSync (`CREATE PUBLICATION powersync FOR TABLE ...`).
 * Never `FOR ALL TABLES`: credentials, sessions, tokens, the e-mail outbox and
 * the audit log must not flow through the sync service. `currencies` is not
 * synced either: clients ship the same list in `@packages/shared/money`.
 */
export const SYNCED_TABLES = ["wallets", "wallet_members"] as const;
