# finfy — Data model

> Last updated: 2026-10-27

This is the data model of **finfy** itself. It consolidates the decisions in [`../decisoes/`](../decisoes/README.md) and proposes the financial core. For the reverse-engineered model of the Minhas Economias app, see [`../api/modelo-de-dados.md`](../api/modelo-de-dados.md) instead.

| Area | Status | Source |
| --- | --- | --- |
| Identity and security | Proposed | [0004](../decisoes/0004-seguranca-da-conta.md) |
| Wallets, sharing, invites | Proposed | [0001](../decisoes/0001-multimoeda.md), [0002](../decisoes/0002-wallets-e-compartilhamento.md), [0003](../decisoes/0003-convites-por-email.md) |
| Sync and audit | Proposed (sync technology decided) | [0005](../decisoes/0005-offline-first-e-sincronizacao.md), [0006](../decisoes/0006-auditoria.md) |
| Financial core, planning, patrimony | Approved on 2026-10-25 | Adapted from Wallefy (`my-fin/docs/data-model.md`), see [`../referencias/wallefy.md`](../referencias/wallefy.md) |

**In code:** every table below is in `packages/shared/src/db/schema` (`identity`, `wallets`, `finance`, `planning`, `sync`), with migrations in `packages/shared/drizzle` ([codebase.md](codebase.md)). The value lists (account types, transaction types...) are in `@packages/shared/finance`. The financial API and screens are implemented as described in [codebase.md](codebase.md). `currencies` is not synced (no `id` column): clients ship the same list in `@packages/shared/money`.

## Conventions

- **Database:** PostgreSQL on the server (source of truth), schema and migrations with **Drizzle** ([0010](../decisoes/0010-nextjs-na-vercel.md)). Native apps keep a SQLite replica through PowerSync; the web keeps nothing locally ([0005](../decisoes/0005-offline-first-e-sincronizacao.md), [0009](../decisoes/0009-react-tauri-capacitor.md)).
- **IDs:** UUIDv7 (`uuid`), generated on the client for synced tables. Recurrence occurrences use UUIDv5 of `recurrence_id` + date so two offline devices create the same ID.
- **Money:** `bigint` in minor units (`*_minor` columns). The currency is always the wallet's (`wallets.currency_code`); entities inside a wallet do not carry their own currency. Decimal places come from `currencies.minor_units`.
- **Enums:** `text` with a `CHECK` constraint, not native Postgres enums, so values can be added without migrations that lock tables.
- **Timestamps:** `timestamptz` in UTC. Calendar dates (transaction date, due date) are `date`.
- **Soft delete:** synced tables are never hard-deleted by the app; they get `archived_at`. Hard deletes only happen server-side for account or wallet erasure (LGPD/GDPR).
- **Tenancy:** every financial row has `wallet_id`. Every ID referenced in a write must belong to the same wallet. The database enforces this: references between rows of a wallet are composite foreign keys on (`wallet_id`, `<x>_id`) → (`wallet_id`, `id`), so a row pointing into another wallet is refused. Exceptions, checked by the server commands: categories (system categories have no wallet) and `credit_card_invoices.payment_transaction_id`. Permissions are checked against `wallet_members` on every request.

### Common columns of synced tables

Every table marked **synced** below has these columns in addition to its own:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | UUIDv7 |
| `wallet_id` | uuid FK → `wallets` | Tenancy and sync partition |
| `version` | bigint | Incremented by the server on every accepted change |
| `created_at`, `created_by` | timestamptz, uuid FK → `users` | |
| `updated_at`, `updated_by` | timestamptz, uuid FK → `users` | Set by the server, not the device clock |
| `archived_at`, `archived_by` | timestamptz, uuid FK → `users` | Soft delete |

They are omitted from the diagrams and tables below to keep them readable.

### Sync-ready schema rules

The web ships first and does not sync, but the schema must already work with PowerSync, so the native apps can be added without reshaping tables ([0005](../decisoes/0005-offline-first-e-sincronizacao.md), [0010](../decisoes/0010-nextjs-na-vercel.md)). The server schema is written with **Drizzle**.

**Table shape**

1. Every synced table has a single-column primary key named `id` (uuid). No composite primary keys: link tables get their own `id` plus a unique constraint on the pair.
2. Rows that two offline devices could create independently use a **deterministic UUIDv5** (`deterministicId`), the same trick as recurrence occurrences:
   - `transaction_tags`: from `transaction_id` + `tag_id`;
   - `asset_liabilities`: from `asset_id` + `liability_id`;
   - `hidden_categories`: from `wallet_id` + `category_id`;
   - `credit_card_invoices`: from `credit_card_id` + year + month;
   - `budget_items`: from `budget_id` + `category_id` + year + month.

   Removing such a row archives it; adding it again restores the same row.
3. Every synced row carries `wallet_id` directly, so sync streams can filter by wallet without deep joins. Exceptions: `wallets` (filtered by its own `id`) and system rows with `wallet_id` NULL (system categories), which go to every user.
4. Use only types with a clean SQLite mapping on the client. PowerSync maps them as follows:

| Postgres | Client SQLite | Rule |
| --- | --- | --- |
| `uuid`, `text`, `date`, `jsonb` | `text` | jsonb arrives as a JSON string; parse it in the data layer |
| `bigint`, `integer` | `integer` | All money (`*_minor`) |
| `boolean` | `integer` (0/1) | |
| `timestamptz` | `text` (ISO 8601, UTC) | Never `timestamp` without time zone |
| `numeric` | `text` | Avoid on synced tables; money is never `numeric` |
| `bytea` | does not sync | Not allowed on synced tables; files go to object storage |
| native enums, arrays, ranges | `text` | Not used: enums are `text` + `CHECK`; lists are jsonb or a link table |

**What the client cannot enforce**

5. The local SQLite has no foreign keys, unique constraints or cascades. Rows can arrive in any order. The client must tolerate a missing parent (e.g. a transaction whose category has not synced yet).
6. Uniqueness is decided by the server when the mutation arrives. Example: two devices create the tag "food" offline; the server keeps one and repoints the other's links, recording it in the audit log.

**One write path**

7. Every write goes through one set of server commands, whether it comes from a web request or from `POST /api/sync/push`. Each command checks permission, validates, merges by field, bumps `version` and writes the audit log ([0006](../decisoes/0006-auditoria.md)).
8. The web follows the same rules as the native apps:
   - it generates the UUIDv7 IDs on the client;
   - it sends a `mutation_id` for idempotency;
   - it sends the `version` it was editing as `base_version`.

   A web edit can then produce the same conflicts as an offline one.

**Migrations**

9. **Expand, then contract.** Add columns or tables first. Stop using the old ones in a later release. Drop them only once no supported app version reads them. Never rename or drop a synced column in a single release.
10. A schema change and the matching PowerSync sync config (and client schema) ship together. The client sends its `schema_version`; the server rejects versions that are too old ([0005](../decisoes/0005-offline-first-e-sincronizacao.md#versões-do-app)).
11. The client-side PowerSync schema is generated from (or checked in CI against) the Drizzle schema in `packages/shared`, so the two cannot drift.

**Replication and security**

12. The Postgres publication `powersync` lists only synced tables. Never use `FOR ALL TABLES`: credentials, sessions, MFA secrets, invites' token hashes, the email outbox and the audit log must not flow through the sync service.
13. The replication role (`REPLICATION`, `BYPASSRLS`, `LOGIN`, `SELECT` only on published tables) is separate from the API role.
14. Columns that a member should not see (e.g. another user's email) are not selected by the sync streams, even if the table is synced.

## Diagrams

### Identity and security

```mermaid
erDiagram
  USERS ||--o| USER_CREDENTIALS : has
  USERS ||--o{ USER_OAUTH_PROVIDERS : links
  USERS ||--o| USER_MFA_TOTP : enables
  USERS ||--o{ USER_RECOVERY_CODES : holds
  USERS ||--o{ USER_SESSIONS : opens
  USERS ||--o{ DEVICES : registers
  DEVICES |o--o{ USER_SESSIONS : "signed in on"
  USERS ||--o{ PASSWORD_RESET_TOKENS : requests
  USERS |o--o{ OTP_CODES : receives
  USERS ||--o{ SECURITY_EVENTS : generates
  USERS {
    uuid id PK
    text email UK
    timestamptz email_verified_at
    text preferred_currency_code FK
    text language
    timestamptz mfa_enabled_at
    timestamptz locked_until
  }
  USER_CREDENTIALS {
    uuid user_id PK
    text password_hash
    int pepper_version
  }
  USER_MFA_TOTP {
    uuid user_id PK
    bytea secret_encrypted
    int key_version
    bigint last_used_step
  }
  USER_SESSIONS {
    uuid id PK
    uuid user_id FK
    uuid device_id FK
    text token_hash
    timestamptz absolute_expires_at
    timestamptz revoked_at
  }
  DEVICES {
    uuid id PK
    uuid user_id FK
    text platform
    int schema_version
    timestamptz last_sync_at
  }
```

### Wallets and sharing

```mermaid
erDiagram
  CURRENCIES ||--o{ WALLETS : "denominates"
  WALLETS ||--|{ WALLET_MEMBERS : "has"
  USERS ||--o{ WALLET_MEMBERS : "is"
  WALLETS ||--o{ WALLET_INVITES : "sends"
  WALLETS ||--o{ WALLET_OWNERSHIP_TRANSFERS : "may transfer"
  USERS ||--o{ NOTIFICATIONS : "receives"
  CURRENCIES {
    text code PK
    int minor_units
    bool is_enabled
  }
  WALLETS {
    uuid id PK
    text name
    text currency_code FK
    timestamptz currency_locked_at
    timestamptz archived_at
  }
  WALLET_MEMBERS {
    uuid id PK
    uuid wallet_id FK
    uuid user_id FK
    text role
    timestamptz removed_at
  }
  WALLET_INVITES {
    uuid id PK
    uuid wallet_id FK
    text invited_email
    text role
    text token_hash
    timestamptz expires_at
  }
  WALLET_OWNERSHIP_TRANSFERS {
    uuid id PK
    uuid wallet_id FK
    uuid from_user_id FK
    uuid to_user_id FK
    text token_hash
    timestamptz expires_at
  }
  NOTIFICATIONS {
    uuid id PK
    uuid user_id FK
    text type
    timestamptz read_at
  }
```

### Financial core

```mermaid
erDiagram
  WALLETS ||--o{ ACCOUNTS : holds
  ACCOUNTS ||--o{ CREDIT_CARDS : "pays invoices of"
  CREDIT_CARDS ||--o{ CREDIT_CARD_INVOICES : bills
  ACCOUNTS |o--o{ TRANSACTIONS : "posted to"
  CREDIT_CARDS |o--o{ TRANSACTIONS : "charged to"
  CREDIT_CARD_INVOICES |o--o{ TRANSACTIONS : groups
  CATEGORIES ||--o{ TRANSACTIONS : classifies
  CATEGORIES |o--o{ CATEGORIES : "parent of"
  HOUSEHOLD_MEMBERS |o--o{ TRANSACTIONS : "spent by"
  RECURRENCES |o--o{ TRANSACTIONS : generates
  TRANSACTIONS ||--o{ TRANSACTION_LINKS : "source of"
  TRANSACTIONS }o--o{ TAGS : tagged
  TRANSACTIONS ||--o{ TRANSACTION_ATTACHMENTS : has
  CATEGORIZATION_RULES }o--|| CATEGORIES : assigns
  ACCOUNTS {
    uuid id PK
    text name
    text type
    bigint initial_balance_minor
  }
  CREDIT_CARDS {
    uuid id PK
    uuid payment_account_id FK
    text brand
    bigint limit_minor
    int closing_day
    int due_day
  }
  CREDIT_CARD_INVOICES {
    uuid id PK
    uuid credit_card_id FK
    date closing_date
    date due_date
    text status
  }
  TRANSACTIONS {
    uuid id PK
    uuid account_id FK
    uuid credit_card_id FK
    uuid invoice_id FK
    uuid category_id FK
    uuid recurrence_id FK
    text type
    text status
    bigint amount_minor
    date transaction_date
    uuid installment_group_id
  }
  CATEGORIES {
    uuid id PK
    uuid wallet_id FK
    uuid parent_id FK
    text kind
    text translation_key
  }
  RECURRENCES {
    uuid id PK
    text frequency
    bigint amount_minor
    int day_begin
    int day_end
  }
```

### Planning, patrimony, sync and audit

```mermaid
erDiagram
  WALLETS ||--o{ BUDGETS : plans
  BUDGETS ||--o{ BUDGET_ITEMS : "per category and month"
  CATEGORIES ||--o{ BUDGET_ITEMS : limits
  WALLETS ||--o{ GOALS : sets
  GOALS ||--o{ GOAL_DEPOSITS : receives
  TRANSACTIONS |o--o| GOAL_DEPOSITS : funds
  WALLETS ||--o{ ASSETS : owns
  ASSETS ||--o{ ASSET_LIABILITIES : "financed by"
  WALLETS ||--o{ SYNC_MUTATIONS : receives
  SYNC_MUTATIONS ||--o| SYNC_CONFLICTS : "may raise"
  WALLETS ||--o{ AUDIT_LOGS : records
  SYNC_MUTATIONS |o--o{ AUDIT_LOGS : produces
  BUDGET_ITEMS {
    uuid id PK
    uuid budget_id FK
    uuid category_id FK
    int year
    int month
    bigint amount_minor
    int alert_percentage
  }
  GOALS {
    uuid id PK
    text name
    bigint target_minor
    date deadline
  }
  ASSETS {
    uuid id PK
    text kind
    text type
    bigint current_value_minor
  }
  SYNC_MUTATIONS {
    uuid mutation_id PK
    uuid device_id FK
    text entity
    uuid entity_id
    jsonb changes
    bigint base_version
    text status
  }
  AUDIT_LOGS {
    uuid id PK
    uuid actor_user_id FK
    text source
    text action
    text entity
    uuid entity_id
    jsonb changes
    bytea hash
  }
```

## Tables

### Identity and security ([0004](../decisoes/0004-seguranca-da-conta.md))

| Table | Columns | Notes |
| --- | --- | --- |
| `users` | `id`, `name`, `email` (unique, lowercased), `email_verified_at`, `language` (`pt-BR`, `en`; `pt-PT` later, see [0011](../decisoes/0011-traducoes.md)), `preferred_currency_code` → `currencies`, `mfa_enabled_at`, `failed_login_count`, `locked_until`, `created_at`, `updated_at`, `deleted_at` | `deleted_at` + pseudonymization on account erasure |
| `user_credentials` | `user_id` PK, `password_hash`, `pepper_version`, `password_changed_at` | Argon2id in PHC format (salt embedded); HMAC-SHA256 pepper applied before hashing |
| `user_oauth_providers` | `id`, `user_id`, `provider` (`GOOGLE`, `APPLE`), `provider_user_id`, `email`, `created_at` | Unique (`provider`, `provider_user_id`); provider tokens not stored |
| `user_mfa_totp` | `user_id` PK, `secret_encrypted`, `key_version`, `confirmed_at`, `last_used_step` | AES-256-GCM, key outside the database |
| `user_recovery_codes` | `id`, `user_id`, `code_hash`, `used_at` | 10 codes per generation |
| `otp_codes` | `id`, `user_id` (nullable), `email`, `purpose` (`EMAIL_VERIFY`, `LOGIN`, `STEP_UP`, `MFA_FALLBACK`), `code_hash`, `expires_at`, `attempts`, `used_at` | 10 min, 5 attempts |
| `user_sessions` | `id`, `user_id`, `device_id`, `token_hash`, `ip`, `user_agent`, `last_seen_at`, `idle_expires_at`, `absolute_expires_at`, `step_up_until`, `revoked_at`, `created_at` | Opaque token; only SHA-256 stored |
| `password_reset_tokens` | `id`, `user_id`, `token_hash`, `expires_at`, `used_at` | 30 min |
| `security_events` | `id`, `user_id`, `type`, `ip`, `user_agent`, `metadata` (jsonb), `created_at` | Account-level events, separate from `audit_logs` |
| `signup_invites` | `id`, `created_by`, `code_hash` (SHA-256, unique), `note`, `expires_at`, `used_at`, `used_by`, `revoked_at`, `created_at` | Codes to create an account while sign-up is closed (`SIGN_UP_MODE=invite`); single use, 7 days; any account makes them. Not synced |
| `rate_limits` | `key` PK (e.g. `signInByIp:1.2.3.4`), `window_started_at`, `count` | Fixed-window counters in Postgres (no Redis); one row per key, reset in place |
| `devices` | `id`, `user_id`, `name`, `platform` (`WINDOWS`, `MACOS`, `ANDROID`, `IOS`, `WEB`), `schema_version`, `last_sync_at`, `revoked_at` | Web sessions also get a device row, without sync |

### Wallets and sharing ([0001](../decisoes/0001-multimoeda.md), [0002](../decisoes/0002-wallets-e-compartilhamento.md), [0003](../decisoes/0003-convites-por-email.md))

| Table | Columns | Notes |
| --- | --- | --- |
| `currencies` | `code` PK (ISO 4217), `name`, `symbol`, `minor_units`, `is_enabled` | Seed: `EUR`, `BRL` |
| `wallets` | `id`, `name`, `currency_code` → `currencies`, `currency_locked_at`, `created_by`, `version`, `created_at`, `updated_at`, `archived_at` | No `owner_id`: ownership lives in `wallet_members` |
| `wallet_members` | `id`, `wallet_id`, `user_id`, `role` (`OWNER`, `ADMIN`, `EDITOR`, `VIEWER`), `invited_by`, `joined_at`, `removed_at`, `removed_by`, `created_at`, `updated_at` | Unique active (`wallet_id`, `user_id`); partial unique index: one active `OWNER` per wallet |
| `wallet_invites` | `id`, `wallet_id`, `invited_email`, `role`, `invited_by`, `token_hash`, `expires_at`, `accepted_at`, `accepted_by`, `declined_at`, `revoked_at`, `revoked_by`, `last_sent_at`, `send_count`, `created_at` | One pending invite per (`wallet_id`, `invited_email`) |
| `wallet_ownership_transfers` | `id`, `wallet_id`, `from_user_id`, `to_user_id`, `previous_owner_action` (`STAY_ADMIN`, `LEAVE`), `token_hash`, `expires_at`, `accepted_at`, `declined_at`, `canceled_at`, `created_at` | One pending transfer per wallet |
| `email_outbox` | `id`, `to_email`, `template`, `locale`, `payload` (jsonb), `status`, `attempts`, `sent_at`, `error`, `created_at` | Invites, transfers, security alerts |
| `notifications` | `id`, `user_id`, `wallet_id` (nullable), `type`, `payload` (jsonb), `read_at`, `created_at` | In-app notifications (invoice due, budget exceeded, invite, transfer...). No stored `title`/`body`: `type` is a translation key rendered in the reader's language with `payload` ([0011](../decisoes/0011-traducoes.md)) |
| `home_layouts` | `id`, `user_id`, `wallet_id`, `widgets` (jsonb `[{ key, size }]`), `created_at`, `updated_at` | Each member's Home layout per wallet ([0019](../decisoes/0019-inicio-personalizavel.md)). Personal preference: not synced yet, not audited, never shown to other members. Unique (`user_id`, `wallet_id`); ID `deterministicId("home_layout", userId, walletId)` |

### Financial core — all **synced**

| Table | Columns | Notes |
| --- | --- | --- |
| `accounts` | `name`, `type` (`CHECKING`, `SAVINGS`, `CASH`, `INVESTMENT`, `BENEFITS`, `OTHER`), `initial_balance_minor`, `institution_code` (nullable), `color` (token: `blue`, `green`, `orange`, `red`, `purple`, `pink`, `teal`, `gray`), `icon`, `is_default` | Balance is derived, not stored (`BALANCE_SIGN` in `@packages/shared/finance`). One active `is_default` per wallet (partial unique index) |
| `credit_cards` | `name`, `payment_account_id` → `accounts`, `brand` (`VISA`, `MASTERCARD`, `ELO`, `AMEX`, `HIPERCARD`, `OTHER`), `limit_minor`, `closing_day`, `due_day`, `color` | |
| `credit_card_invoices` | `credit_card_id`, `reference_year`, `reference_month`, `opening_date`, `closing_date`, `due_date`, `status` (`OPEN`, `PAID`; `CLOSED`/`OVERDUE` derived), `paid_at`, `payment_transaction_id` | Unique (`credit_card_id`, `reference_year`, `reference_month`) |
| `categories` | `wallet_id` (NULL = system), `parent_id` (max 2 levels), `name`, `translation_key`, `kind` (`INCOME`, `EXPENSE`, `BOTH`), `is_system`, `icon`, `color` | System rows: no wallet, `translation_key`, no name; read-only. Wallet rows: a name. Enforced by a `CHECK`. The system list is not seeded yet |
| `hidden_categories` | `category_id` | System categories a wallet hides. Hiding is per wallet, so it cannot be a flag on the shared system row. Unique (`wallet_id`, `category_id`) |
| `transactions` | `account_id`, `credit_card_id`, `invoice_id`, `category_id`, `household_member_id`, `recurrence_id`, `occurrence_date`, `installment_group_id`, `installment_number`, `installment_total`, `type`, `status`, `description`, `amount_minor`, `transaction_date`, `due_date`, `paid_at`, `notes`, `needs_review` | See types and rules below |
| `transaction_links` | `source_transaction_id`, `target_transaction_id`, `type` (`TRANSFER`, `INVOICE_PAYMENT`, `REFUND`) | Both legs of a transfer; a refund to its purchase |
| `tags` | `name`, `color` | Unique (`wallet_id`, lower(`name`)) |
| `transaction_tags` | `transaction_id`, `tag_id` | `id` is UUIDv5 of (`transaction_id`, `tag_id`); unique (`transaction_id`, `tag_id`); tags are referenced by ID, never by name |
| `transaction_attachments` | `transaction_id`, `storage_key`, `file_name`, `mime_type`, `size_bytes`, `sha256` | File in object storage; upload requires internet |
| `recurrences` | `type` (`INCOME`, `EXPENSE`), `description`, `amount_minor`, `account_id` or `credit_card_id`, `category_id`, `frequency` (`DAILY`, `WEEKLY`, `BIWEEKLY`, `MONTHLY`, `BIMONTHLY`, `QUARTERLY`, `SEMIANNUAL`, `YEARLY`), `weekdays` (jsonb, ISO 1–7), `months` (jsonb, 1–12), `day_of_month`, `start_date`, `end_date`, `match_day_tolerance` (default 3 days), `match_amount_tolerance_bps` (default 1000 = 10%) | The amount tolerance is relative, so it follows `amount_minor` when the amount changes (fixes the Minhas Economias bug) |
| `household_members` | `name`, `relationship` (`SELF`, `PARTNER`, `CHILD`, `PARENT`, `SIBLING`, `PET`, `OTHER`), `birth_date`, `color` | "Who spent it" labels; not app users |
| `categorization_rules` | `name`, `priority`, `is_active`, `apply_to_history`, `conditions` (jsonb), `actions` (jsonb) | Conditions: description contains/equals/starts with, amount range, account, type. Actions: category, household member, tag. Never applied to transfers or system categories |

**Transaction `type`:** `INCOME`, `EXPENSE`, `TRANSFER_IN`, `TRANSFER_OUT`, `CREDIT_CARD_PURCHASE`, `CREDIT_CARD_PAYMENT`, `ADJUSTMENT`, `REFUND`.

**Transaction `status`:** `PENDING` (scheduled, recurrence occurrence, card purchase on an unpaid invoice), `PAID`, `CANCELED`.

Rules:

- `amount_minor` is always positive; `type` sets the direction. Exception: `ADJUSTMENT` is signed.
- Account balance = `initial_balance_minor` + Σ(`INCOME`, `TRANSFER_IN`, `REFUND` to account, `ADJUSTMENT`) − Σ(`EXPENSE`, `TRANSFER_OUT`, `CREDIT_CARD_PAYMENT`), over `PAID`, non-archived rows.
- Actual account balances use paid movements. Statement projections explicitly include pending components; card expenses use invoice-due competence, while actual card debt excludes future forecasts under [0022](../decisoes/0022-divida-realizada-e-previsoes-dos-cartoes.md). These scopes must be labeled distinctly.
- A transfer is two rows linked by `transaction_links`; archiving one leg archives both. Transfers are only between accounts of the same wallet (cross-currency transfers are out of scope for v1).
- Invoice reference year/month identify the closing cycle and remain stable. Display titles and payment labels use the saved invoice due month. Card purchases and each installment count in the statement, Home and budgets on the linked invoice due date; their stored transaction date is preserved. Payments affect cash on the payment date and are excluded from expense totals. This is derived on read, with no schema migration. See [0016](../decisoes/0016-competencia-das-faturas.md).
- Installments share `installment_group_id`; the total is split in minor units with leftover cents on the first installment; card installments go to the invoice of their own date.
- A recurrence occurrence has `recurrence_id` + `occurrence_date`, and its `id` is UUIDv5 of both. Creating a recurrence from an existing transaction links that transaction instead of creating a duplicate.
- Tags chosen in the create form are saved in the same write (fixes the Minhas Economias bug where tags were dropped).

Enforced by the database (`CHECK` and keys in `finance.ts`):

- exactly one of `account_id` and `credit_card_id`;
- `CREDIT_CARD_PURCHASE` always on a card, and only it (or a `REFUND`) may use a card;
- `invoice_id` only with a card;
- `recurrence_id` and `occurrence_date` both set or both empty; one transaction per occurrence;
- installment fields all set or all empty, with `1 ≤ installment_number ≤ installment_total`;
- amount rule above; one default account per wallet; tag names unique per wallet ignoring case.

### Planning and patrimony — all **synced**

| Table | Columns | Notes |
| --- | --- | --- |
| `budgets` | `name` | Named budgets, as in Wallefy |
| `budget_items` | `budget_id`, `category_id`, `year`, `month`, `amount_minor`, `alert_percentage` | Unique (`budget_id`, `category_id`, `year`, `month`); alert drives a notification |
| `goals` | `name`, `template` (`EMERGENCY_FUND`, `RETIREMENT`, `TRAVEL`, `HOUSE`, `CAR`, `EDUCATION`, `DEBT_PAYOFF`, `OTHER`), `target_minor`, `initial_minor`, `deadline`, `expected_annual_return_bps` (nullable), `achieved_at` | Saved amount is derived from deposits; if a return rate is set, it is actually used (fixes the ignored 7.45% rate in Minhas Economias) |
| `goal_deposits` | `goal_id`, `amount_minor`, `deposit_date`, `notes`, `transaction_id` (nullable) | Positive adds, negative withdraws (never 0). Optionally linked to the transaction that funded it |
| `assets` | `kind` (`ASSET`, `LIABILITY`), `type` (`REAL_ESTATE`, `VEHICLE`, `ELECTRONICS`, `BUSINESS`, `COLLECTIBLE`, `RIGHTS`, `INVESTMENT`, `LOAN`, `FINANCING`, `OTHER`), `name`, `current_value_minor`, `purchase_value_minor`, `purchase_date`, `ownership_bps`, `notes` | Net worth = account balances + assets − liabilities − actual outstanding card debt (excludes future forecasts; includes future installments of purchases already made, see [0022](../decisoes/0022-divida-realizada-e-previsoes-dos-cartoes.md)) |
| `asset_liabilities` | `asset_id`, `liability_id` | Informational many-to-many association between opposite-kind entries in the same wallet; unique pair. IDs are deterministic; unlink archives, relink restores. Never changes net worth. See [0017](../decisoes/0017-bens-e-financiamentos.md) |

### Sync and audit ([0005](../decisoes/0005-offline-first-e-sincronizacao.md), [0006](../decisoes/0006-auditoria.md))

| Table | Columns | Notes |
| --- | --- | --- |
| `sync_mutations` | `mutation_id` PK, `wallet_id`, `user_id`, `device_id`, `entity`, `entity_id`, `op` (`CREATE`, `UPDATE`, `ARCHIVE`, `RESTORE`), `changes` (jsonb), `base_version`, `occurred_at`, `received_at`, `status` (`ACCEPTED`, `CONFLICT`, `REJECTED`), `reason` | Idempotency by `mutation_id` |
| `sync_conflicts` | `id`, `wallet_id`, `mutation_id`, `entity`, `entity_id`, `field`, `server_value`, `device_value`, `resolved_at`, `resolved_by`, `resolution` | Shown in the "Review conflicts" screen |
| `audit_logs` | `id`, `wallet_id`, `actor_user_id`, `device_id`, `source` (`APP`, `SYNC`, `RULE`, `RECURRENCE`, `IMPORT`, `SYSTEM`), `source_ref_id`, `action`, `entity`, `entity_id`, `changes` (jsonb), `occurred_at`, `recorded_at`, `mutation_id`, `correlation_id`, `prev_hash`, `hash` | Append-only; `UPDATE`/`DELETE` blocked |

PowerSync handles the download stream, so no server-side `pull` sequence table is needed. Sync rules select rows by the user's active `wallet_members`.

## Critical indexes

```
transactions        (wallet_id, transaction_date)
transactions        (wallet_id, category_id)
transactions        (wallet_id, account_id)
transactions        (invoice_id)
transactions        (recurrence_id, occurrence_date) unique where recurrence_id is not null
wallet_members      (user_id) where removed_at is null
wallet_members      (wallet_id) unique where role = 'OWNER' and removed_at is null
wallet_invites      (wallet_id, lower(invited_email)) unique where pending
audit_logs          (wallet_id, recorded_at)
audit_logs          (entity, entity_id)
sync_mutations      (wallet_id, received_at)
user_sessions       (token_hash) unique
notifications       (user_id, read_at)
home_layouts        (user_id, wallet_id) unique
```

## Changes from Wallefy

| Wallefy | finfy |
| --- | --- |
| SQLite + Turso, device is the source of truth | Postgres + PowerSync, server is the source of truth |
| `wallets.owner_id` and `OWNER` role both store ownership | Only `wallet_members` |
| Roles `OWNER`, `EDITOR`, `VIEWER` | Adds `ADMIN` |
| `accounts.currency` may differ from the wallet | One currency per wallet |
| Money ×100 always | `minor_units` per currency |
| `wallet_invites` without revoke/decline | Full invite lifecycle |
| No ownership transfer | `wallet_ownership_transfers` |
| `audit_logs` with full before/after, `CREATE`/`UPDATE` only | Field-level diff, source, membership events, hash chain |
| Denormalized names (`category_name`...) in `transactions` | Not stored: the local SQLite replica makes joins cheap; avoids keeping copies in sync |
| Categorization rule: single `match_type` + `pattern` | Conditions and actions as JSON, with priority |

## Open questions

- [x] Financial core, planning and patrimony approved as drafted (2026-10-25). Changes made while writing the schema: `hidden_categories` instead of `categories.is_hidden`, composite foreign keys for tenancy, deterministic IDs for invoices and budget items.
- [x] No denormalized names in `transactions`: joins, as proposed.
- [x] Refunds are a separate `REFUND` type, linked to the purchase by `transaction_links` (2026-10-25).
- [x] No `fx_rates` in v1 (2026-10-25, see [0001](../decisoes/0001-multimoeda.md)).
- [ ] The list of system categories (names, icons, hierarchy). A proposal of 72 categories is seeded (2026-10-25, `packages/shared/src/system-categories.ts`, inspired by Minhas Economias without the Brazil-only taxes); waiting for review.

## Dated statement account balance

The statement returns projected `summary.accumulatedBalanceMinor` = `confirmedBalanceMinor` (active account opening balances plus paid movements) + signed `accumulatedPendingMinor` (pending account movements and unpaid card purchases). Account movements use transaction dates through inclusive `to`; unpaid card purchases use saved invoice due dates and the card payment account. Paid purchases leave the projection; the actual invoice payment debits confirmed cash once. Reopening reverses that substitution. Only the account filter applies. Initial balances have no effective date; historical views reflect current account/archive state. Pending entries already stored are included, without generating extra recurrence occurrences. Actual account balance and net worth rules remain unchanged. See [0018](../decisoes/0018-resultado-acumulado-do-extrato.md).

Actual card debt and used credit share one read rule: non-archived, non-canceled purchases on open non-archived invoices dated through today (UTC), plus future installments whose original first purchase has already occurred in the same wallet/card. The origin must be active and non-canceled; its own invoice may already be paid. Future standalone/recurring purchases and entirely future installment groups remain forecasts. Invoice-cycle totals and statement/planning projections retain their existing rules. No migration; see [0022](../decisoes/0022-divida-realizada-e-previsoes-dos-cartoes.md).

### Card overview read fields (2026-10-27)

Card reads derive nextInvoice (first unpaid actual debt due today or later), overdueMinor/count and oldest overdueInvoice, and nextForecast (first upcoming cycle with projected amount above committed debt). Paid and archived invoices are excluded. These are read fields, not stored columns. Detail totals retain forecasts. See [0023](../decisoes/0023-contas-e-proximas-faturas.md).
