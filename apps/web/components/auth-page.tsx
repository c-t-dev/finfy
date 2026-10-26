import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import NextLink from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { APP_BASE } from "@packages/app/app-base";
import { LOCALE_PREFIXES, type Locale } from "@packages/shared/i18n";
import { PublicFooter } from "@/components/public-footer";
import { AuthFlow } from "@/components/auth-flow";
import { getCurrentUser } from "@/lib/server/auth/session";
import { safeNextPath } from "@/lib/next-path";
import { signUpNeedsCode } from "@/lib/server/signup-invites";

/** Shared authorization and query handling for full pages and intercepted windows. */
export async function AuthPage({ params, searchParams, mode, overlay = false }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  mode: "signIn" | "signUp";
  overlay?: boolean;
}) {
  const locale = (await params).locale as Locale;
  setRequestLocale(locale);
  const query = await searchParams;
  const next = safeNextPath(typeof query.next === "string" ? query.next : undefined);
  if (await getCurrentUser()) redirect(next ?? APP_BASE);
  const code = typeof query.code === "string" ? query.code.replace(/[^A-Za-z0-9-]/g, "").slice(0, 40) : "";
  const needsCode = mode === "signUp" && await signUpNeedsCode();
  const form = <AuthFlow mode={mode} next={next} overlay={overlay} inviteCode={mode === "signUp" && (needsCode || code) ? { required: needsCode, value: code } : null} />;
  if (overlay) return form;
  const t = await getTranslations("public.nav");
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl px-4 py-4">
        <NextLink href={LOCALE_PREFIXES[locale]} className="inline-flex items-center gap-2 rounded-md text-[13px] text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
          <ArrowLeftIcon className="size-4" aria-hidden />{t("backHome")}
        </NextLink>
      </header>
      <main className="flex flex-1 flex-col">{form}</main>
      <PublicFooter />
    </div>
  );
}
