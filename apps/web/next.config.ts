import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
// Validate env vars at build/start time.
import "@packages/env/server";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  transpilePackages: ["@packages/app", "@packages/env", "@packages/shared", "@packages/ui"],
  // Native binding; must not be bundled.
  serverExternalPackages: ["@node-rs/argon2"],
};

export default withNextIntl(nextConfig);
