import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { AppHost } from "@/components/app-host";
import { RootDocument } from "@/components/root-document";
import { WINDOW_WIDE_COOKIE } from "@/lib/cookies";

export { viewport } from "@/components/root-document";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common");
  // The signed-in app is never indexed.
  return { title: t("appName"), robots: { index: false, follow: false } };
}

export default async function SignedInLayout({ children }: LayoutProps<"/app">) {
  const locale = await getLocale();
  const wide = (await cookies()).get(WINDOW_WIDE_COOKIE)?.value === "1";
  return (
    <RootDocument locale={locale}>
      <AppHost initialWide={wide}>{children}</AppHost>
    </RootDocument>
  );
}
