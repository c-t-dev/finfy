import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { AppHost } from "@/components/app-host";
import { RootDocument } from "@/components/root-document";

export { viewport } from "@/components/root-document";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common");
  // The signed-in app is never indexed.
  return { title: t("appName"), robots: { index: false, follow: false } };
}

export default async function SignedInLayout({ children }: LayoutProps<"/app">) {
  const locale = await getLocale();
  return (
    <RootDocument locale={locale}>
      <AppHost>{children}</AppHost>
    </RootDocument>
  );
}
