import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { isLocale, LOCALE_COOKIE, matchLocale, type Locale } from "@packages/shared/i18n";
import { getCurrentUser } from "@/lib/server/auth/session";

/**
 * Public pages get the locale from the URL segment. The signed-in app has no
 * segment: it uses the account language (`users.language`), then the cookie
 * set by the switcher, then the browser's Accept-Language.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const fromUrl = await requestLocale;
  let locale: Locale;
  if (isLocale(fromUrl)) {
    locale = fromUrl;
  } else {
    const user = await getCurrentUser();
    const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
    locale = user ? user.language : isLocale(saved) ? saved : matchLocale((await headers()).get("accept-language"));
  }
  return {
    locale,
    messages: (await import(`@packages/shared/i18n/messages/${locale}`)).default,
  };
});
