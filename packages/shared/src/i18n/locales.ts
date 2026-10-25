/**
 * Supported languages (wiki/decisoes/0011-traducoes.md). Adding one here plus a
 * messages file must be enough; screens never list languages themselves.
 */
export const LOCALES = ["en", "pt-BR"] as const;
export type Locale = (typeof LOCALES)[number];

/** Used when the browser asks for none of the supported languages. */
export const DEFAULT_LOCALE: Locale = "en";

/** URL prefix of the public pages, e.g. /pt-br/... (lowercase, as in the decision). */
export const LOCALE_PREFIXES: Record<Locale, `/${string}`> = {
  en: "/en",
  "pt-BR": "/pt-br",
};

/** Cookie that remembers the language for the signed-in app until accounts exist. */
export const LOCALE_COOKIE = "finfy-locale";

export function isLocale(value: string | undefined | null): value is Locale {
  return LOCALES.includes(value as Locale);
}

/** Best supported language for an Accept-Language header. */
export function matchLocale(acceptLanguage: string | null | undefined): Locale {
  const wanted = (acceptLanguage ?? "")
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { tag: tag.toLowerCase(), q: q ? Number(q) : 1 };
    })
    .filter((entry) => entry.tag)
    .sort((a, b) => b.q - a.q);
  for (const { tag } of wanted) {
    const exact = LOCALES.find((locale) => locale.toLowerCase() === tag);
    if (exact) return exact;
    const sameLanguage = LOCALES.find((locale) => locale.split("-")[0].toLowerCase() === tag.split("-")[0]);
    if (sameLanguage) return sameLanguage;
  }
  return DEFAULT_LOCALE;
}
