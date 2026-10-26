import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@packages/shared/i18n";
import { AuthPage } from "@/components/auth-page";

export async function generateMetadata({ params }: PageProps<"/[locale]/sign-up">): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale as Locale, namespace: "auth.signUp" });
  return { title: t("metaTitle"), robots: { index: false, follow: true } };
}

export default function Page(props: PageProps<"/[locale]/sign-up">) {
  return <AuthPage {...props} mode="signUp" />;
}
