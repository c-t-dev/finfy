import { PublicHome } from "@/components/public-home";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { clientEnv } from "@packages/env/client";
import { LOCALE_PREFIXES, LOCALES, type Locale } from "@packages/shared/i18n";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const locale = (await params).locale as Locale;
  const t = await getTranslations({ locale, namespace: "public.home" });
  const url = (l: Locale) => new URL(LOCALE_PREFIXES[l], clientEnv.NEXT_PUBLIC_APP_URL).toString();
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: {
      canonical: url(locale),
      languages: { ...Object.fromEntries(LOCALES.map((l) => [l, url(l)])), "x-default": url("en") },
    },
  };
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  return <PublicHome locale={(await params).locale as Locale} />;
}
