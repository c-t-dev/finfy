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
  },
  experimental__runtimeEnv: {},
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
