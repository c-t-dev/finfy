import type { Metadata } from "next";
import NextLink from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CloudOffIcon, CoinsIcon, HistoryIcon, LanguagesIcon, ShieldCheckIcon, UsersIcon } from "lucide-react";
import { clientEnv } from "@packages/env/client";
import { AppIcon } from "@packages/app/app-shell";
import { APP_BASE } from "@packages/app/app-base";
import { LOCALE_PREFIXES, LOCALES, type Locale } from "@packages/shared/i18n";
import { buttonVariants } from "@packages/ui/components/button";
import { PublicLanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";

const FEATURES = [
  { key: "currencies", icon: CoinsIcon },
  { key: "sharing", icon: UsersIcon },
  { key: "offline", icon: CloudOffIcon },
  { key: "history", icon: HistoryIcon },
  { key: "security", icon: ShieldCheckIcon },
  { key: "languages", icon: LanguagesIcon },
] as const;

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
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const t = await getTranslations("public");
  const tCommon = await getTranslations("common");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-titlebar backdrop-blur-2xl backdrop-saturate-150">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <div className="flex items-center gap-2 text-[15px] font-semibold">
            <AppIcon className="size-6" />
            {tCommon("appName")}
          </div>
          <nav className="ml-4 text-[13px] text-foreground/70 max-sm:hidden">
            <a href="#features" className="hover:text-foreground">
              {t("nav.features")}
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <PublicLanguageSwitcher />
            <div className="max-sm:hidden">
              <ThemeToggle />
            </div>
            <NextLink href={APP_BASE} className={buttonVariants({ size: "sm" })}>
              {t("nav.openApp")}
            </NextLink>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto flex max-w-3xl flex-col items-center gap-5 px-4 pb-16 pt-20 text-center sm:pt-28">
          <span className="rounded-full border border-border bg-card/70 px-3 py-1 text-[12px] font-medium text-muted-foreground">
            {t("home.eyebrow")}
          </span>
          <h1 className="text-4xl font-semibold sm:text-5xl">{t("home.title")}</h1>
          <p className="max-w-xl text-[15px] text-muted-foreground sm:text-[17px]">{t("home.subtitle")}</p>
          <NextLink href={APP_BASE} className={buttonVariants({ size: "xl", className: "mt-2" })}>
            {t("home.cta")}
          </NextLink>
        </section>

        <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-24">
          <h2 className="mb-6 text-center text-2xl font-semibold">{t("home.features.title")}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ key, icon: Icon }) => (
              <article
                key={key}
                className="rounded-xl border border-border bg-window p-5 backdrop-blur-2xl backdrop-saturate-150"
              >
                <Icon className="mb-3 size-6 text-primary" aria-hidden />
                <h3 className="text-[15px] font-semibold">{t(`home.features.${key}.title`)}</h3>
                <p className="mt-1 text-[13px] text-muted-foreground">{t(`home.features.${key}.body`)}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 py-6 text-center text-[12px] text-muted-foreground">
        {t("home.footer", { year: new Date().getFullYear() })}
      </footer>
    </div>
  );
}
