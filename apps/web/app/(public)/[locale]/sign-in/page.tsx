import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { APP_BASE } from "@packages/app/navigation";
import type { Locale } from "@packages/shared/i18n";
import { AuthFlow } from "@/components/auth-flow";
import { getCurrentUser } from "@/lib/server/auth/session";
import { safeNextPath } from "@/lib/next-path";

export async function generateMetadata({ params }: PageProps<"/[locale]/sign-in">): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale as Locale, namespace: "auth.signIn" });
  return { title: t("metaTitle"), robots: { index: false, follow: true } };
}

export default async function Page({ params, searchParams }: PageProps<"/[locale]/sign-in">) {
  setRequestLocale((await params).locale as Locale);
  const next = safeNextPath((await searchParams).next as string | undefined);
  if (await getCurrentUser()) redirect(next ?? APP_BASE);
  return <AuthFlow mode="signIn" next={next} />;
}
