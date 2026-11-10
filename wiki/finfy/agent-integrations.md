# Agent integrations

> Last updated: 2026-11-10

In **Settings → Agent integrations**, a Paid account can create a named connection, select wallets and grant one or both scopes. Copy the secret from the creation response and store it in the agent's secret store. A connection can be revoked from Settings even after a downgrade. To change wallets or scopes, or replace a lost secret, revoke the connection and create another.

Hermes or another HTTPS client uses the Finfy app's base URL with an `Authorization: Bearer <secret>` header. The client makes outbound requests only. Configure any default wallet or card in the client. The management endpoints use the existing browser session and same-origin checks.

| Request | Scope | Result |
| --- | --- | --- |
| `GET /api/agent/v1/wallets` | At least one effective scope per result | Authorized wallet IDs, names, currency and effective scopes |
| `GET /api/agent/v1/wallets/{id}/invoices` | `invoices:read` | Next payable invoice's due date and minor-unit total per active card, or null |
| `GET /api/agent/v1/wallets/{id}/purchase-targets` | `purchases:create` | Card and active expense category IDs and labels, without invoice or account balances |
| `POST /api/agent/v1/wallets/{id}/cards/{cardId}/purchases` | `purchases:create` | Purchase and invoice IDs |

The purchase body contains a client-generated UUID `requestId`, `categoryId`, `description`, positive integer `amountMinor`, wallet `currencyCode` and ISO calendar `transactionDate`. Send JSON over HTTPS. For a timeout or lost response, keep the original request ID and body. The same authorized request returns the original receipt with HTTP 201. Reusing the ID on the same connection with a different target or purchase body returns `409 versionConflict`. Keep the receipt or reconcile with the app before switching connections after an ambiguous response, since a new connection has a separate request ID namespace.

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
