import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { LOCALE_PREFIXES } from "@packages/shared/i18n";
import { AppHost } from "@/components/app-host";
import { RootDocument } from "@/components/root-document";
import { getCurrentUser } from "@/lib/server/auth/session";
import { WINDOW_WIDE_COOKIE } from "@/lib/cookies";

export { viewport } from "@/components/root-document";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common");
  // The signed-in app is never indexed.
  return { title: t("appName"), robots: { index: false, follow: false } };
}

/** Everything under /app needs a session; without one, go to the sign-in page in the visitor's language. */
export default async function SignedInLayout({ children }: LayoutProps<"/app">) {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) redirect(`${LOCALE_PREFIXES[locale]}/sign-in`);

  const wide = (await cookies()).get(WINDOW_WIDE_COOKIE)?.value === "1";
  return (
    <RootDocument locale={locale}>
      <AppHost initialWide={wide} user={{ name: user.name, email: user.email }}>
        {children}
      </AppHost>
    </RootDocument>
  );
}
