import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { RootDocument } from "@/components/root-document";
import { routing } from "@/i18n/routing";

export { viewport } from "@/components/root-document";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function PublicLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <RootDocument locale={locale}>{children}</RootDocument>;
}
