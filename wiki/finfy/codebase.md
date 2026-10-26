# finfy — Codebase

> Last updated: 2026-10-26

How the code is organized and how to run it. The reasons behind each choice are in the decisions: [0008](../decisoes/0008-linguagem-visual.md) (UI), [0009](../decisoes/0009-react-tauri-capacitor.md) (clients), [0010](../decisoes/0010-nextjs-na-vercel.md) (Next.js on Vercel, Drizzle), [0011](../decisoes/0011-traducoes.md) (translations).

## Status

The web version is complete for daily use (2026-10-26). Everything below runs on the approved data model:

| Done | Not yet |
| --- | --- |
| pnpm monorepo, shared configs | MFA (TOTP, recovery codes), password reset (needs e-mail), "connected devices" screen, Google/Apple sign-in |
| Account settings: name, password change ending other sessions | Changing the e-mail |
| Sign-up, sign-in, sign-out, sessions, account lockout, rate limits, `/app` protected (see [Authentication](#authentication)). No e-mail step for now | Ownership transfer |
| Sharing: members, roles, invites by private link (see [Sharing](#sharing-members-and-invites)) | Invites by e-mail |
| `packages/ui` copied from image-resizer | Security e-mails (new device, password changed) |
| Drizzle schema + migrations for the whole [data model](data-model.md): identity, wallets and sharing, financial core, planning and patrimony, sync and audit | Review of the system category list (proposal) |
| Money, IDs, roles and permission matrix, locales | `POST /api/sync/push`, conflict records (`sync_conflicts`), audit chain check job |
| Wallets: create, list, switch (remembered per browser), rename, change currency before the first entry, archive with the password (see [Wallets](#wallets)) | |
| Activity feed and hash-chain check (see [Activity](#activity)) | Item history, filters, CSV export |
| One write path: idempotent mutations and a hash-chained audit log (see [Write path](#write-path)) | |
| Accounts: create, edit, main account, archive and restore, balance computed from transactions (see [Accounts](#accounts)) | |
| Credit cards: cards, purchases with installments, invoices by month, pay and reopen (see [Credit cards](#credit-cards)) | Partial invoice payments, card refunds |
| Planning (menu "Planejamento", `/app/goals`): monthly budget per category, goals with deposits (see [Planning](#planning)) | Goal return rate |
| Tags, recurrences, categorization rules, patrimony and net worth (see their sections) | Attachments, household members |
| In-app notifications (see [Notifications](#notifications)) | Push and e-mail notifications |
| Transactions: income, expense, transfers, pending/paid, Statement by month with filters and search, Home summary (see [Transactions](#transactions)) | Installments outside cards, CSV import |
| Categories: 72 system categories (proposal), hide per wallet, own categories and subcategories (see [Categories](#categories)) | |
| Public home page in `en` and `pt-BR`, with hreflang | Other public pages (pricing, help...) |
| Signed-in app shell (`/app`): sidebar, bottom bar on phones, language and theme switchers, window width lock/unlock (cookie `finfy-window-wide`, desktop only) | E-mail sending (provider not chosen), cron jobs |
| `GET /api/health`; API documented with OpenAPI + Swagger UI (see [API documentation](#api-documentation)) | Tauri and Capacitor shells, PowerSync |

## Layout

| Path | What | Depends on |
| --- | --- | --- |
| `apps/web` | Next.js 16: public pages (`app/(public)/[locale]`), signed-in app (`app/(app)/app`), API (`app/api`) | everything below |
| `packages/app` | Signed-in screens. **Never imports Next.js**: routing comes in through `AppNavigationProvider` (`Link` + `pathname`), data through transports the host passes in (`AuthClient`, `WalletClient`) | `ui`, `shared`, `use-intl` |
| `packages/ui` | shadcn components restyled for macOS, tokens, `globals.css`. A copy of image-resizer's, evolving on its own | — |
| `packages/shared` | Pure code used by client and server: `money`, `ids`, `roles`, `finance` (value lists, `BALANCE_SIGN`), `auth`, `wallets` and `accounts` (input and response schemas), `i18n` (locales + messages), and the Drizzle schema (`db/schema`, server only) | `drizzle-orm`, `uuid`, `zod` |
| `packages/env` | Env validation (t3-env + zod): `client` and `server` | — |

Two root layouts, each rendering `<html>` through `components/root-document.tsx`:

- `app/(public)/[locale]/layout.tsx`: the locale comes from the URL.
- `app/(app)/app/layout.tsx`: the locale comes from the `finfy-locale` cookie (later `users.language`), then Accept-Language, then `en`.

`proxy.ts` (next-intl) only runs on public paths. It redirects `/` and unprefixed paths by Accept-Language (fallback `en`) and maps `/pt-br` to the `pt-BR` locale. Keep `\\.` escaped in its matcher: with a single backslash every non-root path skips the proxy.

## Commands

Run from the repo root (Windows PowerShell: use `pnpm.cmd`).

| Command | What |
| --- | --- |
| `pnpm install` | Install |
| `pnpm dev` | Dev server on http://localhost:3000 |
| `pnpm build` | Production build of `web` |
| `pnpm typecheck` | `tsc --noEmit` in every package; `web` runs `next typegen` first |
| `pnpm test` | Unit tests (`node --test`, TypeScript run directly by Node 24) |
| `pnpm check:messages` | Fails if `en` and `pt-BR` do not have the same keys |
| `pnpm openapi` | Rewrites `apps/web/openapi.json` from `apps/web/lib/openapi.ts` |
| `pnpm check:openapi` | Fails if `apps/web/openapi.json` is out of date |
| `pnpm db:up` | Local Postgres 17 with `wal_level=logical` (Docker, `docker-compose.yml`) |
| `pnpm db:generate` | Generate a migration from the schema (`packages/shared/drizzle`) |
| `pnpm db:migrate` | Apply migrations to `DATABASE_URL` (default: the local Docker database) |

Run `typecheck`, `test`, `check:messages` and `check:openapi` before committing.

Environment variables are in `apps/web/.env.example`. `DATABASE_URL` and `PASSWORD_PEPPER_V1` are optional: without them the public pages work, `/api/health` answers `database: "not_configured"`, the auth API answers `unavailable` (503), and `/app` redirects to sign-in.

## Rules for code

- **Animation:** `motion` is installed in `packages/app` (imports from `motion/react`). `AppShell` animates its screen container on mount and pathname changes: 200 ms fade with a 6 px rise; reduced or unknown motion preference uses only a 120 ms fade. The container is not keyed, so animations do not remount children or delay navigation. Existing CSS animations stay intact. See [0012](../decisoes/0012-motion.md). Avoid competing animation owners for the same property on an element and respect reduced motion.

- Server components never import values from `"use client"` modules: they get a client reference, not the value (a `redirect` to it fails with "Invalid character in header content"). Shared constants go in plain modules, like `APP_BASE` in `@packages/app/app-base`.

- **Text:** no fixed text in components, API responses or e-mails. Add the key to both `packages/shared/src/i18n/messages/*.json`. Message keys are typed: a missing key is a compile error. UI components that need a label (`DialogContent closeLabel`, `Spinner label`, `TrafficLights labels`) get the translated text from the caller.
- **Money:** integers in minor units; format with `formatMoney`, parse input with `parseMoney`. Never floats in storage or arithmetic.
- **IDs:** `newId()` (UUIDv7) on the client; `deterministicId()` (UUIDv5) for rows two offline devices may create.
- **Permissions:** `can()` / `canChangeRole()` from `@packages/shared/roles`. The server always checks; the client only hides.
- **Schema:** follow [data-model.md → Sync-ready schema rules](data-model.md#sync-ready-schema-rules). Enums are `textEnum` + `enumCheck`. Synced tables use `syncedColumns()` and are listed in `SYNCED_TABLES` **and** in the `powersync` publication migration.
- **Migrations:** generated by `pnpm db:generate`, committed, never edited after being applied anywhere. Hand-written SQL (seed data, triggers, publication) goes in a `drizzle-kit generate --custom` migration.
- **API:** every route under `apps/web/app/api` is described in `apps/web/lib/openapi.ts`, using the same zod schemas the route parses (inputs and responses live in `@packages/shared`). Then run `pnpm openapi` and commit `openapi.json`.
- **Writes:** every change to a synced table goes through a server command that calls `recordMutation` (see [Write path](#write-path)), inside one transaction. Never write synced tables from a route directly.
- **Screens:** new signed-in screens go in `packages/app/src/screens`; the Next.js page only renders them. Use `@packages/ui` components; new shadcn components follow the recipe in [0008](../decisoes/0008-linguagem-visual.md).

## Write path

Implements rule 7 of [data-model.md → Sync-ready schema rules](data-model.md#sync-ready-schema-rules) and [0006](../decisoes/0006-auditoria.md). Code: `apps/web/lib/server/write.ts`.

| Piece | What it does |
| --- | --- |
| Client IDs | The client sends the new row's `id` (UUIDv7) and a `mutationId` with every write, on the web too |
| Idempotency | `findApplied` looks the `mutationId` up in `sync_mutations`. A retry of an applied mutation changes nothing and answers with the current state. Another user's `mutationId` is refused |
| `recordMutation` | In the command's transaction: inserts the `sync_mutations` row (`ACCEPTED`) and one `audit_logs` entry per change, with a field-level diff (`{ field: { from, to } }`) |
| Hash chain | Per wallet. `hash` = SHA-256 of `prev_hash` + the entry as JSON with sorted keys. An advisory lock per wallet serializes writers; chain order is (`recorded_at`, `id`), with `recorded_at` taken from the database clock |
| Versions | Each accepted change bumps the row's `version`; clients send the `baseVersion` they edited |

The chain was checked on 2026-10-25 by recomputing every hash outside the app. A scheduled check job does not exist yet. Only accepted mutations are recorded for now; `CONFLICT`/`REJECTED` rows and `sync_conflicts` arrive with `POST /api/sync/push`.

## Wallets

Implements part of [0002](../decisoes/0002-wallets-e-compartilhamento.md). Server: `apps/web/lib/server/wallets.ts` (commands) and `wallet-route.ts` (shared route shape). Client: `packages/app/src/wallets.tsx` (state, `WalletClient`), `wallet-ui.tsx` (switcher, create dialog), `screens/settings.tsx`.

| Route | Who | Notes |
| --- | --- | --- |
| `GET /api/wallets` | Any member | Active wallets with the user's role |
| `POST /api/wallets` | Any user | The creator becomes OWNER; audit entries `CREATE` and `MEMBER_JOINED` |
| `PATCH /api/wallets/:id` | OWNER, ADMIN | Name: last write wins. Currency: only before the first entry (`currencyLocked`) and only from the latest version (`versionConflict`) |
| `POST /api/wallets/:id/archive` | OWNER | Asks for the password again (step-up), 5 tries per 15 minutes per user; a wrong password records `STEP_UP_FAILED` in `security_events` |

Roles are read from `wallet_members` on every request. A wallet the user cannot see answers `404`, never `403`, so its existence is not revealed.

The current wallet is remembered per browser in the `finfy-wallet` cookie and read on the server, so the first paint shows it. On phones the switcher sits at the top of every screen.

## Accounts

Server: `apps/web/lib/server/accounts.ts`; shared helpers for every wallet-scoped command (one transaction, role check, error codes) in `lib/server/commands.ts`. Client: `packages/app/src/accounts.tsx` (`AccountClient`, `useAccountList`) and `screens/accounts.tsx`.

| Route | Who |
| --- | --- |
| `GET /api/wallets/:id/accounts[?archived=1]` | Any member |
| `POST /api/wallets/:id/accounts` | OWNER, ADMIN, EDITOR |
| `PATCH /api/wallets/:id/accounts/:accountId` | OWNER, ADMIN, EDITOR |
| `POST /api/wallets/:id/accounts/:accountId/archive` and `/restore` | OWNER, ADMIN, EDITOR |

Rules:

- **Balance** = `initial_balance_minor` + Σ amount × `BALANCE_SIGN[type]` over the account's `PAID`, non-archived transactions. Computed in the list query, never stored. Card purchases do not touch the account (they go to the invoice). Checked on 2026-10-25 with temporary rows: a pending income was ignored, an expense, an income and a negative adjustment added up.
- **Main account:** exactly one per wallet among active accounts. The first account becomes it; making another one main clears the previous (both audited). Archiving the main account passes the mark to the oldest active account; restoring one makes it main only if the wallet has none.
- **Conflicts:** name and color, last write wins. Type and initial balance change money, so they need the latest `baseVersion` (`409 versionConflict`).
- **Currency lock:** an account with a non-zero initial balance sets `wallets.currency_locked_at` (audited as `CURRENCY_LOCKED`). See [0001](../decisoes/0001-multimoeda.md).
- **Colors** are tokens (`blue`, `green`...), drawn with Apple system colors; no institution list yet.
- **Amounts typed by the user** are parsed with `parseMoney` and the language's decimal separator; floats never reach the API (`initialBalanceMinor` must be an integer).

## Categories

Server: `apps/web/lib/server/categories.ts`. Client: `packages/app/src/categories.tsx` (icons, labels, `useCategories`, `CategoryPicker`) and `screens/categories.tsx` (Settings → Categories, `/app/settings/categories`).

- **System list:** `packages/shared/src/system-categories.ts`, seeded by migration `0005_seed_system_categories.sql`. IDs are `deterministicId("system_category", key)`; labels are `categories.<key>` in the message files. A test checks keys, order, translations and the migration. Adding categories needs a new migration; never edit or reuse a shipped key. **The list is a proposal (2026-10-25) waiting for review.**
- **Hide:** system categories are hidden per wallet through `hidden_categories` (ID `deterministicId("hidden_category", walletId, categoryId)`); showing archives that row, hiding again restores it.
- **Own categories:** name, icon (fixed set of lucide names in `CATEGORY_ICONS`), color token. A subcategory hangs from a top-level category of the same kind, system or own; two levels at most. Subcategories take the parent's icon and color.
- **Archive:** archiving a category archives its subcategories; a subcategory is restored only while its parent is active. Transactions keep pointing at archived categories.
- `usableCategory()` is what other commands call to accept a category in a write (system, or the wallet's, not archived).

## Transactions

Server: `apps/web/lib/server/entries.ts`. Shared: `@packages/shared/transactions`. Client: `packages/app/src/entry-form.tsx` (`EntryDialog`), `screens/statement.tsx` (Statement, `EntryRow`, `useWalletAccounts`), `screens/home.tsx`, `money.tsx` (`useMoney`, `todayIso`).

| Route | Who |
| --- | --- |
| `GET /api/wallets/:id/transactions?from&to[&accountId&categoryId&q]` | Any member |
| `POST /api/wallets/:id/transactions` (income or expense) | OWNER, ADMIN, EDITOR |
| `POST /api/wallets/:id/transactions/transfers` | OWNER, ADMIN, EDITOR |
| `PATCH /api/wallets/:id/transactions/:entryId` | OWNER, ADMIN, EDITOR |
| `POST /api/wallets/:id/transactions/:entryId/archive` ("delete") | OWNER, ADMIN, EDITOR |

Rules:

- Amounts are positive minor units; the type gives the direction. The category must fit the type (`EXPENSE`/`INCOME`, or `BOTH`).
- **Status:** `PAID` sets `paid_at`; `PENDING` counts in no balance or total, only in the "pending" figures. "Mark as paid" is a `PATCH` of `status`.
- **Transfers:** two rows (`TRANSFER_OUT` with the request `id`, `TRANSFER_IN` with `inId`) and a `transaction_links` row (`TRANSFER`, ID `deterministicId("transaction_link", outId, inId, "TRANSFER")`). Editing a leg mirrors amount, date, status, description and notes to the other; `accountId` moves only that leg. Archiving one leg archives both and the link. Transfers are not income or expense.
- **Conflicts:** description, notes and category, last write wins. Amount, date, account and status need the latest `baseVersion` (`409 versionConflict`).
- **Totals** (`summary`): paid `INCOME`; paid `EXPENSE` plus `CREDIT_CARD_PURCHASE` (on its linked invoice due date, whatever the invoice status); pending income and expense apart. The Home "where the money went" uses the same rule, grouped by top-level category.
- The first entry locks the wallet's currency.
- Checked on 2026-10-25: balances after expense, income, pending, transfer, transfer edit and transfer delete; filters by category (with subcategories) and search; stale edits.

## Credit cards

Invoice titles and payment labels use the saved due month, including existing payment labels on read. Internal reference months, IDs and API routes still identify closing months. Statement filtering, ordering, grouping and totals use derived optional `statementDate`; card purchases use the linked invoice due date and other entries their transaction date. Original purchase dates remain visible. Home categories, budget spending and budget alerts share this competence. Payments debit accounts on their actual date and never duplicate expenses. The card list still selects the current purchase cycle. See [0016](../decisoes/0016-competencia-das-faturas.md).

Regression SQL is executed against isolated in-memory SQLite tables by `apps/web/test/statement-dates.test.ts`; no account or external database is used.

Server: `apps/web/lib/server/cards.ts`. Shared: `@packages/shared/cards` (schemas) and `invoice-math.ts` (pure, tested). Client: `packages/app/src/cards-ui.tsx` (cards section, card form, purchase dialog, `InstallmentsSelect`, `ConfirmDialog`) and `screens/card.tsx` (`/app/accounts/cards/:cardId`). The "New entry" form also charges an expense to a card.

| Route | Who |
| --- | --- |
| `GET/POST /api/wallets/:id/cards`, `PATCH .../cards/:cardId`, `POST .../archive`, `.../restore` | Read: any member. Write: OWNER, ADMIN, EDITOR |
| `GET .../cards/:cardId/invoices` and `.../invoices/:month` (`YYYY-MM`) | Any member |
| `POST .../invoices/:month/pay` and `.../reopen` | OWNER, ADMIN, EDITOR |
| `POST .../cards/:cardId/purchases`, `PATCH .../purchases/:entryId`, `POST .../purchases/:entryId/archive` | OWNER, ADMIN, EDITOR |

Rules:

- **Invoice of a purchase:** the invoice of reference month M closes on the closing day of M (the month's last day when shorter) and is due on the due day, in M when the due day comes after the closing day, otherwise in M+1. A purchase goes to the invoice of its own month when its day is on or before the closing day, otherwise to the next one. Invoice rows are created on demand with ID `deterministicId("invoice", cardId, year, month)`.
- **States:** `OPEN` and `PAID` are stored; `CLOSED` (after closing) and `OVERDUE` (after due) come from today's date.
- **Installments:** the total is split in minor units with the leftover on the first; installment k is dated k−1 months after the purchase (day clamped) and lands on that date's invoice. IDs: the first keeps the request `id`, the others `deterministicId("installment", id, k)`; `installment_group_id` is the first ID. Editing changes description, category and notes of every installment; amount and date need a new purchase.
- **Purchases** are `CREDIT_CARD_PURCHASE` rows, `PENDING` until their invoice is paid. They never touch an account balance and count as expense on their linked invoice due date.
- **Paying** creates one `CREDIT_CARD_PAYMENT` (paid) from the chosen account for the whole total, marks the invoice and its purchases `PAID` and stores `payment_transaction_id`. Partial payments are not supported yet (`amountMinor` must equal the total). A paid invoice refuses new purchases and deletions (`409 invoicePaid`). **Reopening** archives the payment and puts invoice and purchases back to open/pending.
- **Limit used** = purchases of unpaid invoices.
- **Changing closing or due day** affects only invoices opened afterwards; existing invoices keep their dates.
- Checked on 2026-10-25: purchases before and after closing, 3 installments of 100,00 (33,34 + 33,33 + 33,33 on three invoices), wrong payment amount, payment debit, writes on a paid invoice, reopen, edit and delete of every installment, month totals.

## Planning

Server: `apps/web/lib/server/planning.ts`. Shared: `@packages/shared/planning`. Client: `packages/app/src/screens/planning.tsx` (tabs Budget and Goals).

| Route | Who |
| --- | --- |
| `GET /api/wallets/:id/budget/:month` | Any member |
| `POST .../budget/:month/set`, `/remove`, `/copy-previous` | OWNER, ADMIN, EDITOR |
| `GET/POST /api/wallets/:id/goals`, `GET/PATCH .../goals/:goalId`, `POST .../archive`, `.../restore` | Read: any member. Write: OWNER, ADMIN, EDITOR |
| `POST .../goals/:goalId/deposits`, `POST .../deposits/:depositId/archive` | OWNER, ADMIN, EDITOR |

Rules:

- **One budget per wallet**, created on first use with ID `deterministicId("budget", walletId)` (the `budgets` table allows named budgets; the screens do not use that yet).
- **Limits** are per top-level expense category and month; item ID `deterministicId("budget_item", budgetId, categoryId, year, month)`, so setting a limit is an upsert and removing archives it. Last write wins.
- **Spent** = paid expenses plus card purchases of the month in the category and its subcategories (same rule as the Statement totals). The screen shows "near the limit" from `alert_percentage` and "over the limit" above 100%. Notifications for alerts do not exist yet.
- **Goals:** saved = initial amount + deposits (positive adds, negative takes out). `achieved_at` is set while saved ≥ target and cleared when it drops. Deposits are manual, as in Minhas Economias; they do not move money between accounts. The screen shows what to save per month to reach the deadline (`monthlyNeeded`), without returns: `expected_annual_return_bps` is not used yet.
- Checked on 2026-10-25: limits on subcategories and income categories refused, copy from the previous month, remove twice, goal achieved on, off and on again with deposits and a deleted withdrawal.

## Sharing (members and invites)

Server: `apps/web/lib/server/members.ts`. Client: `packages/app/src/members-ui.tsx` (Settings → Members) and `screens/invite.tsx` (`/app/invites/:token`).

- Without e-mail, an invite is a **private link** (32 random bytes, only the SHA-256 stored, valid 7 days). Accepting needs the link **and** being signed in with the invited e-mail. Re-inviting the same e-mail or "New link" replaces the token; the old link stops working.
- Who may invite, change roles and remove follows the 0002 matrix (`canInvite`, `canChangeRole`, `canRemoveMember` in `@packages/shared/roles`, tested). The owner cannot leave.
- `/app` pages without a session go to sign-in with `?next=` (only `/app/...` paths accepted, `lib/next-path.ts`); the proxy passes the path to the layout in a header.
- Audit actions: `INVITE_SENT`, `INVITE_RESENT`, `INVITE_REVOKED`, `INVITE_ACCEPTED`, `INVITE_DECLINED`, `MEMBER_JOINED`, `MEMBER_ROLE_CHANGED`, `MEMBER_REMOVED`, `MEMBER_LEFT`.

## Notifications

Server: `apps/web/lib/server/notifications.ts`. Client: `packages/app/src/notifications-ui.tsx` (bell in the title bar, refreshed every 5 minutes).

- Computed on each read across the user's wallets: budget limits near (`alert_percentage`) or over this month, unpaid invoices due within 5 days or overdue, pending income/expenses dated today or earlier (key per day, so it comes back daily while they wait).
- Only "read" is stored: a `notifications` row per user and key, ID `deterministicId("notification", userId, key)`. Opening the bell marks the unread ones read. Texts are message keys (`app.notifications.types.*`) filled with the payload, in the reader's language.
- Not yet: push and e-mail, invite and transfer notifications.

## Patrimony

Server: `apps/web/lib/server/patrimony.ts`. Shared: `@packages/shared/patrimony`. Client: `packages/app/src/patrimony-ui.tsx` (`NetWorthCard` on top of Accounts and cards, `AssetsSection` at the bottom).

- Assets (`REAL_ESTATE`, `VEHICLE`, `ELECTRONICS`, `BUSINESS`, `COLLECTIBLE`, `RIGHTS`, `INVESTMENT`, `OTHER`) and debts (`LOAN`, `FINANCING`, `OTHER`), with value today, purchase value and date, ownership share (basis points) and notes. Values are estimates: last write wins.
- **Net worth** (`GET /api/wallets/:id/net-worth`) = active account balances + assets − debts, each by its share (`ownedPart`), − purchases on invoices still open. Checked on 2026-10-26 against the accounts screen and by hand.
- **Financing associations** ([0017](../decisoes/0017-bens-e-financiamentos.md)): create/edit either kind with optional `linkedIds`; omitted preserves, a list replaces, `[]` removes all. Only opposite-kind entries in the same wallet. Both forms offer checkboxes and the list shows associated names, owned values and archived status to every member. Archived endpoints retain their links but cannot receive new ones.
- Relationship replacement requires the current `baseVersion` (otherwise `versionConflict`); changing a link bumps both endpoints. Writes and archive operations serialize per wallet. Link rows use deterministic pair IDs, soft archive/restore and field-level audit in the same idempotent mutation as the entry. No schema migration: the table and PowerSync publication already exist. Net worth never joins link rows and counts each entry once. Recurring payments do not amortize these estimates.
- Responses include `linkedIds` and `linkedAssets` (id, name, current value, ownership and archived flag), batched for list reads.
- Integration test: from `apps/web`, with the local Docker Postgres running, set `$env:FINFY_TEST_LOCAL_POSTGRES='1'` and run `node --conditions=react-server --import=tsx --test test/patrimony.integration.ts`. It creates, migrates and drops only a disposable `finfy_test_patrimony_*` database using the compose development credentials. Never point it at a real database.
- Not yet: value history, investments.

## Categorization rules

Server: `apps/web/lib/server/rules.ts`. Shared: `@packages/shared/rules` (schemas) and `rule-match.ts` (pure, tested: `ruleMatches`, `resolveRules`). Client: `packages/app/src/screens/rules.tsx` (Settings → Rules, `/app/settings/rules`) and the suggestion in the entry form.

- **Conditions** (all must hold): type, description (contains / starts with / equals, ignoring case and accents), amount range, account or card. A rule needs more than the type alone.
- **Actions:** set the category (only applied when it fits the entry's direction) and add tags.
- **Order:** priority, lowest first (new rules go last). The first matching rule with a category sets it; tags of every matching rule add up.
- **Never** on transfers, invoice payments or adjustments (Minhas Economias caught a transfer).
- **History:** `POST /rules/preview` counts matches before saving. Saving with "also change existing entries", editing with it on (Minhas Economias did not reapply on edit), or "Apply now" changes existing entries; the audit records source `RULE` and the rule's ID (`recordMutation` now takes `source`/`sourceRefId`; recurrence top-ups use `RECURRENCE`).
- **New entries:** rules do not overwrite what a person typed. The entry form suggests the category (and tags) of the first matching rule while the description is typed, and stops as soon as a category is picked by hand.
- Checked on 2026-10-26: preview, apply on save, second apply changes nothing, transfers never matched, foreign tag and empty conditions refused, suggestion in the form.

## Recurrences

The entry form exposes the first due date and, for repeating expenses, the amount per installment. The repetition can end never, on a date, or after a positive integer count including the first occurrence. `endDateForCount` in `schedule.ts` converts count to an inclusive `endDate` with the same calendar rules as the server; the calculated last due date is shown in the current locale. Invalid counts and end dates before the first due date cannot be submitted. Switching back to a single entry or a transfer ignores recurrence end controls. The API and schema are unchanged; editing a recurrence continues to use its stored end date. This records payments only, without linking an asset or reducing a patrimony debt. See [0014](../decisoes/0014-prestacoes-por-recorrencia.md).

Server: `apps/web/lib/server/recurrences.ts`. Shared: `@packages/shared/recurrences` and `schedule.ts` (pure, tested). Client: `packages/app/src/recurrences-ui.tsx` (`RepeatSelect`, `useRecurrenceRefresh`), `screens/recurrences.tsx` (`/app/statement/recurrences`), and "Repeat" in the entry form.

- **Occurrences are real entries**, `PENDING`, with ID `deterministicId("occurrence", recurrenceId, date)` and `recurrence_id` + `occurrence_date` (unique). They count in no balance until marked paid. Card recurrences create `CREDIT_CARD_PURCHASE` occurrences on their date's invoice and skip paid invoices.
- **Dates:** `nthDate` steps days (daily, weekly, biweekly) or months (monthly … yearly) from the start, keeping the start's day clamped to shorter months, so a February never shifts the following months.
- **Horizon:** 90 days. Created up to it on create and edit; `POST /recurrences/refresh` tops up from today when the Statement or Home opens. An existing row for a date (even one a user deleted) is never recreated.
- **From an existing entry** (`fromEntryId`, "Repeat this entry" when editing): the entry becomes the first occurrence; no copy is created (Minhas Economias bug 2).
- **Editing** applies from today: pending occurrences still on the schedule take the new values in place, others are archived, missing dates are created. Past and paid ones stay. Amount, source and frequency need the latest version; description, category and end date are last-write-wins.
- **Ending** archives the recurrence and its pending occurrences from today.
- Not yet: matching typed entries to occurrences by the tolerances (`match_day_tolerance`, `match_amount_tolerance_bps`), weekdays and months filters.
- Checked on 2026-10-26: first paid, refresh no-op, edit from today, deleted occurrence not recreated, end, from-entry without duplicate, form with "Repeat: every month".

## Tags

Server: `apps/web/lib/server/tags.ts`. Client: `packages/app/src/tags-ui.tsx` (`useTags`, `TagPicker`, `TagChip`, `TagsManager` in Settings → Categories → Tags).

- Unique per wallet ignoring case among active tags. Creating an existing name answers the existing tag (two offline devices typing "food" end with one tag). Renaming or restoring onto a taken name is refused.
- **On entries:** `transaction_tags` rows with ID `deterministicId("transaction_tag", transactionId, tagId)`; removing archives the row, adding again restores it. `applyTags` is called inside the entry and purchase commands, so tags chosen in the create form are saved in the same write (the Minhas Economias bug). Later changes go through `POST /api/wallets/:id/transactions/:entryId/tags` (replace the set; all installments of a card purchase). Transfers have no tags in the form.
- Archived tags disappear from entries, pickers and filters; restoring brings them back on the same entries.
- The Statement filters by tag (`tagId`). Rows show tag chips.
- Checked on 2026-10-26: case-insensitive reuse, foreign tag refused, set/remove/re-add, purchase with 3 installments tagged, filter across months, archive and restore.

## Activity

Server: `apps/web/lib/server/activity.ts`. Client: `packages/app/src/screens/activity.tsx` (Settings → Activity, `/app/settings/activity`).

- `GET /api/wallets/:id/activity[?before=]`: the audit log, newest first, 50 per page, for any member (decision 0006). The screen shows action and entity labels, who and when, and each changed field with old → new; money fields are formatted, roles translated, ID fields hidden.
- `GET /api/wallets/:id/activity/verify` (OWNER, ADMIN): recomputes the hash chain with `auditHash` and answers `valid`, `entries` and `brokenAt`. Checked on 2026-10-26: 72 entries valid. The scheduled check job still does not exist.
- Paging uses `recorded_at < before`; entries that share the exact same millisecond across a page boundary could be skipped (unlikely, since `recorded_at` comes from the database clock per entry).

## API transport on the client

`packages/app/src/api.tsx`: the host passes one `request(method, path, body)` (`ApiProvider`); screens call the HTTP API paths directly and load lists with `useResource(path)`. New resources use this; `WalletClient` and `AccountClient` predate it.

## Authentication

Standalone auth pages include a localized Back to Home link and the shared `PublicFooter`, also used by `PublicHome`. Their form fills the space between header and footer; intercepted auth renders only the window over the retained Home.

Public authentication uses Next.js parallel and intercepting routes: the public locale layout renders a named `@auth` slot alongside its page. Home links open `(.)sign-in` over the retained Home; direct navigation or reload renders the standalone sign-in page without Home or backdrop. Sign-up has the same two variants. Both call `AuthPage` for session checks, safe redirect targets and invite handling. Empty slot defaults and a catch-all prevent stale overlays on other routes.

`PublicFrame` owns minimized state and background interactivity. In overlay mode, yellow minimizes, the bottom bar's green button restores, and Home's sign-in links restore the existing window without navigating. Forms remain mounted during minimize/restore. Minimizing uses native history.replaceState to show the locale Home URL while retaining the auth slot; restoring recovers the original auth URL, including query parameters. No extra history entry is added. Refreshing minimized opens Home alone; refreshing restored opens standalone auth. The backdrop uses blur and 20% black tint with a 250 ms fade (120 ms with reduced/unknown motion preference). Standalone pages have no active minimize action. The app package receives generic overlay/minimize props and never imports Next.js. See [0013](../decisoes/0013-janela-de-autenticacao.md).

`AuthWindow` uses the shared `ScreenTransition` around the entire window, including its frame and title bar, for sign-in, sign-up and verification. Its `window` emphasis uses a 450 ms fade from 0 to 1, a 24 px rise and scale from 0.96 to 1. Reduced or unknown motion preference uses only a 120 ms fade. It runs on mount and step title changes without remounting the form; signed-in screens keep their subtle entrance.

Implements part of [0004](../decisoes/0004-seguranca-da-conta.md). Server code is in `apps/web/lib/server/auth/`, forms in `packages/app/src/auth.tsx`, shared input rules in `@packages/shared/auth`.

**E-mail is off for now.** There is no e-mail provider, so nothing that depends on e-mail runs: no codes, no verification, no notices. The switch is `EMAIL_DELIVERY_ENABLED` in `apps/web/lib/server/mail.ts` (`false`). The code for the e-mail step stays in place for when a provider exists ([0003](../decisoes/0003-convites-por-email.md)).

**Flow (e-mail off, current)**

1. `/[locale]/sign-up` → `POST /api/auth/sign-up`. Creates the account and starts a session (`{ next: "app" }`). An e-mail that already has an account gets `409 emailTaken`. `email_verified_at` stays empty.
2. `/[locale]/sign-in` → `POST /api/auth/sign-in` → session (`{ next: "app" }`), verified or not.
3. `POST /api/auth/verify-email` and `POST /api/auth/resend-code` answer `404 unavailable`.
4. `POST /api/auth/sign-out`, `GET /api/auth/me`, `POST /api/account/language` (saves `users.language`), `POST /api/account/profile` (name).
5. **Password change** (Settings → Account): `POST /api/account/password` asks for the current password (same 5 / 15 min limit as other step-ups), applies the sign-up rules, re-hashes with the current pepper and ends every other session (`PASSWORD_CHANGED` with `otherSessionsEnded`, or `PASSWORD_CHANGE_FAILED`). The e-mail notice waits for an e-mail provider. The e-mail itself cannot be changed yet.

**Flow (e-mail on, later)**

1. Sign-up always answers "check your e-mail" (`{ next: "verifyEmail" }`), whether or not the e-mail already has an account. An existing account gets a `sign-up-existing-account` e-mail instead of a code.
2. Sign-in: a verified account gets a session. An unverified one gets a new code (`{ next: "verifyEmail" }`).
3. The code step (same page, e-mail kept in state, never in the URL) → `POST /api/auth/verify-email` → session. `POST /api/auth/resend-code` sends a new one.

In both modes:

5. `/app/*` without a session redirects to `/{locale}/sign-in`. Signed-in users opening the auth pages go to `/app`.

**Rules as implemented**

| Topic | Implementation |
| --- | --- |
| Password hash | HMAC-SHA256 pepper (`PASSWORD_PEPPER_V1`), then Argon2id m=64 MiB, t=3, p=1 (`@node-rs/argon2`, PHC string). Re-hashed on login when the pepper version or parameters change |
| Password policy | 12–128 characters, not equal to the e-mail, not in Have I Been Pwned (k-anonymity range API, 2.5 s timeout, **fails open** and logs) |
| E-mail codes | 6 digits, 10 minutes, 5 wrong tries, HMAC-hashed with the pepper; a new code invalidates the previous ones |
| Sessions | 32-byte random token in an HttpOnly, SameSite=Lax cookie (`__Host-finfy_session` in production, `finfy_session` in development); only its SHA-256 is stored. 30 days idle, 90 days absolute; touched at most once an hour. Each session also creates a `devices` row (`WEB`) |
| Brute force | Account: 5 failures lock it for 1, 2, 4, 8, then 15 minutes. Per IP: 20 sign-ins / 15 min, 10 sign-ups / hour, 30 code checks / 15 min. Per e-mail: 5 resends / 15 min. Counters in the `rate_limits` table |
| Enumeration | Generic "incorrect e-mail or password"; unknown e-mails run a dummy Argon2 verification (same timing). **With e-mail off, sign-up reveals that an e-mail has an account** (`emailTaken`): without e-mail there is no private way to tell the owner. The per-IP sign-up limit (10 / hour) slows down probing. With e-mail on, sign-up and resend answer the same either way |
| CSRF | Every POST checks `Origin` against the app's origin; plus SameSite=Lax |
| Errors | API returns codes (`errors.auth.*`), translated by the client |
| Events | `security_events`: `SIGN_UP`, `SIGN_UP_EXISTING_ACCOUNT`, `SIGN_UP_INVITE_INVALID`, `SIGNUP_INVITE_CREATED`, `SIGNUP_INVITE_REVOKED`, `EMAIL_VERIFIED`, `LOGIN`, `LOGIN_FAILED`, `LOGOUT` |
| Closed sign-up | `SIGN_UP_MODE=invite` (default `open`): once any account exists, sign-up needs an invite code. Any account makes codes in Settings (`/api/account/signup-invites`): 16 symbols from `SIGNUP_CODE_ALPHABET`, single use, 7 days, only the SHA-256 stored, at most 10 unused per account and 20 a day. The code is checked before the e-mail lookup and spent in the sign-up transaction (`apps/web/lib/server/signup-invites.ts`). The sign-up page shows the code field when sign-up is closed or the link has `?code=` |

**E-mails:** with e-mail on, they are queued in `email_outbox` and a future job sends them ([0003](../decisoes/0003-convites-por-email.md)). In development the server log prints each one, including the code: look for `[mail:dev]`. Payloads hold codes, so the sender must clear them after sending. With e-mail off (now), nothing is queued.

**Language:** the signed-in app uses `users.language`; the switcher updates it. Sign-up stores the language of the page used.

## API documentation

OpenAPI 3.1, generated from the zod schemas in `@packages/shared` by `apps/web/lib/openapi.ts`.

| Where | What |
| --- | --- |
| http://localhost:3000/api/docs | Swagger UI. "Try it out" works: requests come from the same origin, so the `Origin` check passes and the session cookie is sent |
| `/api/openapi.json` | The document |
| `apps/web/openapi.json` | Committed copy, for reading and for other tools; `pnpm check:openapi` keeps it current |

Both routes answer 404 in production builds (Vercel previews included): the documentation is for development only.

Swagger UI loads `swagger-ui-dist@5.17.14` from jsDelivr.

## Deploy (Vercel)

Live since 2026-10-26, for personal use: `https://finfy-tau.vercel.app`.

| What | Value |
| --- | --- |
| Vercel project | `finfy` in the team `tc` (Hobby plan), linked to GitHub `c-t-dev/finfy`: `main` deploys to production, other branches to previews |
| Build | Root directory `apps/web`, files outside it included, Next.js preset, Node 24, pnpm from `packageManager` via `ENABLE_EXPERIMENTAL_COREPACK=1` |
| Functions region | `lhr1` (London) |
| Database | Neon Postgres (free plan) from the Vercel Marketplace, resource `finfy-db`, AWS `eu-west-2` (London). The integration sets `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` in every environment. Previews use the same database as production |
| Other variables | `PASSWORD_PEPPER_V1` (Secret, production and preview; a copy kept by the owner outside the repository; losing it locks every account), `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_NAME` |

Sign-up there is closed: `SIGN_UP_MODE=invite` (see [Authentication](#authentication)).

Migrations do not run in the build. After merging a schema change, run them against Neon with the unpooled URL before (or right after) the deploy:

```bash
vercel env pull <file outside the repo> --environment production
DATABASE_URL=<DATABASE_URL_UNPOOLED from that file> pnpm db:migrate
```

The publication migrations print a `wal_level` warning on Neon: logical replication is off until PowerSync is needed ([0010](../decisoes/0010-nextjs-na-vercel.md)).

## Local database without Docker

Local browser testing was enabled on 2026-10-26 using the existing Docker service `finfy-db-1` on localhost:5432, database `finfy`. All seven committed migrations were already applied; no migration or data reset was needed. The ignored `apps/web/.env.local` points to this local database, retains its existing password pepper, and uses `SIGN_UP_MODE=open` for local test registration. Production remains invite-only. `/api/health` returned `database: "ok"`; the local sign-up page rendered without an invite-code field. Use synthetic test accounts and never copy production credentials into the local setup.

If Docker is not available, an embedded Postgres works for development. It was used to test milestone 2:

```bash
npx -y -p @electric-sql/pglite-socket -p @electric-sql/pglite pglite-server --db=./.pglite --port=5433 --max-connections=10
```

Then set `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/postgres` in `apps/web/.env.local` and run `DATABASE_URL=... pnpm db:migrate`. The publication migration prints a `wal_level` warning there; it is harmless.

## Database objects not visible in the Drizzle schema

From `packages/shared/drizzle/0001_seed_currencies_audit_and_publication.sql`:

- seed rows in `currencies` (`EUR`, `BRL`);
- trigger `audit_logs_no_update_delete`: `audit_logs` rejects `UPDATE` and `DELETE`;
- publication `powersync` for `wallets` and `wallet_members`.

The migrations were checked on 2026-10-25 against an embedded Postgres (PGlite). The checks were: one active owner per wallet, lowercase e-mail, the role check and the append-only audit log. The same day they were applied to the Docker database (Postgres 17, `wal_level=logical`, no warnings), and sign-up, e-mail verification and `/app` were tested on it.

If Docker Desktop crashes on start with `sailor-ingest.sock ... The file cannot be accessed by the system` (or the same with `docker-secrets-engine\engine.sock`), stop every Docker process and run `wsl --shutdown`. Those leftover Unix-socket files often cannot be deleted, so **rename the folder that holds them** (`%LOCALAPPDATA%\Docker\run`, `%LOCALAPPDATA%\docker-secrets-engine`) to `*.old-<date>`; Docker creates fresh ones. Then open Docker again and `docker start finfy-db-1`. Do not use "Reset to factory defaults": it erases every image and volume. Fixed this way on 2026-10-26.

## Accumulated statement result

Statement summary includes `accumulatedBalanceMinor` = `confirmedBalanceMinor` + signed `accumulatedPendingMinor`. Confirmed cash includes current active accounts' opening balances and paid, non-archived movements through inclusive `to`. Pending cash includes stored pending account movements through `to` and pending purchases of unpaid invoices due through `to`, attributed to the card's configured payment account. Paying replaces pending purchases with the actual account payment; reopening restores pending purchases. Only `accountId` applies; category, tag, search and `from` filter monthly figures and entries only. Positive result is green; the hint shows net pending cash included in the projected balance. Opening balances have no effective date. Historical views reflect current record/archive state. No extra recurrence occurrences are generated. Home and account balances are unchanged. See [0018](../decisoes/0018-resultado-acumulado-do-extrato.md). Regression SQL covers both isolated SQLite expressions and the actual API row/totals query builders in in-memory PostgreSQL (PGlite), applying every committed migration. `entry-queries.ts` is shared by the API and these integration tests. Nested balance SQL uses explicit qualified identifiers: Drizzle single-table selections otherwise strip column table names, causing ambiguous joins (SQLSTATE 42702). No external database or real account is used.
