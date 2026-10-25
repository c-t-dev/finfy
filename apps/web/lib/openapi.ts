import { z } from "zod";
import {
  AUTH_ERRORS,
  authNextSchema,
  currentUserSchema,
  languageInput,
  resendCodeInput,
  signInInput,
  signUpInput,
  verifyEmailInput,
} from "@packages/shared/auth";
import {
  accountListSchema,
  accountSchema,
  accountStateInput,
  createAccountInput,
  updateAccountInput,
} from "@packages/shared/accounts";
import {
  archiveWalletInput,
  createWalletInput,
  updateWalletInput,
  WALLET_ERRORS,
  walletListSchema,
  walletSchema,
} from "@packages/shared/wallets";

/**
 * OpenAPI 3.1 description of the API, built from the same zod schemas the
 * routes use, so the two cannot drift. Served in development at
 * /api/openapi.json and /api/docs (Swagger UI); `pnpm openapi` writes the
 * committed copy in apps/web/openapi.json.
 *
 * Every route added under app/api must be described here.
 */

type Schema = Record<string, unknown>;

const json = (schema: z.ZodType, io: "input" | "output" = "output"): Schema => {
  const { $schema: _, ...rest } = z.toJSONSchema(schema, { io, unrepresentable: "any" }) as Schema;
  return rest;
};

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

const errorBody = (codes: readonly string[]) => ({
  "application/json": { schema: { ...ref("Error"), properties: { error: { type: "string", enum: codes } } } },
});

const response = (description: string, schema?: Schema) =>
  schema ? { description, content: { "application/json": { schema } } } : { description };

const err = (description: string, ...codes: string[]) => ({ description, content: errorBody(codes) });

const body = (schema: z.ZodType) => ({
  required: true,
  content: { "application/json": { schema: json(schema, "input") } },
});

/** Every cookie-authenticated POST must come from the app's own origin (CSRF guard). */
const originNote = "The request must carry an `Origin` header equal to the app's origin; otherwise `403 forbiddenOrigin`.";

const authResponses = (...codes: string[]) => ({
  200: response("What the client does next.", ref("AuthNext")),
  400: err("Invalid input or password rule broken.", "invalidInput", ...codes),
  403: err("Wrong origin.", "forbiddenOrigin"),
  429: {
    description: "Too many attempts. `Retry-After` header and `retryAfterSeconds` say when to try again.",
    content: errorBody(["rateLimited"]),
  },
  503: err("Database or pepper not configured.", "unavailable"),
});

export function buildOpenApi(serverUrl = "http://localhost:3000") {
  return {
    openapi: "3.1.0",
    info: {
      title: "finfy API",
      version: "0.1.0",
      description:
        "API of the finfy web app (route handlers in apps/web/app/api). Errors are stable codes in `error`; the client translates them (wiki/decisoes/0011). Authentication is a session cookie set by sign-in or e-mail verification.",
    },
    servers: [{ url: serverUrl }],
    tags: [
      { name: "auth", description: "Sign-up, sign-in and sessions (wiki/decisoes/0004)" },
      { name: "account", description: "The signed-in user's settings" },
      { name: "wallets", description: "Wallets and roles (wiki/decisoes/0002). Writes are idempotent by `mutationId` and audited" },
      { name: "accounts", description: "Accounts of a wallet; the balance is computed, never stored" },
      { name: "system", description: "Health" },
    ],
    components: {
      securitySchemes: {
        session: {
          type: "apiKey",
          in: "cookie",
          name: "finfy_session",
          description: "HttpOnly session cookie. Named `__Host-finfy_session` in production.",
        },
      },
      schemas: {
        Error: {
          type: "object",
          required: ["error"],
          properties: {
            error: { type: "string", enum: [...new Set([...AUTH_ERRORS, ...WALLET_ERRORS])] },
            retryAfterSeconds: { type: "integer", description: "Only with `rateLimited`." },
          },
        },
        AuthNext: json(authNextSchema),
        CurrentUser: json(currentUserSchema),
        Wallet: json(walletSchema),
        WalletList: json(walletListSchema),
        Account: json(accountSchema),
        AccountList: json(accountListSchema),
        Health: {
          type: "object",
          required: ["status", "database"],
          properties: {
            status: { type: "string", enum: ["ok", "degraded"] },
            database: { type: "string", enum: ["ok", "not_configured", "unreachable"] },
          },
        },
      },
    },
    paths: {
      "/api/health": {
        get: {
          tags: ["system"],
          summary: "Liveness and database reachability",
          responses: {
            200: response("Up.", ref("Health")),
            503: response("Database unreachable.", ref("Health")),
          },
        },
      },
      "/api/auth/sign-up": {
        post: {
          tags: ["auth"],
          summary: "Create an account",
          description: `**While e-mail delivery is off (now):** creates the account, starts a session (cookie) and answers \`app\`; an e-mail that already has an account gets \`409 emailTaken\`. **Once it is on:** always answers \`verifyEmail\`, whether or not the e-mail has an account, and e-mails a code (or a notice). ${originNote}`,
          requestBody: body(signUpInput),
          responses: {
            ...authResponses("passwordTooShort", "passwordTooLong", "passwordSameAsEmail", "passwordBreached"),
            409: err("The e-mail already has an account (only while e-mail delivery is off).", "emailTaken"),
          },
        },
      },
      "/api/auth/sign-in": {
        post: {
          tags: ["auth"],
          summary: "Sign in with e-mail and password",
          description: `Starts a session (cookie) and answers \`app\`. Once e-mail delivery is on, an unverified account gets a new code and \`verifyEmail\` instead. ${originNote}`,
          requestBody: body(signInInput),
          responses: {
            ...authResponses(),
            401: err("Wrong e-mail or password (never says which).", "invalidCredentials"),
          },
        },
      },
      "/api/auth/verify-email": {
        post: {
          tags: ["auth"],
          summary: "Confirm the e-mailed code and start a session",
          description: `**Off for now:** answers \`404 unavailable\` while there is no e-mail provider. 6 digits, valid 10 minutes, 5 tries. ${originNote}`,
          requestBody: body(verifyEmailInput),
          responses: {
            ...authResponses(),
            404: err("E-mail delivery is off.", "unavailable"),
            401: err("Wrong or expired code.", "invalidCode"),
          },
        },
      },
      "/api/auth/resend-code": {
        post: {
          tags: ["auth"],
          summary: "Send a new e-mail code",
          description: `**Off for now:** answers \`404 unavailable\` while there is no e-mail provider. Same answer whether or not the e-mail exists. ${originNote}`,
          requestBody: body(resendCodeInput),
          responses: { ...authResponses(), 404: err("E-mail delivery is off.", "unavailable") },
        },
      },
      "/api/auth/sign-out": {
        post: {
          tags: ["auth"],
          summary: "End the current session",
          description: originNote,
          security: [{ session: [] }],
          responses: {
            204: response("Signed out (also when there was no session)."),
            403: err("Wrong origin.", "forbiddenOrigin"),
          },
        },
      },
      "/api/auth/me": {
        get: {
          tags: ["auth"],
          summary: "The signed-in user",
          security: [{ session: [] }],
          responses: {
            200: response("Signed in.", ref("CurrentUser")),
            401: err("No valid session.", "unauthenticated"),
          },
        },
      },
      "/api/account/language": {
        post: {
          tags: ["account"],
          summary: "Save the user's language",
          description: originNote,
          security: [{ session: [] }],
          requestBody: body(languageInput),
          responses: {
            204: response("Saved."),
            400: err("Invalid input.", "invalidInput"),
            401: err("No valid session.", "unauthenticated"),
            403: err("Wrong origin.", "forbiddenOrigin"),
          },
        },
      },
      "/api/wallets": {
        get: {
          tags: ["wallets"],
          summary: "The user's active wallets, with their role",
          security: [{ session: [] }],
          responses: {
            200: response("Oldest first.", ref("WalletList")),
            401: err("No valid session.", "unauthenticated"),
          },
        },
        post: {
          tags: ["wallets"],
          summary: "Create a wallet",
          description: `The client sends the wallet \`id\` and a \`mutationId\` (both UUIDs it generates). The creator becomes OWNER. Sending the same \`mutationId\` again returns the wallet without creating another. ${originNote}`,
          security: [{ session: [] }],
          requestBody: body(createWalletInput),
          responses: {
            201: response("Created (or already created by this mutationId).", ref("Wallet")),
            ...walletErrors("invalidInput"),
          },
        },
      },
      "/api/wallets/{id}": {
        patch: {
          tags: ["wallets"],
          summary: "Rename or change currency",
          description: `OWNER or ADMIN. \`baseVersion\` is the version the client was editing. The name is free text: the last write wins and the old value stays in the audit log. The currency can only change before the first entry (\`409 currencyLocked\`) and only from the latest version (\`409 versionConflict\`). ${originNote}`,
          security: [{ session: [] }],
          parameters: [walletIdParam],
          requestBody: body(updateWalletInput),
          responses: {
            200: response("The wallet after the change.", ref("Wallet")),
            ...walletErrors("invalidInput", "forbidden", "notFound", "currencyLocked", "versionConflict"),
          },
        },
      },
      "/api/wallets/{id}/archive": {
        post: {
          tags: ["wallets"],
          summary: "Archive a wallet",
          description: `OWNER only, with the password again (step-up; 5 tries per 15 minutes). The wallet leaves every member's list; data and history are kept. ${originNote}`,
          security: [{ session: [] }],
          parameters: [walletIdParam],
          requestBody: body(archiveWalletInput),
          responses: {
            204: response("Archived."),
            ...walletErrors("invalidInput", "invalidCredentials", "forbidden", "notFound", "rateLimited"),
          },
        },
      },
      "/api/wallets/{id}/accounts": {
        get: {
          tags: ["accounts"],
          summary: "Accounts with their balance",
          description:
            "Any member. Main account first, then oldest first. `?archived=1` lists the archived ones. `balanceMinor` = `initialBalanceMinor` + paid, non-archived transactions of the account.",
          security: [{ session: [] }],
          parameters: [
            walletIdParam,
            { name: "archived", in: "query", required: false, schema: { type: "string", enum: ["0", "1"] } },
          ],
          responses: {
            200: response("The accounts.", ref("AccountList")),
            ...walletErrors("notFound"),
          },
        },
        post: {
          tags: ["accounts"],
          summary: "Create an account",
          description: `OWNER, ADMIN, EDITOR. The client sends the account \`id\` and a \`mutationId\`. The wallet's first account becomes the main one; \`isDefault: true\` moves the mark. A non-zero initial balance locks the wallet's currency. ${originNote}`,
          security: [{ session: [] }],
          parameters: [walletIdParam],
          requestBody: body(createAccountInput),
          responses: {
            201: response("Created (or already created by this mutationId).", ref("Account")),
            ...walletErrors("invalidInput", "forbidden", "notFound"),
          },
        },
      },
      "/api/wallets/{id}/accounts/{accountId}": {
        patch: {
          tags: ["accounts"],
          summary: "Edit an account",
          description: `OWNER, ADMIN, EDITOR. Name and color: the last write wins. Type and initial balance: only from the latest version (\`409 versionConflict\`). ${originNote}`,
          security: [{ session: [] }],
          parameters: [walletIdParam, accountIdParam],
          requestBody: body(updateAccountInput),
          responses: {
            200: response("The account after the change.", ref("Account")),
            ...walletErrors("invalidInput", "forbidden", "notFound", "versionConflict"),
          },
        },
      },
      "/api/wallets/{id}/accounts/{accountId}/archive": {
        post: {
          tags: ["accounts"],
          summary: "Archive an account",
          description: `OWNER, ADMIN, EDITOR. Its transactions are kept. If it was the main account, the oldest active account becomes the main one. ${originNote}`,
          security: [{ session: [] }],
          parameters: [walletIdParam, accountIdParam],
          requestBody: body(accountStateInput),
          responses: {
            200: response("The archived account.", ref("Account")),
            ...walletErrors("invalidInput", "forbidden", "notFound"),
          },
        },
      },
      "/api/wallets/{id}/accounts/{accountId}/restore": {
        post: {
          tags: ["accounts"],
          summary: "Restore an archived account",
          description: `OWNER, ADMIN, EDITOR. It becomes the main account if the wallet has none. ${originNote}`,
          security: [{ session: [] }],
          parameters: [walletIdParam, accountIdParam],
          requestBody: body(accountStateInput),
          responses: {
            200: response("The restored account.", ref("Account")),
            ...walletErrors("invalidInput", "forbidden", "notFound"),
          },
        },
      },
    },
  };
}

const walletIdParam = { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } };
const accountIdParam = { name: "accountId", in: "path", required: true, schema: { type: "string", format: "uuid" } };

const WALLET_ERROR_STATUS: Record<string, [number, string]> = {
  invalidInput: [400, "Invalid input."],
  invalidCredentials: [401, "Wrong password."],
  forbidden: [403, "The member's role does not allow it."],
  notFound: [404, "No such wallet, archived, or not a member."],
  currencyLocked: [409, "The currency is fixed after the first entry."],
  versionConflict: [409, "The wallet changed since `baseVersion`."],
  rateLimited: [429, "Too many attempts; see `Retry-After`."],
};

/** Error responses of a wallet route grouped by status, plus the ones every wallet route has. */
function walletErrors(...codes: string[]) {
  const byStatus = new Map<number, { descriptions: string[]; codes: string[] }>();
  const add = (status: number, description: string, code: string) => {
    const entry = byStatus.get(status) ?? { descriptions: [], codes: [] };
    entry.descriptions.push(description);
    entry.codes.push(code);
    byStatus.set(status, entry);
  };
  for (const code of codes) add(...WALLET_ERROR_STATUS[code], code);
  add(401, "No valid session.", "unauthenticated");
  add(403, "Wrong origin.", "forbiddenOrigin");
  add(503, "Database not configured.", "unavailable");
  return Object.fromEntries(
    [...byStatus].map(([status, { descriptions, codes: list }]) => [status, err(descriptions.join(" "), ...list)]),
  );
}
