import type { Locale } from "@packages/shared/i18n";
import type messages from "@packages/shared/i18n/messages/en";

// Typed message keys for next-intl; packages/app does the same for use-intl.
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
