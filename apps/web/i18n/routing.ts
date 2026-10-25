import { defineRouting } from "next-intl/routing";
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALE_PREFIXES, LOCALES } from "@packages/shared/i18n";

/**
 * Public pages carry the language in the URL for SEO (/en, /pt-br); `/`
 * redirects by Accept-Language, falling back to English (wiki/decisoes/0011).
 * The signed-in app under /app is not localized by URL.
 */
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: { mode: "always", prefixes: LOCALE_PREFIXES },
  localeCookie: { name: LOCALE_COOKIE },
});
