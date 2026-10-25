-- Hand-written migration: publish the financial tables to PowerSync.
-- Keep in step with SYNCED_TABLES in src/db/schema/index.ts.
ALTER PUBLICATION "powersync" ADD TABLE
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
  "asset_liabilities";
