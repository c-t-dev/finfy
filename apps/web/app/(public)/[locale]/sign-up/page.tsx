import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { APP_BASE } from "@packages/app/app-base";
import type { Locale } from "@packages/shared/i18n";
import { AuthFlow } from "@/components/auth-flow";
import { getCurrentUser } from "@/lib/server/auth/session";
import { safeNextPath } from "@/lib/next-path";
import { signUpNeedsCode } from "@/lib/server/signup-invites";

export async function generateMetadata({ params }: PageProps<"/[locale]/sign-up">): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale as Locale, namespace: "auth.signUp" });
  return { title: t("metaTitle"), robots: { index: false, follow: true } };
}

export default async function Page({ params, searchParams }: PageProps<"/[locale]/sign-up">) {
  setRequestLocale((await params).locale as Locale);
  const query = await searchParams;
  const next = safeNextPath(query.next as string | undefined);
  if (await getCurrentUser()) redirect(next ?? APP_BASE);
  // An invite link carries the code (`?code=`); only its letters and digits are kept.
  const code = typeof query.code === "string" ? query.code.replace(/[^A-Za-z0-9-]/g, "").slice(0, 40) : "";
  const needsCode = await signUpNeedsCode();
  return <AuthFlow mode="signUp" next={next} inviteCode={needsCode || code ? { required: needsCode, value: code } : null} />;
}
