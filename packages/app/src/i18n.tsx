import type { Locale } from "@packages/shared/i18n";
import type messages from "@packages/shared/i18n/messages/en";

/**
 * Typed messages: a missing key is a compile error (wiki/decisoes/0011).
 * `en` is the reference file; `pnpm check:messages` keeps pt-BR in step.
 */
declare module "use-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}

export { useFormatter, useLocale, useTranslations } from "use-intl";
