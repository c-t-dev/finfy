import { z } from "zod";
import {
  AUTH_ERRORS,
  authNextSchema,
  currentUserSchema,
  languageInput,
  changePasswordInput,
  profileInput,
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
  categoryListSchema,
  categorySchema,
  categoryStateInput,
  categoryVisibilityInput,
  createCategoryInput,
  updateCategoryInput,
} from "@packages/shared/categories";
import {
  createEntryInput,
  createTransferInput,
  entryListSchema,
  entrySchema,
  entryStateInput,
  updateEntryInput,
} from "@packages/shared/transactions";
import {
  cardListSchema,
  cardSchema,
  cardStateInput,
  createCardInput,
  createPurchaseInput,
  invoiceDetailSchema,
  invoiceListSchema,
  invoiceSchema,
  payInvoiceInput,
  purchaseStateInput,
  reopenInvoiceInput,
  updateCardInput,
  updatePurchaseInput,
} from "@packages/shared/cards";
import {
  budgetMonthSchema,
  copyBudgetInput,
  createDepositInput,
  createGoalInput,
  depositStateInput,
  goalDetailSchema,
  goalListSchema,
  goalStateInput,
  removeBudgetItemInput,
  setBudgetItemInput,
  updateGoalInput,
} from "@packages/shared/planning";
import {
  acceptedInviteSchema,
  changeRoleInput,
  createInviteInput,
  inviteActionInput,
  inviteLinkSchema,
  invitePreviewSchema,
  memberActionInput,
  membersSchema,
} from "@packages/shared/members";
import { activityPageSchema, chainCheckSchema } from "@packages/shared/activity";
import { createTagInput, setEntryTagsInput, tagListSchema, tagSchema, tagStateInput, updateTagInput } from "@packages/shared/tags";
import {
  createRecurrenceInput,
  recurrenceListSchema,
  recurrenceSchema,
  recurrenceStateInput,
  refreshRecurrencesInput,
  refreshResultSchema,
  updateRecurrenceInput,
} from "@packages/shared/recurrences";
import {
  createRuleInput,
  previewRuleInput,
  ruleActionInput,
  ruleApplyResultSchema,
  ruleListSchema,
  rulePreviewSchema,
  ruleSchema,
  updateRuleInput,
} from "@packages/shared/rules";
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
      { name: "categories", description: "System categories (read-only, hideable per wallet) and the wallet's own; two levels" },
      { name: "transactions", description: "Income, expenses and transfers; amounts are positive minor units, the type gives the direction" },
      {
        name: "cards",
        description:
          "Credit cards, purchases (with installments) and invoices. A purchase goes to the invoice whose closing date is on or after its date; invoices are addressed by reference month `YYYY-MM`",
      },
      { name: "planning", description: "Monthly budget limits per top-level expense category, and goals with deposits" },
      {
        name: "members",
        description:
          "Who has access to a wallet. Without e-mail, an invite is a private link (token shown once, valid 7 days); accepting needs the link and the account with the invited e-mail",
      },
      { name: "activity", description: "The wallet's audit log (wiki/decisoes/0006): every member sees everything" },
      { name: "tags", description: "Tags of a wallet, unique by name ignoring case; entries reference them by ID" },
      {
        name: "recurrences",
        description:
          "Schedules that create pending entries (occurrences) up to 90 days ahead, with deterministic IDs so they never duplicate",
      },
      { name: "rules", description: "Categorization rules: AND conditions, actions set the category and add tags; never on transfers, payments or adjustments" },
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
        Category: json(categorySchema),
        CategoryList: json(categoryListSchema),
        Entry: json(entrySchema),
        EntryList: json(entryListSchema),
        Card: json(cardSchema),
        CardList: json(cardListSchema),
        Invoice: json(invoiceSchema),
        InvoiceList: json(invoiceListSchema),
        InvoiceDetail: json(invoiceDetailSchema),
        BudgetMonth: json(budgetMonthSchema),
        GoalList: json(goalListSchema),
        GoalDetail: json(goalDetailSchema),
        Members: json(membersSchema),
        ActivityPage: json(activityPageSchema),
        ChainCheck: json(chainCheckSchema),
        Tag: json(tagSchema),
        TagList: json(tagListSchema),
        Recurrence: json(recurrenceSchema),
        RecurrenceList: json(recurrenceListSchema),
        RefreshResult: json(refreshResultSchema),
        Rule: json(ruleSchema),
        RuleList: json(ruleListSchema),
        RulePreview: json(rulePreviewSchema),
        RuleApplyResult: json(ruleApplyResultSchema),
        InviteLink: json(inviteLinkSchema),
        InvitePreview: json(invitePreviewSchema),
        AcceptedInvite: json(acceptedInviteSchema),
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
      "/api/account/profile": {
        post: {
          tags: ["account"],
          summary: "Save the user's name",
          description: originNote,
          security: [{ session: [] }],
          requestBody: body(profileInput),
          responses: {
            204: response("Saved."),
            400: err("Invalid input.", "invalidInput"),
            401: err("No valid session.", "unauthenticated"),
            403: err("Wrong origin.", "forbiddenOrigin"),
          },
        },
      },
      "/api/account/password": {
        post: {
          tags: ["account"],
          summary: "Change the password",
          description: `Needs the current password (5 tries per 15 minutes). The new one follows the sign-up rules. Every other session of the user ends. ${originNote}`,
          security: [{ session: [] }],
          requestBody: body(changePasswordInput),
          responses: {
            204: response("Changed."),
            400: err("Invalid input or password rule broken.", "invalidInput", "passwordTooShort", "passwordTooLong", "passwordSameAsEmail", "passwordBreached"),
            401: err("Wrong current password, or no session.", "invalidCredentials", "unauthenticated"),
            403: err("Wrong origin.", "forbiddenOrigin"),
            429: { description: "Too many attempts.", content: errorBody(["rateLimited"]) },
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
      "/api/wallets/{id}/categories": {
        get: {
          tags: ["categories"],
          summary: "System categories plus the wallet's",
          description:
            "Any member. System rows have `translationKey` (label `categories.<key>`) and `hidden` per wallet. `?archived=1` lists the wallet's archived categories.",
          security: [{ session: [] }],
          parameters: [
            walletIdParam,
            { name: "archived", in: "query", required: false, schema: { type: "string", enum: ["0", "1"] } },
          ],
          responses: { 200: response("The categories.", ref("CategoryList")), ...walletErrors("notFound") },
        },
        post: {
          tags: ["categories"],
          summary: "Create a category or subcategory",
          description: `OWNER, ADMIN, EDITOR. \`parentId\` must be a top-level category (system or the wallet's) of the same kind: two levels at most. ${originNote}`,
          security: [{ session: [] }],
          parameters: [walletIdParam],
          requestBody: body(createCategoryInput),
          responses: {
            201: response("Created (or already created by this mutationId).", ref("Category")),
            ...walletErrors("invalidInput", "forbidden", "notFound"),
          },
        },
      },
      "/api/wallets/{id}/categories/{categoryId}": {
        patch: {
          tags: ["categories"],
          summary: "Edit a wallet category",
          description: `Name, icon, color; the last write wins. System categories answer \`403 forbidden\`. ${originNote}`,
          security: [{ session: [] }],
          parameters: [walletIdParam, categoryIdParam],
          requestBody: body(updateCategoryInput),
          responses: { 200: response("The category.", ref("Category")), ...walletErrors("invalidInput", "forbidden", "notFound") },
        },
      },
      ...categoryAction("archive", "Archive a wallet category and its subcategories", categoryStateInput),
      ...categoryAction("restore", "Restore a wallet category (a subcategory needs its parent active)", categoryStateInput),
      ...categoryAction("hide", "Hide a system category in this wallet", categoryVisibilityInput),
      ...categoryAction("show", "Show a hidden system category again", categoryVisibilityInput),
      "/api/wallets/{id}/transactions": {
        get: {
          tags: ["transactions"],
          summary: "Entries of a period, with totals",
          description:
            "Any member. Newest first, up to 2000. `categoryId` also matches its subcategories; `q` searches the description. Totals: paid income, paid expenses plus card purchases, and pending amounts. Transfers count as neither.",
          security: [{ session: [] }],
          parameters: [
            walletIdParam,
            { name: "from", in: "query", required: true, schema: { type: "string", format: "date" } },
            { name: "to", in: "query", required: true, schema: { type: "string", format: "date" } },
            { name: "accountId", in: "query", required: false, schema: { type: "string", format: "uuid" } },
            { name: "categoryId", in: "query", required: false, schema: { type: "string", format: "uuid" } },
            { name: "q", in: "query", required: false, schema: { type: "string" } },
          ],
          responses: { 200: response("The entries and totals.", ref("EntryList")), ...walletErrors("invalidInput", "notFound") },
        },
        post: {
          tags: ["transactions"],
          summary: "Create an income or an expense",
          description: `OWNER, ADMIN, EDITOR. The category must fit the type (an expense category for an expense). Locks the wallet's currency. ${originNote}`,
          security: [{ session: [] }],
          parameters: [walletIdParam],
          requestBody: body(createEntryInput),
          responses: {
            201: response("Created (or already created by this mutationId).", ref("Entry")),
            ...walletErrors("invalidInput", "forbidden", "notFound"),
          },
        },
      },
      "/api/wallets/{id}/transactions/transfers": {
        post: {
          tags: ["transactions"],
          summary: "Transfer between two accounts",
          description: `OWNER, ADMIN, EDITOR. Creates TRANSFER_OUT (\`id\`) and TRANSFER_IN (\`inId\`) linked by \`transaction_links\`. ${originNote}`,
          security: [{ session: [] }],
          parameters: [walletIdParam],
          requestBody: body(createTransferInput),
          responses: {
            201: response("The outgoing leg.", ref("Entry")),
            ...walletErrors("invalidInput", "forbidden", "notFound"),
          },
        },
      },
      "/api/wallets/{id}/transactions/{entryId}": {
        patch: {
          tags: ["transactions"],
          summary: "Edit an entry",
          description: `OWNER, ADMIN, EDITOR. Description, notes and category: the last write wins. Amount, date, account and status: only from the latest version (\`409 versionConflict\`). On a transfer, shared fields change on both legs; \`accountId\` moves only this leg. Card purchases answer \`403\`. ${originNote}`,
          security: [{ session: [] }],
          parameters: [walletIdParam, entryIdParam],
          requestBody: body(updateEntryInput),
          responses: {
            200: response("The entry after the change.", ref("Entry")),
            ...walletErrors("invalidInput", "forbidden", "notFound", "versionConflict"),
          },
        },
      },
      "/api/wallets/{id}/transactions/{entryId}/archive": {
        post: {
          tags: ["transactions"],
          summary: "Delete (archive) an entry",
          description: `OWNER, ADMIN, EDITOR. Both legs of a transfer go together; the audit log keeps the record. ${originNote}`,
          security: [{ session: [] }],
          parameters: [walletIdParam, entryIdParam],
          requestBody: body(entryStateInput),
          responses: { 200: response("The archived entry.", ref("Entry")), ...walletErrors("invalidInput", "forbidden", "notFound") },
        },
      },
      ...cardPaths(),
      ...planningPaths(),
      ...memberPaths(),
      ...tagPaths(),
      ...recurrencePaths(),
      ...rulePaths(),
      "/api/wallets/{id}/activity": {
        get: {
          tags: ["activity"],
          summary: "The wallet's activity",
          description: "Any member. Newest first, 50 per page, with field-level changes. Pass `nextBefore` as `before` for older entries.",
          security: [{ session: [] }],
          parameters: [walletIdParam, { name: "before", in: "query", required: false, schema: { type: "string", format: "date-time" } }],
          responses: { 200: response("A page of entries.", ref("ActivityPage")), ...walletErrors("invalidInput", "notFound") },
        },
      },
      "/api/wallets/{id}/activity/verify": {
        get: {
          tags: ["activity"],
          summary: "Check the audit hash chain",
          description: "OWNER, ADMIN. Recomputes every hash, oldest first; `brokenAt` is the first entry that does not match.",
          security: [{ session: [] }],
          parameters: [walletIdParam],
          responses: { 200: response("The result.", ref("ChainCheck")), ...walletErrors("forbidden", "notFound") },
        },
      },
    },
  };
}

const cardIdParam = { name: "cardId", in: "path", required: true, schema: { type: "string", format: "uuid" } };
const monthParam = {
  name: "month",
  in: "path",
  required: true,
  description: "Reference month of the invoice (the month it closes in).",
  schema: { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$", example: "2026-10" },
};

/** One write operation on a card resource: OWNER, ADMIN, EDITOR, idempotent by `mutationId`. */
function cardWrite(
  summary: string,
  description: string,
  parameters: unknown[],
  input: z.ZodType,
  ok: Record<number, unknown>,
  errors: string[],
) {
  return {
    tags: ["cards"],
    summary,
    description: `${description} ${originNote}`,
    security: [{ session: [] }],
    parameters,
    requestBody: body(input),
    responses: { ...ok, ...walletErrors(...errors) },
  };
}

function cardPaths() {
  const card = [walletIdParam, cardIdParam];
  const invoice = [walletIdParam, cardIdParam, monthParam];
  const purchase = [walletIdParam, cardIdParam, entryIdParam];
  return {
    "/api/wallets/{id}/cards": {
      get: {
        tags: ["cards"],
        summary: "Cards with the limit used and the current invoice",
        description: "Any member. `usedMinor` sums the purchases of unpaid invoices. `?archived=1` lists the archived cards.",
        security: [{ session: [] }],
        parameters: [walletIdParam, { name: "archived", in: "query", required: false, schema: { type: "string", enum: ["0", "1"] } }],
        responses: { 200: response("The cards.", ref("CardList")), ...walletErrors("notFound") },
      },
      post: cardWrite("Create a card", "OWNER, ADMIN, EDITOR. `paymentAccountId` is the account that usually pays the invoices.", [walletIdParam], createCardInput, { 201: response("The card.", ref("Card")) }, ["invalidInput", "forbidden", "notFound"]),
    },
    "/api/wallets/{id}/cards/{cardId}": {
      patch: cardWrite("Edit a card", "Name, brand, color: the last write wins. Limit, days and paying account need the latest version. New days apply to invoices opened afterwards.", card, updateCardInput, { 200: response("The card.", ref("Card")) }, ["invalidInput", "forbidden", "notFound", "versionConflict"]),
    },
    "/api/wallets/{id}/cards/{cardId}/archive": {
      post: cardWrite("Archive a card", "Invoices and purchases are kept.", card, cardStateInput, { 200: response("The card.", ref("Card")) }, ["invalidInput", "forbidden", "notFound"]),
    },
    "/api/wallets/{id}/cards/{cardId}/restore": {
      post: cardWrite("Restore a card", "", card, cardStateInput, { 200: response("The card.", ref("Card")) }, ["invalidInput", "forbidden", "notFound"]),
    },
    "/api/wallets/{id}/cards/{cardId}/invoices": {
      get: {
        tags: ["cards"],
        summary: "Every invoice of the card",
        description: "Any member. Newest first, with totals and state (`OPEN`, `CLOSED`, `OVERDUE`, `PAID`), including the current invoice even before it has purchases.",
        security: [{ session: [] }],
        parameters: card,
        responses: { 200: response("The invoices.", ref("InvoiceList")), ...walletErrors("notFound") },
      },
    },
    "/api/wallets/{id}/cards/{cardId}/invoices/{month}": {
      get: {
        tags: ["cards"],
        summary: "One invoice with its purchases",
        description: "Any member. A month without purchases answers an empty invoice with its dates.",
        security: [{ session: [] }],
        parameters: invoice,
        responses: { 200: response("The invoice.", ref("InvoiceDetail")), ...walletErrors("invalidInput", "notFound") },
      },
    },
    "/api/wallets/{id}/cards/{cardId}/invoices/{month}/pay": {
      post: cardWrite("Pay an invoice", "Pays the whole invoice from an account: `amountMinor` must equal the total. Creates a CREDIT_CARD_PAYMENT entry and marks the invoice and its purchases paid. A paid invoice takes no new purchases.", invoice, payInvoiceInput, { 200: response("The invoice.", ref("Invoice")) }, ["invalidInput", "forbidden", "notFound", "invoicePaid"]),
    },
    "/api/wallets/{id}/cards/{cardId}/invoices/{month}/reopen": {
      post: cardWrite("Reopen a paid invoice", "Deletes the payment entry; the invoice and its purchases are open again.", invoice, reopenInvoiceInput, { 200: response("The invoice.", ref("Invoice")) }, ["invalidInput", "forbidden", "notFound"]),
    },
    "/api/wallets/{id}/cards/{cardId}/purchases": {
      post: cardWrite("Create a purchase", "OWNER, ADMIN, EDITOR. With `installments` > 1 the total is split in minor units (leftover on the first); installment k is dated k−1 months later and goes to that date's invoice. Answers every installment.", [walletIdParam, cardIdParam], createPurchaseInput, { 201: response("The installments.", { type: "array", items: ref("Entry") }) }, ["invalidInput", "forbidden", "notFound", "invoicePaid"]),
    },
    "/api/wallets/{id}/cards/{cardId}/purchases/{entryId}": {
      patch: cardWrite("Edit a purchase", "Description, category and notes of every installment; the last write wins. To change amount or date, delete and add again.", purchase, updatePurchaseInput, { 204: response("Saved.") }, ["invalidInput", "forbidden", "notFound"]),
    },
    "/api/wallets/{id}/cards/{cardId}/purchases/{entryId}/archive": {
      post: cardWrite("Delete a purchase", "Deletes every installment; refused when one is on a paid invoice.", purchase, purchaseStateInput, { 204: response("Deleted.") }, ["invalidInput", "forbidden", "notFound", "invoicePaid"]),
    },
  };
}

function rulePaths() {
  const ruleIdParam = { name: "ruleId", in: "path", required: true, schema: { type: "string", format: "uuid" } };
  const write = (summary: string, description: string, parameters: unknown[], input: z.ZodType, ok: Record<number, unknown>, errors: string[]) => ({
    ...cardWrite(summary, description, parameters, input, ok, errors),
    tags: ["rules"],
  });
  const one = [walletIdParam, ruleIdParam];
  return {
    "/api/wallets/{id}/rules": {
      get: {
        tags: ["rules"],
        summary: "The wallet's rules",
        description: "Any member. In priority order (lowest first).",
        security: [{ session: [] }],
        parameters: [walletIdParam],
        responses: { 200: response("The rules.", ref("RuleList")), ...walletErrors("notFound") },
      },
      post: write("Create a rule", "OWNER, ADMIN, EDITOR. New rules go last. With `applyToHistory` (and active), it also runs on existing entries; those changes are audited with source RULE.", [walletIdParam], createRuleInput, { 201: response("The rule.", ref("Rule")) }, ["invalidInput", "forbidden", "notFound"]),
    },
    "/api/wallets/{id}/rules/preview": {
      post: write("Preview conditions", "Any member. Counts the existing entries the conditions match (with up to 5 examples); changes nothing.", [walletIdParam], previewRuleInput, { 200: response("The preview.", ref("RulePreview")) }, ["invalidInput", "notFound"]),
    },
    "/api/wallets/{id}/rules/{ruleId}": {
      patch: write("Edit a rule", "OWNER, ADMIN, EDITOR. With `applyToHistory` on, it runs again on existing entries.", one, updateRuleInput, { 200: response("The rule.", ref("Rule")) }, ["invalidInput", "forbidden", "notFound"]),
    },
    "/api/wallets/{id}/rules/{ruleId}/apply": {
      post: write("Apply a rule now", "OWNER, ADMIN, EDITOR. Sets the rule's category (when it fits the entry's direction) and adds its tags on every matching existing entry.", one, ruleActionInput, { 200: response("How many entries changed.", ref("RuleApplyResult")) }, ["invalidInput", "forbidden", "notFound"]),
    },
    "/api/wallets/{id}/rules/{ruleId}/archive": {
      post: write("Delete a rule", "OWNER, ADMIN, EDITOR. Entries it changed keep their values.", one, ruleActionInput, { 204: response("Deleted.") }, ["invalidInput", "forbidden", "notFound"]),
    },
  };
}

function recurrencePaths() {
  const recurrenceIdParam = { name: "recurrenceId", in: "path", required: true, schema: { type: "string", format: "uuid" } };
  const write = (summary: string, description: string, parameters: unknown[], input: z.ZodType, ok: Record<number, unknown>, errors: string[]) => ({
    ...cardWrite(summary, description, parameters, input, ok, errors),
    tags: ["recurrences"],
  });
  const one = [walletIdParam, recurrenceIdParam];
  const ok = { 200: response("The recurrence.", ref("Recurrence")) };
  return {
    "/api/wallets/{id}/recurrences": {
      get: {
        tags: ["recurrences"],
        summary: "Recurrences with their next date",
        description: "Any member. `?archived=1` lists the ended ones.",
        security: [{ session: [] }],
        parameters: [walletIdParam, { name: "archived", in: "query", required: false, schema: { type: "string", enum: ["0", "1"] } }],
        responses: { 200: response("The recurrences.", ref("RecurrenceList")), ...walletErrors("notFound") },
      },
      post: write("Create a recurrence", "OWNER, ADMIN, EDITOR. Exactly one of `accountId` and `creditCardId`. Creates occurrences from `startDate` to 90 days ahead, as pending (the first one paid with `firstPaid`, accounts only). `fromEntryId` makes an existing entry on `startDate` the first occurrence instead of a copy. Card occurrences go to their date's invoice and skip paid invoices.", [walletIdParam], createRecurrenceInput, { 201: response("The recurrence.", ref("Recurrence")) }, ["invalidInput", "forbidden", "notFound"]),
    },
    "/api/wallets/{id}/recurrences/refresh": {
      post: write("Top up occurrences", "Any member (the app calls it when the Statement or Home opens). Creates missing occurrences from today to the horizon; deleted ones never come back. A no-op when nothing is missing.", [walletIdParam], refreshRecurrencesInput, { 200: response("How many were created.", ref("RefreshResult")) }, ["invalidInput", "notFound"]),
    },
    "/api/wallets/{id}/recurrences/{recurrenceId}": {
      patch: write("Edit a recurrence", "OWNER, ADMIN, EDITOR. From today on: pending occurrences still on the schedule take the new values, the others are deleted, missing dates are created. Past and paid occurrences stay. Amount, source and frequency need the latest version.", one, updateRecurrenceInput, ok, ["invalidInput", "forbidden", "notFound", "versionConflict"]),
    },
    "/api/wallets/{id}/recurrences/{recurrenceId}/archive": {
      post: write("End a recurrence", "OWNER, ADMIN, EDITOR. Pending occurrences from today are deleted; past ones stay.", one, recurrenceStateInput, ok, ["invalidInput", "forbidden", "notFound"]),
    },
  };
}

function tagPaths() {
  const tagIdParam = { name: "tagId", in: "path", required: true, schema: { type: "string", format: "uuid" } };
  const write = (summary: string, description: string, parameters: unknown[], input: z.ZodType, ok: Record<number, unknown>, errors: string[]) => ({
    ...cardWrite(summary, `OWNER, ADMIN, EDITOR. ${description}`, parameters, input, ok, errors),
    tags: ["tags"],
  });
  const tag = [walletIdParam, tagIdParam];
  const tagOk = { 200: response("The tag.", ref("Tag")) };
  return {
    "/api/wallets/{id}/tags": {
      get: {
        tags: ["tags"],
        summary: "The wallet's tags",
        description: "Any member. By name; `?archived=1` lists the archived ones.",
        security: [{ session: [] }],
        parameters: [walletIdParam, { name: "archived", in: "query", required: false, schema: { type: "string", enum: ["0", "1"] } }],
        responses: { 200: response("The tags.", ref("TagList")), ...walletErrors("notFound") },
      },
      post: write("Create a tag", "A name that already exists (ignoring case) answers the existing tag.", [walletIdParam], createTagInput, { 201: response("The tag.", ref("Tag")) }, ["invalidInput", "forbidden", "notFound"]),
    },
    "/api/wallets/{id}/tags/{tagId}": {
      patch: write("Rename or recolor a tag", "Another active tag's name is refused.", tag, updateTagInput, tagOk, ["invalidInput", "forbidden", "notFound"]),
    },
    "/api/wallets/{id}/tags/{tagId}/archive": {
      post: write("Archive a tag", "It disappears from entries and pickers.", tag, tagStateInput, tagOk, ["invalidInput", "forbidden", "notFound"]),
    },
    "/api/wallets/{id}/tags/{tagId}/restore": {
      post: write("Restore a tag", "Refused while another active tag has its name.", tag, tagStateInput, tagOk, ["invalidInput", "forbidden", "notFound"]),
    },
    "/api/wallets/{id}/transactions/{entryId}/tags": {
      post: write("Set an entry's tags", "Replaces the set; a card purchase's installments all get it. Entries can also get tags when created (`tagIds`).", [walletIdParam, entryIdParam], setEntryTagsInput, { 200: response("The entry's tags.", { type: "object", properties: { tagIds: { type: "array", items: { type: "string", format: "uuid" } } } }) }, ["invalidInput", "forbidden", "notFound"]),
    },
  };
}

function memberPaths() {
  const memberIdParam = { name: "memberId", in: "path", required: true, schema: { type: "string", format: "uuid" } };
  const inviteIdParam = { name: "inviteId", in: "path", required: true, schema: { type: "string", format: "uuid" } };
  const tokenParam = { name: "token", in: "path", required: true, description: "The invite link's token.", schema: { type: "string", pattern: "^[A-Za-z0-9_-]{43}$" } };
  const write = (summary: string, description: string, parameters: unknown[], input: z.ZodType, ok: Record<number, unknown>, errors: string[]) => ({
    ...cardWrite(summary, description, parameters, input, ok, errors),
    tags: ["members"],
  });
  const membersOk = { 200: response("Members and pending invites.", ref("Members")) };
  const invite = [walletIdParam, inviteIdParam];
  const member = [walletIdParam, memberIdParam];
  return {
    "/api/wallets/{id}/members": {
      get: {
        tags: ["members"],
        summary: "Members and pending invites",
        description: "Any member.",
        security: [{ session: [] }],
        parameters: [walletIdParam],
        responses: { ...membersOk, ...walletErrors("notFound") },
      },
    },
    "/api/wallets/{id}/invites": {
      post: write("Invite someone", "OWNER, ADMIN (only the OWNER invites ADMINs). A pending invite to the same e-mail gets a new link instead. Answers the token once; build the link as `/app/invites/{token}`. The answer does not tell whether the e-mail has an account.", [walletIdParam], createInviteInput, { 201: response("The invite and its token.", ref("InviteLink")) }, ["invalidInput", "forbidden", "notFound", "alreadyMember"]),
    },
    "/api/wallets/{id}/invites/{inviteId}/renew": {
      post: write("New link for an invite", "OWNER, ADMIN. The previous link stops working.", invite, inviteActionInput, { 200: response("The invite and its new token.", ref("InviteLink")) }, ["invalidInput", "forbidden", "notFound"]),
    },
    "/api/wallets/{id}/invites/{inviteId}/revoke": {
      post: write("Cancel an invite", "OWNER, ADMIN.", invite, inviteActionInput, membersOk, ["invalidInput", "forbidden", "notFound"]),
    },
    "/api/wallets/{id}/members/{memberId}/role": {
      post: write("Change a member's role", "Nobody changes their own role or a role equal to or above their own; OWNER only through a transfer.", member, changeRoleInput, membersOk, ["invalidInput", "forbidden", "notFound"]),
    },
    "/api/wallets/{id}/members/{memberId}/remove": {
      post: write("Remove a member", "Access ends at once: roles are read on every request.", member, memberActionInput, membersOk, ["invalidInput", "forbidden", "notFound"]),
    },
    "/api/wallets/{id}/leave": {
      post: write("Leave the wallet", "Anyone but the OWNER.", [walletIdParam], memberActionInput, { 204: response("Left.") }, ["invalidInput", "notFound", "ownerCannotLeave"]),
    },
    "/api/invites/{token}": {
      get: {
        tags: ["members"],
        summary: "Preview an invite",
        description: "Signed-in user with the link: wallet, inviter, role, state, and whether this account has the invited e-mail.",
        security: [{ session: [] }],
        parameters: [tokenParam],
        responses: { 200: response("The invite.", ref("InvitePreview")), ...walletErrors("inviteInvalid") },
      },
    },
    "/api/invites/{token}/accept": {
      post: write("Accept an invite", "Needs the link and the invited account; the person joins with the invited role.", [tokenParam], memberActionInput, { 200: response("The wallet joined.", ref("AcceptedInvite")) }, ["invalidInput", "inviteInvalid", "inviteWrongAccount"]),
    },
    "/api/invites/{token}/decline": {
      post: write("Decline an invite", "Needs the link and the invited account.", [tokenParam], memberActionInput, { 200: response("The wallet of the invite.", ref("AcceptedInvite")) }, ["invalidInput", "inviteInvalid", "inviteWrongAccount"]),
    },
  };
}

function planningPaths() {
  const budgetMonthParam = { ...monthParam, description: "Budget month." };
  const goalIdParam = { name: "goalId", in: "path", required: true, schema: { type: "string", format: "uuid" } };
  const depositIdParam = { name: "depositId", in: "path", required: true, schema: { type: "string", format: "uuid" } };
  const write = (summary: string, description: string, parameters: unknown[], input: z.ZodType, ok: Record<number, unknown>, errors: string[]) => ({
    ...cardWrite(summary, `OWNER, ADMIN, EDITOR. ${description}`, parameters, input, ok, errors),
    tags: ["planning"],
  });
  const budget = [walletIdParam, budgetMonthParam];
  const goal = [walletIdParam, goalIdParam];
  const budgetOk = { 200: response("The month after the change.", ref("BudgetMonth")) };
  const goalOk = { 200: response("The goal.", ref("GoalDetail")) };
  return {
    "/api/wallets/{id}/budget/{month}": {
      get: {
        tags: ["planning"],
        summary: "Budget of a month",
        description: "Any member. Each limit with what its category and subcategories spent (paid expenses plus card purchases), and the spending in categories without a limit.",
        security: [{ session: [] }],
        parameters: budget,
        responses: { 200: response("The month.", ref("BudgetMonth")), ...walletErrors("invalidInput", "notFound") },
      },
    },
    "/api/wallets/{id}/budget/{month}/set": {
      post: write("Set a category limit", "Top-level expense categories only. Creates, changes or restores the limit; the last write wins.", budget, setBudgetItemInput, budgetOk, ["invalidInput", "forbidden", "notFound"]),
    },
    "/api/wallets/{id}/budget/{month}/remove": {
      post: write("Remove a category limit", "", budget, removeBudgetItemInput, budgetOk, ["invalidInput", "forbidden", "notFound"]),
    },
    "/api/wallets/{id}/budget/{month}/copy-previous": {
      post: write("Copy last month's limits", "Limits already set in this month are kept.", budget, copyBudgetInput, budgetOk, ["invalidInput", "forbidden", "notFound"]),
    },
    "/api/wallets/{id}/goals": {
      get: {
        tags: ["planning"],
        summary: "Goals with the amount saved",
        description: "Any member. `savedMinor` = initial amount + deposits. `?archived=1` lists the archived goals.",
        security: [{ session: [] }],
        parameters: [walletIdParam, { name: "archived", in: "query", required: false, schema: { type: "string", enum: ["0", "1"] } }],
        responses: { 200: response("The goals.", ref("GoalList")), ...walletErrors("notFound") },
      },
      post: write("Create a goal", "", [walletIdParam], createGoalInput, { 201: response("The goal.", ref("GoalDetail")) }, ["invalidInput", "forbidden", "notFound"]),
    },
    "/api/wallets/{id}/goals/{goalId}": {
      get: {
        tags: ["planning"],
        summary: "A goal with its deposits",
        description: "Any member.",
        security: [{ session: [] }],
        parameters: goal,
        responses: { 200: response("The goal.", ref("GoalDetail")), ...walletErrors("notFound") },
      },
      patch: write("Edit a goal", "The last write wins.", goal, updateGoalInput, goalOk, ["invalidInput", "forbidden", "notFound"]),
    },
    "/api/wallets/{id}/goals/{goalId}/archive": {
      post: write("Archive a goal", "Deposits are kept.", goal, goalStateInput, goalOk, ["invalidInput", "forbidden", "notFound"]),
    },
    "/api/wallets/{id}/goals/{goalId}/restore": {
      post: write("Restore a goal", "", goal, goalStateInput, goalOk, ["invalidInput", "forbidden", "notFound"]),
    },
    "/api/wallets/{id}/goals/{goalId}/deposits": {
      post: write("Add or take out money", "Positive adds, negative takes out (never 0). The goal is marked achieved while the saved amount reaches the target.", goal, createDepositInput, { 201: response("The goal.", ref("GoalDetail")) }, ["invalidInput", "forbidden", "notFound"]),
    },
    "/api/wallets/{id}/goals/{goalId}/deposits/{depositId}/archive": {
      post: write("Delete a deposit", "", [...goal, depositIdParam], depositStateInput, goalOk, ["invalidInput", "forbidden", "notFound"]),
    },
  };
}

function categoryAction(action: string, summary: string, input: z.ZodType) {
  return {
    [`/api/wallets/{id}/categories/{categoryId}/${action}`]: {
      post: {
        tags: ["categories"],
        summary,
        description: `OWNER, ADMIN, EDITOR. ${originNote}`,
        security: [{ session: [] }],
        parameters: [walletIdParam, categoryIdParam],
        requestBody: body(input),
        responses: { 200: response("The category.", ref("Category")), ...walletErrors("invalidInput", "forbidden", "notFound") },
      },
    },
  };
}

const entryIdParam = { name: "entryId", in: "path", required: true, schema: { type: "string", format: "uuid" } };
const categoryIdParam = { name: "categoryId", in: "path", required: true, schema: { type: "string", format: "uuid" } };

const walletIdParam = { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } };
const accountIdParam = { name: "accountId", in: "path", required: true, schema: { type: "string", format: "uuid" } };

const WALLET_ERROR_STATUS: Record<string, [number, string]> = {
  invalidInput: [400, "Invalid input."],
  invalidCredentials: [401, "Wrong password."],
  forbidden: [403, "The member's role does not allow it."],
  notFound: [404, "No such wallet, archived, or not a member."],
  currencyLocked: [409, "The currency is fixed after the first entry."],
  versionConflict: [409, "The row changed since `baseVersion`."],
  invoicePaid: [409, "The invoice is paid; reopen it first."],
  alreadyMember: [409, "That e-mail is already a member."],
  inviteInvalid: [410, "The link expired, was used or canceled."],
  inviteWrongAccount: [403, "The invite is for another e-mail."],
  ownerCannotLeave: [409, "The owner has to transfer ownership first."],
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
