"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter as useNextRouter } from "next/navigation";
import { SegmentedControl } from "@packages/ui/components/segmented-control";
import { LOCALE_COOKIE, LOCALES, type Locale } from "@packages/shared/i18n";
import { usePathname, useRouter } from "@/i18n/navigation";

const SHORT: Record<Locale, string> = { en: "EN", "pt-BR": "PT" };

function Switcher({ onChange }: { onChange: (locale: Locale) => void }) {
  const t = useTranslations("common");
  const locale = useLocale();
  return (
    <SegmentedControl<Locale>
      aria-label={t("language")}
      size="sm"
      value={locale}
      onValueChange={onChange}
      options={LOCALES.map((value) => ({ value, label: SHORT[value], title: t(`languages.${value}`) }))}
    />
  );
}

/** Public pages: the language is in the URL, so switching navigates to the same page. */
export function PublicLanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  return <Switcher onChange={(locale) => router.replace(pathname, { locale })} />;
}

/**
 * Signed-in app: no locale in the URL. The choice is saved in a cookie until
 * accounts exist; then it becomes `users.language`.
 */
export function AppLanguageSwitcher() {
  const router = useNextRouter();
  return (
    <Switcher
      onChange={(locale) => {
        document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
        router.refresh();
      }}
    />
  );
}
