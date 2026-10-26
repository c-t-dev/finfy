import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";
import { clientEnv } from "./client";

/**
 * Server-only variables. Importing this module from a client component throws
 * as soon as a server variable is read, which keeps secrets out of bundles.
 */
export const env = createEnv({
  extends: [clientEnv],
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    /** Postgres connection string. Optional so the public pages build without a database. */
    DATABASE_URL: z.url().optional(),
    /**
     * HMAC key applied to passwords (and OTP codes) before hashing; never in
     * the database or the repository (wiki/decisoes/0004). Add V2, V3... to
     * rotate; users are re-hashed on their next login.
     */
    PASSWORD_PEPPER_V1: z.string().min(32).optional(),
    /**
     * `open`: anyone can sign up. `invite`: a new account needs a code made by
     * an existing account (wiki/decisoes/0004); the very first account never does.
     */
    SIGN_UP_MODE: z.enum(["open", "invite"]).default("open"),
  },
  experimental__runtimeEnv: {},
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
