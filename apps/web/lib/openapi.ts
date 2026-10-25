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
            error: { type: "string", enum: [...AUTH_ERRORS] },
            retryAfterSeconds: { type: "integer", description: "Only with `rateLimited`." },
          },
        },
        AuthNext: json(authNextSchema),
        CurrentUser: json(currentUserSchema),
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
          description: `Always answers \`verifyEmail\`, whether or not the e-mail already has an account; a code (or a notice) is e-mailed. ${originNote}`,
          requestBody: body(signUpInput),
          responses: authResponses("passwordTooShort", "passwordTooLong", "passwordSameAsEmail", "passwordBreached"),
        },
      },
      "/api/auth/sign-in": {
        post: {
          tags: ["auth"],
          summary: "Sign in with e-mail and password",
          description: `A verified account gets a session cookie and \`app\`; an unverified one gets a new code and \`verifyEmail\`. ${originNote}`,
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
          description: `6 digits, valid 10 minutes, 5 tries. ${originNote}`,
          requestBody: body(verifyEmailInput),
          responses: {
            ...authResponses(),
            401: err("Wrong or expired code.", "invalidCode"),
          },
        },
      },
      "/api/auth/resend-code": {
        post: {
          tags: ["auth"],
          summary: "Send a new e-mail code",
          description: `Same answer whether or not the e-mail exists. ${originNote}`,
          requestBody: body(resendCodeInput),
          responses: authResponses(),
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
    },
  };
}
