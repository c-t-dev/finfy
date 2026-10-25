CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"archived_at" timestamp with time zone,
	"archived_by" uuid,
	"wallet_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"initial_balance_minor" bigint DEFAULT 0 NOT NULL,
	"institution_code" text,
	"color" text,
	"icon" text,
	"is_default" boolean DEFAULT false NOT NULL,
	CONSTRAINT "accounts_wallet_id_id_unique" UNIQUE("wallet_id","id"),
	CONSTRAINT "accounts_type_check" CHECK ("accounts"."type" in ('CHECKING', 'SAVINGS', 'CASH', 'INVESTMENT', 'BENEFITS', 'OTHER'))
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"archived_at" timestamp with time zone,
	"archived_by" uuid,
	"wallet_id" uuid,
	"parent_id" uuid,
	"name" text,
	"translation_key" text,
	"kind" text NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"icon" text,
	"color" text,
	CONSTRAINT "categories_kind_check" CHECK ("categories"."kind" in ('INCOME', 'EXPENSE', 'BOTH')),
	CONSTRAINT "categories_owner_check" CHECK (("categories"."is_system" and "categories"."wallet_id" is null and "categories"."translation_key" is not null)
        or (not "categories"."is_system" and "categories"."wallet_id" is not null and "categories"."name" is not null))
);
--> statement-breakpoint
CREATE TABLE "categorization_rules" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"archived_at" timestamp with time zone,
	"archived_by" uuid,
	"wallet_id" uuid NOT NULL,
	"name" text NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"apply_to_history" boolean DEFAULT false NOT NULL,
	"conditions" jsonb NOT NULL,
	"actions" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_card_invoices" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"archived_at" timestamp with time zone,
	"archived_by" uuid,
	"wallet_id" uuid NOT NULL,
	"credit_card_id" uuid NOT NULL,
	"reference_year" smallint NOT NULL,
	"reference_month" smallint NOT NULL,
	"opening_date" date NOT NULL,
	"closing_date" date NOT NULL,
	"due_date" date NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"paid_at" timestamp with time zone,
	"payment_transaction_id" uuid,
	CONSTRAINT "credit_card_invoices_wallet_id_id_unique" UNIQUE("wallet_id","id"),
	CONSTRAINT "credit_card_invoices_status_check" CHECK ("credit_card_invoices"."status" in ('OPEN', 'PAID')),
	CONSTRAINT "credit_card_invoices_month_check" CHECK ("credit_card_invoices"."reference_month" between 1 and 12),
	CONSTRAINT "credit_card_invoices_dates_check" CHECK ("credit_card_invoices"."opening_date" <= "credit_card_invoices"."closing_date" and "credit_card_invoices"."closing_date" <= "credit_card_invoices"."due_date")
);
--> statement-breakpoint
CREATE TABLE "credit_cards" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"archived_at" timestamp with time zone,
	"archived_by" uuid,
	"wallet_id" uuid NOT NULL,
	"name" text NOT NULL,
	"payment_account_id" uuid NOT NULL,
	"brand" text NOT NULL,
	"limit_minor" bigint DEFAULT 0 NOT NULL,
	"closing_day" smallint NOT NULL,
	"due_day" smallint NOT NULL,
	"color" text,
	CONSTRAINT "credit_cards_wallet_id_id_unique" UNIQUE("wallet_id","id"),
	CONSTRAINT "credit_cards_brand_check" CHECK ("credit_cards"."brand" in ('VISA', 'MASTERCARD', 'ELO', 'AMEX', 'HIPERCARD', 'OTHER')),
	CONSTRAINT "credit_cards_limit_check" CHECK ("credit_cards"."limit_minor" >= 0),
	CONSTRAINT "credit_cards_closing_day_check" CHECK ("credit_cards"."closing_day" between 1 and 31),
	CONSTRAINT "credit_cards_due_day_check" CHECK ("credit_cards"."due_day" between 1 and 31)
);
--> statement-breakpoint
CREATE TABLE "hidden_categories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"archived_at" timestamp with time zone,
	"archived_by" uuid,
	"wallet_id" uuid NOT NULL,
	"category_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "household_members" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"archived_at" timestamp with time zone,
	"archived_by" uuid,
	"wallet_id" uuid NOT NULL,
	"name" text NOT NULL,
	"relationship" text NOT NULL,
	"birth_date" date,
	"color" text,
	CONSTRAINT "household_members_wallet_id_id_unique" UNIQUE("wallet_id","id"),
	CONSTRAINT "household_members_relationship_check" CHECK ("household_members"."relationship" in ('SELF', 'PARTNER', 'CHILD', 'PARENT', 'SIBLING', 'PET', 'OTHER'))
);
--> statement-breakpoint
CREATE TABLE "recurrences" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"archived_at" timestamp with time zone,
	"archived_by" uuid,
	"wallet_id" uuid NOT NULL,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"account_id" uuid,
	"credit_card_id" uuid,
	"category_id" uuid,
	"frequency" text NOT NULL,
	"weekdays" jsonb,
	"months" jsonb,
	"day_of_month" smallint,
	"start_date" date NOT NULL,
	"end_date" date,
	"match_day_tolerance" smallint DEFAULT 3 NOT NULL,
	"match_amount_tolerance_bps" integer DEFAULT 1000 NOT NULL,
	CONSTRAINT "recurrences_wallet_id_id_unique" UNIQUE("wallet_id","id"),
	CONSTRAINT "recurrences_type_check" CHECK ("recurrences"."type" in ('INCOME', 'EXPENSE')),
	CONSTRAINT "recurrences_frequency_check" CHECK ("recurrences"."frequency" in ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'YEARLY')),
	CONSTRAINT "recurrences_amount_check" CHECK ("recurrences"."amount_minor" > 0),
	CONSTRAINT "recurrences_target_check" CHECK (num_nonnulls("recurrences"."account_id", "recurrences"."credit_card_id") = 1),
	CONSTRAINT "recurrences_day_check" CHECK ("recurrences"."day_of_month" is null or "recurrences"."day_of_month" between 1 and 31),
	CONSTRAINT "recurrences_dates_check" CHECK ("recurrences"."end_date" is null or "recurrences"."end_date" >= "recurrences"."start_date"),
	CONSTRAINT "recurrences_tolerance_check" CHECK ("recurrences"."match_day_tolerance" >= 0 and "recurrences"."match_amount_tolerance_bps" >= 0)
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"archived_at" timestamp with time zone,
	"archived_by" uuid,
	"wallet_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text,
	CONSTRAINT "tags_wallet_id_id_unique" UNIQUE("wallet_id","id")
);
--> statement-breakpoint
CREATE TABLE "transaction_attachments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"archived_at" timestamp with time zone,
	"archived_by" uuid,
	"wallet_id" uuid NOT NULL,
	"transaction_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"sha256" text NOT NULL,
	CONSTRAINT "transaction_attachments_size_check" CHECK ("transaction_attachments"."size_bytes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "transaction_links" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"archived_at" timestamp with time zone,
	"archived_by" uuid,
	"wallet_id" uuid NOT NULL,
	"source_transaction_id" uuid NOT NULL,
	"target_transaction_id" uuid NOT NULL,
	"type" text NOT NULL,
	CONSTRAINT "transaction_links_type_check" CHECK ("transaction_links"."type" in ('TRANSFER', 'INVOICE_PAYMENT', 'REFUND')),
	CONSTRAINT "transaction_links_distinct_check" CHECK ("transaction_links"."source_transaction_id" <> "transaction_links"."target_transaction_id")
);
--> statement-breakpoint
CREATE TABLE "transaction_tags" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"archived_at" timestamp with time zone,
	"archived_by" uuid,
	"wallet_id" uuid NOT NULL,
	"transaction_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"archived_at" timestamp with time zone,
	"archived_by" uuid,
	"wallet_id" uuid NOT NULL,
	"account_id" uuid,
	"credit_card_id" uuid,
	"invoice_id" uuid,
	"category_id" uuid,
	"household_member_id" uuid,
	"recurrence_id" uuid,
	"occurrence_date" date,
	"installment_group_id" uuid,
	"installment_number" smallint,
	"installment_total" smallint,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"description" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"transaction_date" date NOT NULL,
	"due_date" date,
	"paid_at" timestamp with time zone,
	"notes" text,
	"needs_review" boolean DEFAULT false NOT NULL,
	CONSTRAINT "transactions_wallet_id_id_unique" UNIQUE("wallet_id","id"),
	CONSTRAINT "transactions_type_check" CHECK ("transactions"."type" in ('INCOME', 'EXPENSE', 'TRANSFER_IN', 'TRANSFER_OUT', 'CREDIT_CARD_PURCHASE', 'CREDIT_CARD_PAYMENT', 'ADJUSTMENT', 'REFUND')),
	CONSTRAINT "transactions_status_check" CHECK ("transactions"."status" in ('PENDING', 'PAID', 'CANCELED')),
	CONSTRAINT "transactions_amount_check" CHECK (("transactions"."type" = 'ADJUSTMENT' and "transactions"."amount_minor" <> 0) or ("transactions"."type" <> 'ADJUSTMENT' and "transactions"."amount_minor" > 0)),
	CONSTRAINT "transactions_target_check" CHECK (num_nonnulls("transactions"."account_id", "transactions"."credit_card_id") = 1),
	CONSTRAINT "transactions_card_type_check" CHECK (("transactions"."type" = 'CREDIT_CARD_PURCHASE') = ("transactions"."credit_card_id" is not null) or "transactions"."type" = 'REFUND'),
	CONSTRAINT "transactions_invoice_check" CHECK ("transactions"."invoice_id" is null or "transactions"."credit_card_id" is not null),
	CONSTRAINT "transactions_occurrence_check" CHECK (("transactions"."recurrence_id" is null) = ("transactions"."occurrence_date" is null)),
	CONSTRAINT "transactions_installments_check" CHECK (num_nonnulls("transactions"."installment_group_id", "transactions"."installment_number", "transactions"."installment_total") in (0, 3)
        and ("transactions"."installment_number" is null or "transactions"."installment_number" between 1 and "transactions"."installment_total"))
);
--> statement-breakpoint
CREATE TABLE "asset_liabilities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"archived_at" timestamp with time zone,
	"archived_by" uuid,
	"wallet_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"liability_id" uuid NOT NULL,
	CONSTRAINT "asset_liabilities_distinct_check" CHECK ("asset_liabilities"."asset_id" <> "asset_liabilities"."liability_id")
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"archived_at" timestamp with time zone,
	"archived_by" uuid,
	"wallet_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"current_value_minor" bigint NOT NULL,
	"purchase_value_minor" bigint,
	"purchase_date" date,
	"ownership_bps" integer DEFAULT 10000 NOT NULL,
	"notes" text,
	CONSTRAINT "assets_wallet_id_id_unique" UNIQUE("wallet_id","id"),
	CONSTRAINT "assets_kind_check" CHECK ("assets"."kind" in ('ASSET', 'LIABILITY')),
	CONSTRAINT "assets_type_check" CHECK ("assets"."type" in ('REAL_ESTATE', 'VEHICLE', 'ELECTRONICS', 'BUSINESS', 'COLLECTIBLE', 'RIGHTS', 'INVESTMENT', 'LOAN', 'FINANCING', 'OTHER')),
	CONSTRAINT "assets_value_check" CHECK ("assets"."current_value_minor" >= 0),
	CONSTRAINT "assets_ownership_check" CHECK ("assets"."ownership_bps" between 1 and 10000)
);
--> statement-breakpoint
CREATE TABLE "budget_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"archived_at" timestamp with time zone,
	"archived_by" uuid,
	"wallet_id" uuid NOT NULL,
	"budget_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"year" smallint NOT NULL,
	"month" smallint NOT NULL,
	"amount_minor" bigint NOT NULL,
	"alert_percentage" smallint,
	CONSTRAINT "budget_items_month_check" CHECK ("budget_items"."month" between 1 and 12),
	CONSTRAINT "budget_items_amount_check" CHECK ("budget_items"."amount_minor" >= 0),
	CONSTRAINT "budget_items_alert_check" CHECK ("budget_items"."alert_percentage" is null or "budget_items"."alert_percentage" between 1 and 100)
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"archived_at" timestamp with time zone,
	"archived_by" uuid,
	"wallet_id" uuid NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "budgets_wallet_id_id_unique" UNIQUE("wallet_id","id")
);
--> statement-breakpoint
CREATE TABLE "goal_deposits" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"archived_at" timestamp with time zone,
	"archived_by" uuid,
	"wallet_id" uuid NOT NULL,
	"goal_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"deposit_date" date NOT NULL,
	"notes" text,
	"transaction_id" uuid,
	CONSTRAINT "goal_deposits_amount_check" CHECK ("goal_deposits"."amount_minor" <> 0)
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"archived_at" timestamp with time zone,
	"archived_by" uuid,
	"wallet_id" uuid NOT NULL,
	"name" text NOT NULL,
	"template" text DEFAULT 'OTHER' NOT NULL,
	"target_minor" bigint NOT NULL,
	"initial_minor" bigint DEFAULT 0 NOT NULL,
	"deadline" date,
	"expected_annual_return_bps" integer,
	"achieved_at" timestamp with time zone,
	CONSTRAINT "goals_wallet_id_id_unique" UNIQUE("wallet_id","id"),
	CONSTRAINT "goals_template_check" CHECK ("goals"."template" in ('EMERGENCY_FUND', 'RETIREMENT', 'TRAVEL', 'HOUSE', 'CAR', 'EDUCATION', 'DEBT_PAYOFF', 'OTHER')),
	CONSTRAINT "goals_amounts_check" CHECK ("goals"."target_minor" > 0 and "goals"."initial_minor" >= 0)
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorization_rules" ADD CONSTRAINT "categorization_rules_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_card_invoices" ADD CONSTRAINT "credit_card_invoices_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_card_invoices" ADD CONSTRAINT "credit_card_invoices_payment_transaction_id_transactions_id_fk" FOREIGN KEY ("payment_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_card_invoices" ADD CONSTRAINT "credit_card_invoices_card_fk" FOREIGN KEY ("wallet_id","credit_card_id") REFERENCES "public"."credit_cards"("wallet_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_cards" ADD CONSTRAINT "credit_cards_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_cards" ADD CONSTRAINT "credit_cards_payment_account_fk" FOREIGN KEY ("wallet_id","payment_account_id") REFERENCES "public"."accounts"("wallet_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hidden_categories" ADD CONSTRAINT "hidden_categories_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hidden_categories" ADD CONSTRAINT "hidden_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurrences" ADD CONSTRAINT "recurrences_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurrences" ADD CONSTRAINT "recurrences_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurrences" ADD CONSTRAINT "recurrences_account_fk" FOREIGN KEY ("wallet_id","account_id") REFERENCES "public"."accounts"("wallet_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurrences" ADD CONSTRAINT "recurrences_credit_card_fk" FOREIGN KEY ("wallet_id","credit_card_id") REFERENCES "public"."credit_cards"("wallet_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_attachments" ADD CONSTRAINT "transaction_attachments_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_attachments" ADD CONSTRAINT "transaction_attachments_transaction_fk" FOREIGN KEY ("wallet_id","transaction_id") REFERENCES "public"."transactions"("wallet_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_links" ADD CONSTRAINT "transaction_links_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_links" ADD CONSTRAINT "transaction_links_source_fk" FOREIGN KEY ("wallet_id","source_transaction_id") REFERENCES "public"."transactions"("wallet_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_links" ADD CONSTRAINT "transaction_links_target_fk" FOREIGN KEY ("wallet_id","target_transaction_id") REFERENCES "public"."transactions"("wallet_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_tags" ADD CONSTRAINT "transaction_tags_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_tags" ADD CONSTRAINT "transaction_tags_transaction_fk" FOREIGN KEY ("wallet_id","transaction_id") REFERENCES "public"."transactions"("wallet_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_tags" ADD CONSTRAINT "transaction_tags_tag_fk" FOREIGN KEY ("wallet_id","tag_id") REFERENCES "public"."tags"("wallet_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_fk" FOREIGN KEY ("wallet_id","account_id") REFERENCES "public"."accounts"("wallet_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_credit_card_fk" FOREIGN KEY ("wallet_id","credit_card_id") REFERENCES "public"."credit_cards"("wallet_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_invoice_fk" FOREIGN KEY ("wallet_id","invoice_id") REFERENCES "public"."credit_card_invoices"("wallet_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_household_member_fk" FOREIGN KEY ("wallet_id","household_member_id") REFERENCES "public"."household_members"("wallet_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_recurrence_fk" FOREIGN KEY ("wallet_id","recurrence_id") REFERENCES "public"."recurrences"("wallet_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_liabilities" ADD CONSTRAINT "asset_liabilities_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_liabilities" ADD CONSTRAINT "asset_liabilities_asset_fk" FOREIGN KEY ("wallet_id","asset_id") REFERENCES "public"."assets"("wallet_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_liabilities" ADD CONSTRAINT "asset_liabilities_liability_fk" FOREIGN KEY ("wallet_id","liability_id") REFERENCES "public"."assets"("wallet_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_budget_fk" FOREIGN KEY ("wallet_id","budget_id") REFERENCES "public"."budgets"("wallet_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_deposits" ADD CONSTRAINT "goal_deposits_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_deposits" ADD CONSTRAINT "goal_deposits_goal_fk" FOREIGN KEY ("wallet_id","goal_id") REFERENCES "public"."goals"("wallet_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_deposits" ADD CONSTRAINT "goal_deposits_transaction_fk" FOREIGN KEY ("wallet_id","transaction_id") REFERENCES "public"."transactions"("wallet_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_one_default_unique" ON "accounts" USING btree ("wallet_id") WHERE "accounts"."is_default" and "accounts"."archived_at" is null;--> statement-breakpoint
CREATE INDEX "categories_wallet_idx" ON "categories" USING btree ("wallet_id");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_translation_key_unique" ON "categories" USING btree ("translation_key");--> statement-breakpoint
CREATE INDEX "categorization_rules_wallet_priority_idx" ON "categorization_rules" USING btree ("wallet_id","priority");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_card_invoices_month_unique" ON "credit_card_invoices" USING btree ("credit_card_id","reference_year","reference_month");--> statement-breakpoint
CREATE UNIQUE INDEX "hidden_categories_unique" ON "hidden_categories" USING btree ("wallet_id","category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_name_unique" ON "tags" USING btree ("wallet_id",lower("name")) WHERE "tags"."archived_at" is null;--> statement-breakpoint
CREATE INDEX "transaction_attachments_transaction_idx" ON "transaction_attachments" USING btree ("transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transaction_links_unique" ON "transaction_links" USING btree ("source_transaction_id","target_transaction_id","type");--> statement-breakpoint
CREATE INDEX "transaction_links_target_idx" ON "transaction_links" USING btree ("target_transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transaction_tags_unique" ON "transaction_tags" USING btree ("transaction_id","tag_id");--> statement-breakpoint
CREATE INDEX "transaction_tags_tag_idx" ON "transaction_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "transactions_wallet_date_idx" ON "transactions" USING btree ("wallet_id","transaction_date");--> statement-breakpoint
CREATE INDEX "transactions_wallet_category_idx" ON "transactions" USING btree ("wallet_id","category_id");--> statement-breakpoint
CREATE INDEX "transactions_wallet_account_idx" ON "transactions" USING btree ("wallet_id","account_id");--> statement-breakpoint
CREATE INDEX "transactions_invoice_idx" ON "transactions" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "transactions_installment_group_idx" ON "transactions" USING btree ("installment_group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_occurrence_unique" ON "transactions" USING btree ("recurrence_id","occurrence_date") WHERE "transactions"."recurrence_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "asset_liabilities_unique" ON "asset_liabilities" USING btree ("asset_id","liability_id");--> statement-breakpoint
CREATE UNIQUE INDEX "budget_items_unique" ON "budget_items" USING btree ("budget_id","category_id","year","month");--> statement-breakpoint
CREATE INDEX "budget_items_wallet_month_idx" ON "budget_items" USING btree ("wallet_id","year","month");--> statement-breakpoint
CREATE INDEX "goal_deposits_goal_idx" ON "goal_deposits" USING btree ("goal_id");