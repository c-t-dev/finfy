# Security review

> Last updated: 2026-11-06

## Scope and method

Local source review of authentication, session cookies, wallet authorization, mutation replays, invitation management, query construction and rendering sinks. No production connection, production data or deployed penetration test. Synthetic fixtures only.

Command-layer reproductions load the actual TypeScript server modules, replacing the database connection with migrated in-memory PostgreSQL (PGlite). Login concurrency tests replace password verification with a synchronized rejection to exercise the real counter and locking query. These are not HTTP or deployment-level proofs.

## Confirmed findings and corrections

| Severity | Finding | Evidence | Status |
| --- | --- | --- | --- |
| High | Cross-wallet member disclosure through mutation replay | changeMemberRole, removeMember and revokeInvite returned names and emails without current membership when given the caller's previous mutation ID | Fixed locally: current view permission is required before replay |
| High | Cross-wallet invoice disclosure through replay | reopenInvoice returned invoice metadata/totals while skipping role validation | Fixed locally: current view permission is required before replay |
| Medium | Revoked member could read wallet metadata | current() did not filter removed membership or archived wallet | Fixed locally: both filters added |
| Medium | Concurrent failed logins lose counter increments | Ten synchronized bad-password verifications left failed_login_count at one, with no account lock | Fixed locally: atomic SQL increment and lock calculation; regression expects ten and an active lock |

Replaying these tested operations skipped their writes. No unauthorized modification was observed. Statement list, rows and summary commands rejected the tested removed/non-member actor. This does not establish that every possible attack path is safe.

CASL now evaluates the existing explicit role grants in the shared module. It does not replace server membership checks.

## Product clarification

The owner explicitly permits an ADMIN to replace an OWNER-issued pending ADMIN invitation with a lower-role invitation, rotating the old link. This is not classified as a vulnerability. No extension to promoting ADMIN or changing existing ADMIN members was requested.

## Limits and follow-up

- Production dependency audit returned no published advisories at review time; this does not prove the absence of vulnerabilities.
- Trusted proxy/IP-header handling, deployed security headers and preview/production database separation still require deployment-specific verification. The wiki documents a shared preview/production database; actual provider configuration was not checked in this review.
- Email verification is disabled. OTP concurrency is corrected locally; email delivery still needs its own integration review before enabling those routes.
- Password-change/session races were reproduced and corrected locally in the second round below.
- No release, deployment or production change was performed.

## Second round: session and password races (2026-11-06)

These findings were confirmed locally and are now **fixed locally**. Production was not accessed.

| Severity | Finding | Controlled reproduction | Impact and scope |
| --- | --- | --- | --- |
| High | A login already validating the old password can create a session after password change and revocation finish | Pause signIn after reading the old credential, complete changePassword and revokeOtherSessions, then resume signIn. The real startSession creates an unrevoked session and the real getSession accepts it | A caller who knows the old password and has a concurrent login in flight may retain access during a recovery password change. A fresh login with the old password after the change is not demonstrated |
| High, conditional | Stale login rehash overwrites the newly changed credential | Same ordering, with needsRehash=true; signIn's unconditional userCredentials update replaces the new hash with the rehashed old password | Applies when a password hash needs upgrading, such as changed Argon2 parameters. Not every ordinary login takes this branch |
| Medium, inactive endpoint | Concurrent OTP verification exceeds the per-code attempt budget | Seed a code with four attempts, synchronize ten verification reads, then submit ten incorrect guesses. All ten are evaluated and the stored counter reaches fourteen | Current email-code routes are disabled by EMAIL_DELIVERY_ENABLED=false. This is a latent issue before enabling them; no account takeover was demonstrated |

### Reproduction boundaries

Tests executed actual server command modules and actual migrated PGlite queries. Password hashing/verification and breached-password lookup were controlled substitutes to orchestrate the race without secrets, external requests or expensive cryptographic scheduling. Cookie storage was an in-memory substitute and React request caching was bypassed. For the session race, session creation, revocation SQL and session lookup were real. For OTP, only secret hashing was substituted; the SELECT/UPDATE path was real, and a query proxy synchronized the reads. No HTTP/deployment exploit, real account or production data was involved.

### Implemented corrections

- Login completion and password replacement lock the user row, then its credential row, in that order. Both recheck the verified hash, pepper version and password-change timestamp under the lock.
- Password replacement, session revocation and the audit event commit in one transaction. Login rehash, session insertion and its audit event also commit together. Session cookies are set only after successful commit. Expensive password work remains outside the lock.
- A stale successful verification is rejected before rehash or session insertion; a login that commits first is included in the subsequent password-change revocation. The password-changing browser retains its current session.
- OTP uses one guarded update to reserve a bounded attempt and consume the matching code. The update rechecks expiry, unused state and attempts < 5. Exhausted codes cannot be redeemed, and concurrent correct requests have at most one winner.

Regression coverage is in `apps/web/test/auth-concurrency.test.ts`. It executes the actual command, session and OTP modules against migrated PGlite, substituting password cryptography, breached-password lookup, request cookies and React cache to control scheduling. No deployed exploit test or real credential was used. No schema migration is required.

### Final validation of the second-round fixes

All seven new concurrency/rollback regressions passed on migrated PGlite. Typecheck, messages and OpenAPI passed. Shared tests: 16 passed. Web tests: 32 passed; the existing statement-period assertion and its parent still fail (two reported failures). An additional external local PostgreSQL run could not connect because Docker Engine was unavailable; it supplies no PostgreSQL lock-concurrency evidence. No production connection, schema change, deployment or push was performed.

## Release validation follow-up (2026-11-06)

Docker became available. All seven authentication concurrency/rollback scenarios passed again against disposable PostgreSQL 17 databases using the postgres-js adapter, with the same controlled crypto/cookie substitutions. Each database was removed after its test. The previous external-database limitation is resolved for those scenarios.

The statement-period regression assumed the selected month was different from the current month. In November it counted both the initial November load and the reset to November. The assertion now measures the two additional reset requests relative to the baseline; no product logic was changed. Full suite: 16 shared + 34 web tests passed, including their reported parent tests. Typecheck, messages and OpenAPI passed. Production build and deployment confirmation are recorded separately at release completion.

## Release

Production publication was explicitly authorized after validation. Vercel confirmed the security commit READY on 2026-11-06. Release notes are consolidated for v0.3.0; the tag is created only after verifying the final documentation commit deployment. No production database migration or credential reset is part of this release.
