import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { isLocale, LOCALE_COOKIE, matchLocale, type Locale } from "@packages/shared/i18n";

/**
 * Public pages get the locale from the URL segment. The signed-in app has no
 * segment: it uses the saved choice (cookie, later `users.language`), then the
 * browser's Accept-Language.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const fromUrl = await requestLocale;
  let locale: Locale;
  if (isLocale(fromUrl)) {
    locale = fromUrl;
  } else {
    const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
    locale = isLocale(saved) ? saved : matchLocale((await headers()).get("accept-language"));
  }
  return {
    locale,
    messages: (await import(`@packages/shared/i18n/messages/${locale}`)).default,
  };
});
