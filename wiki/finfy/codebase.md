# finfy — Codebase

> Last updated: 2026-10-25

How the code is organized and how to run it. The reasons behind each choice are in the decisions: [0008](../decisoes/0008-linguagem-visual.md) (UI), [0009](../decisoes/0009-react-tauri-capacitor.md) (clients), [0010](../decisoes/0010-nextjs-na-vercel.md) (Next.js on Vercel, Drizzle), [0011](../decisoes/0011-traducoes.md) (translations).

## Status

Milestone 1 (foundation) and milestone 2 (e-mail and password authentication) are in place, plus every database table of the approved data model:

| Done | Not yet |
| --- | --- |
| pnpm monorepo, shared configs | MFA (TOTP, recovery codes), step-up, password reset and change, "connected devices" screen, Google/Apple sign-in |
| Sign-up, sign-in, sign-out, sessions, account lockout, rate limits, `/app` protected (see [Authentication](#authentication)). No e-mail step for now | Wallet API and screens (create, invite, roles, transfer) |
| `packages/ui` copied from image-resizer | Security e-mails (new device, password changed) |
| Drizzle schema + migrations for the whole [data model](data-model.md): identity, wallets and sharing, financial core, planning and patrimony, sync and audit | API and screens for the financial tables; the system category list |
| Money, IDs, roles and permission matrix, locales | Server write commands, audit hash chain, `POST /api/sync/push` |
| Public home page in `en` and `pt-BR`, with hreflang | Other public pages (pricing, help...) |
| Signed-in app shell (`/app`): sidebar, bottom bar on phones, language and theme switchers, window width lock/unlock (cookie `finfy-window-wide`, desktop only) | E-mail sending (provider not chosen), cron jobs |
| `GET /api/health`; API documented with OpenAPI + Swagger UI (see [API documentation](#api-documentation)) | Tauri and Capacitor shells, PowerSync |

## Layout

| Path | What | Depends on |
| --- | --- | --- |
| `apps/web` | Next.js 16: public pages (`app/(public)/[locale]`), signed-in app (`app/(app)/app`), API (`app/api`) | everything below |
| `packages/app` | Signed-in screens. **Never imports Next.js**: routing comes in through `AppNavigationProvider` (`Link` + `pathname`) | `ui`, `shared`, `use-intl` |
| `packages/ui` | shadcn components restyled for macOS, tokens, `globals.css`. A copy of image-resizer's, evolving on its own | — |
| `packages/shared` | Pure code used by client and server: `money`, `ids`, `roles`, `finance` (value lists), `auth` (input and response schemas), `i18n` (locales + messages), and the Drizzle schema (`db/schema`, server only) | `drizzle-orm`, `uuid`, `zod` |
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
- **Screens:** new signed-in screens go in `packages/app/src/screens`; the Next.js page only renders them. Use `@packages/ui` components; new shadcn components follow the recipe in [0008](../decisoes/0008-linguagem-visual.md).

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
