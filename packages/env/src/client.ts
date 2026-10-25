import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Variables exposed to the browser. They must be prefixed with NEXT_PUBLIC_
 * and are inlined at build time, so each one has to be listed explicitly in
 * `runtimeEnv`.
 */
export const clientEnv = createEnv({
  client: {
    NEXT_PUBLIC_APP_NAME: z.string().min(1).default("finfy"),
    /** Public origin, used for canonical and hreflang links of the public pages. */
    NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  },
  runtimeEnv: {
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
