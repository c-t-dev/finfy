# finfy — Codebase

> Last updated: 2026-10-25

How the code is organized and how to run it. The reasons behind each choice are in the decisions: [0008](../decisoes/0008-linguagem-visual.md) (UI), [0009](../decisoes/0009-react-tauri-capacitor.md) (clients), [0010](../decisoes/0010-nextjs-na-vercel.md) (Next.js on Vercel, Drizzle), [0011](../decisoes/0011-traducoes.md) (translations).

## Status

Milestones 1 (foundation), 2 (e-mail and password authentication), 3 (wallets) and 4 (accounts) are in place, plus every database table of the approved data model:

| Done | Not yet |
| --- | --- |
| pnpm monorepo, shared configs | MFA (TOTP, recovery codes), step-up, password reset and change, "connected devices" screen, Google/Apple sign-in |
| Sign-up, sign-in, sign-out, sessions, account lockout, rate limits, `/app` protected (see [Authentication](#authentication)). No e-mail step for now | Wallet members, invites, roles and ownership transfer |
| `packages/ui` copied from image-resizer | Security e-mails (new device, password changed) |
| Drizzle schema + migrations for the whole [data model](data-model.md): identity, wallets and sharing, financial core, planning and patrimony, sync and audit | API and screens for the financial tables; the system category list |
| Money, IDs, roles and permission matrix, locales | `POST /api/sync/push`, conflict records (`sync_conflicts`), audit chain check job |
| Wallets: create, list, switch (remembered per browser), rename, change currency before the first entry, archive with the password (see [Wallets](#wallets)) | Activity feed and item history screens |
| One write path: idempotent mutations and a hash-chained audit log (see [Write path](#write-path)) | |
| Accounts: create, edit, main account, archive and restore, balance computed from transactions (see [Accounts](#accounts)) | |
| Credit cards: cards, purchases with installments, invoices by month, pay and reopen (see [Credit cards](#credit-cards)) | Partial invoice payments, card refunds |
| Planning (menu "Planejamento", `/app/goals`): monthly budget per category, goals with deposits (see [Planning](#planning)) | Budget alerts as notifications, goal return rate |
| Transactions: income, expense, transfers, pending/paid, Statement by month with filters and search, Home summary (see [Transactions](#transactions)) | Tags, attachments, recurrences, installments outside cards |
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
- **Totals** (`summary`): paid `INCOME`; paid `EXPENSE` plus `CREDIT_CARD_PURCHASE` (on its own date, whatever the invoice status); pending income and expense apart. The Home "where the money went" uses the same rule, grouped by top-level category.
- The first entry locks the wallet's currency.
- Checked on 2026-10-25: balances after expense, income, pending, transfer, transfer edit and transfer delete; filters by category (with subcategories) and search; stale edits.

## Credit cards

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
- **Purchases** are `CREDIT_CARD_PURCHASE` rows, `PENDING` until their invoice is paid. They never touch an account balance and count as expense on their own date.
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
- **Not yet in Swagger** (`lib/openapi.ts`): the member and invite routes.

## API transport on the client

`packages/app/src/api.tsx`: the host passes one `request(method, path, body)` (`ApiProvider`); screens call the HTTP API paths directly and load lists with `useResource(path)`. New resources use this; `WalletClient` and `AccountClient` predate it.

## Authentication

Implements part of [0004](../decisoes/0004-seguranca-da-conta.md). Server code is in `apps/web/lib/server/auth/`, forms in `packages/app/src/auth.tsx`, shared input rules in `@packages/shared/auth`.

**E-mail is off for now.** There is no e-mail provider, so nothing that depends on e-mail runs: no codes, no verification, no notices. The switch is `EMAIL_DELIVERY_ENABLED` in `apps/web/lib/server/mail.ts` (`false`). The code for the e-mail step stays in place for when a provider exists ([0003](../decisoes/0003-convites-por-email.md)).

**Flow (e-mail off, current)**

1. `/[locale]/sign-up` → `POST /api/auth/sign-up`. Creates the account and starts a session (`{ next: "app" }`). An e-mail that already has an account gets `409 emailTaken`. `email_verified_at` stays empty.
2. `/[locale]/sign-in` → `POST /api/auth/sign-in` → session (`{ next: "app" }`), verified or not.
3. `POST /api/auth/verify-email` and `POST /api/auth/resend-code` answer `404 unavailable`.
4. `POST /api/auth/sign-out`, `GET /api/auth/me`, `POST /api/account/language` (saves `users.language`).

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
| Events | `security_events`: `SIGN_UP`, `SIGN_UP_EXISTING_ACCOUNT`, `EMAIL_VERIFIED`, `LOGIN`, `LOGIN_FAILED`, `LOGOUT` |

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

## Local database without Docker

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

If Docker Desktop crashes on start with `sailor-ingest.sock ... The file cannot be accessed by the system`, quit it, run `wsl --shutdown`, delete the `sailor-ingest.sock*` files in `%LOCALAPPDATA%\Docker\run`, and open it again. Do not use "Reset to factory defaults": it erases every image and volume.
