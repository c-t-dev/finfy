# Agent integrations

> Last updated: 2026-11-10

In **Settings → Agent integrations**, a Paid account can create a named connection, select wallets and choose Read only or Read and create entries. Copy the secret from the creation response and store it in the agent's secret store. A connection can be revoked from Settings even after a downgrade. To change wallets or scopes, or replace a lost secret, revoke the connection and create another.

Hermes or another HTTPS client uses the Finfy app's base URL with an `Authorization: Bearer <secret>` header. The client makes outbound requests only. Configure any default wallet or card in the client. The management endpoints use the existing browser session and same-origin checks.

| Request | Scope | Result |
| --- | --- | --- |
| `GET /api/agent/v1/wallets` | At least one effective scope per result | Authorized wallet IDs, names, currency and effective scopes |
| `GET /api/agent/v1/wallets/{id}/invoices` | `invoices:read` | Next payable invoice's due date and minor-unit total per active card, or null |
| `GET /api/agent/v1/wallets/{id}/entries` | `entries:create` | Active account, card, category and tag IDs and labels needed for creation. |
| `POST /api/agent/v1/wallets/{id}/entries` | `entries:create` | Receipt with the kind and IDs created. |

Create a read-only connection with `["invoices:read"]`. For read and create, use `["invoices:read", "entries:create"]`. The API rejects write-only grants. Older write-only connections stay visible in Settings for revocation and have no effective access. Older connections with both `invoices:read` and `purchases:create` retain the original single-installment purchase and purchase-targets endpoints. They need a new connection to create other entries.

All creation requests use a client-generated UUID `requestId`, a positive integer `amountMinor` and the wallet's `currencyCode`. Choose a `kind` and supply the fields for that kind.

| Kind | Required fields besides the shared fields | Options | Receipt IDs |
| --- | --- | --- | --- |
| `entry` | `type` (INCOME or EXPENSE), `accountId`, `categoryId`, `description`, `transactionDate`, `status` (PAID or PENDING) | `notes`, `tagIds` | Entry |
| `transfer` | `fromAccountId`, `toAccountId`, `description`, `transactionDate`, `status` (PAID or PENDING) | `notes` | Outgoing and incoming legs, in that order |
| `purchase` | `cardId`, `categoryId`, `description`, `transactionDate`, `installments` (1–48) | `notes`, `tagIds` | Installment IDs in order |
| `recurrence` | `type` (INCOME or EXPENSE), `accountId` or `creditCardId` (card for expenses), `categoryId`, `description`, `frequency`, `startDate` | `endDate`, `firstPaid` for account entries, `tagIds` | Schedule ID |

Use ISO calendar dates. For a schedule that ends after a fixed count, send the computed last occurrence date as `endDate`, as the app does. Omit it for an indefinite schedule. The API creates new schedules only. Invoice settlement remains a separate app operation.

For a timeout or lost response, resend the same request ID and payload on the same connection. The authorized retry returns the original receipt with HTTP 201. A changed payload for the same ID returns `409 versionConflict`. Reconcile with the app before switching connections after an ambiguous response, since a new connection has a separate request ID namespace.


The API returns stable error codes. Missing, unknown and revoked secrets return 401. A valid credential with a Free account, missing scope or insufficient role returns 403. An inaccessible or archived wallet can return 404. See [OpenAPI](../../apps/web/openapi.json) for request and response schemas.

## Manual local plan assignment

Apply the integration migration to a disposable local PostgreSQL database before changing plans. Use your local database administration shell, connected explicitly to that database. Identify the personal test account by UUID in that environment and substitute it for the placeholder below. Check that exactly one row was returned before committing.

```sql
BEGIN;
UPDATE users
SET plan = 'PAID', updated_at = now()
WHERE id = '<local-user-uuid>'::uuid AND deleted_at IS NULL
RETURNING id, plan;
-- COMMIT if exactly one expected row was returned, otherwise ROLLBACK.
```

Set `plan = 'FREE'` using the same procedure to test downgrade. Previously issued secrets are blocked during the downgrade and can work again after promotion if they were never revoked. Revoke them from Settings if they should stay invalid. This procedure was tested with synthetic fixtures. There is no public endpoint to assign a plan.

## Local Hermes smoke test

Use a dedicated local test database with synthetic records and apply all migrations. Keep the app bound to loopback. Promote the identified test account, create a test wallet with a card and an upcoming invoice, and create a read-only connection in Settings.

If Hermes runs on the same machine and shares the network namespace, set its Finfy base URL to the app's actual loopback URL, for example http://127.0.0.1:3000. Store the bearer secret in Hermes. Call GET /api/agent/v1/wallets first and GET /api/agent/v1/wallets/{id}/invoices next. For a separate read-and-create connection, submit a synthetic entry twice with the same requestId and confirm the receipt matches and the app shows one entry. Revoke the connection in Settings and verify the next authenticated request returns 401.

If Hermes runs in a container, VM, or on another host, its loopback points to that environment. Keep Finfy private and use a privately reachable test endpoint if one has been set up. A plain HTTP loopback URL is only for local testing. Use HTTPS for any connection that crosses hosts.