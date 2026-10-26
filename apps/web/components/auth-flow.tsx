"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { LOCALE_PREFIXES, type Locale } from "@packages/shared/i18n";
import { AuthWindow, SignInForm, SignUpForm, VerifyEmailForm } from "@packages/app/auth";
import { APP_BASE } from "@packages/app/navigation";
import { PublicLanguageSwitcher } from "@/components/language-switcher";
import { Link } from "@/i18n/navigation";
import { webAuthClient } from "@/lib/auth-client";
import { usePublicAuthWindow } from "./public-frame";

const linkClass = "font-medium text-primary hover:underline";

/**
 * Sign-in or sign-up, then the e-mail code step when the server asks for it
 * (only while e-mail delivery is on, see lib/server/mail.ts). The step lives
 * in state, so the e-mail never goes into the URL.
 */
export function AuthFlow({
  mode,
  next,
  inviteCode = null,
  overlay = false,
}: {
  mode: "signIn" | "signUp";
  /** Already checked by safeNextPath. */
  next: string | null;
  /** Sign-up only: shows the invite code field (closed sign-up, or a code in the link). */
  inviteCode?: { required: boolean; value: string } | null;
  overlay?: boolean;
}) {
  const t = useTranslations("auth");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { minimized, setMinimized, setOverlay } = usePublicAuthWindow();
  React.useEffect(() => {
    if (!overlay) return;
    setOverlay(true);
    setMinimized(false);
    return () => setOverlay(false);
  }, [overlay, setOverlay, setMinimized]);
  const windowProps = { overlay, minimized: overlay && minimized, onMinimizedChange: setMinimized };
  const [verifyEmail, setVerifyEmail] = React.useState<string | null>(null);
  const goToApp = () => {
    router.replace(next ?? APP_BASE);
    router.refresh();
  };
  // Switching between sign-in and sign-up keeps where to go afterwards.
  const keepNext = (path: "/sign-in" | "/sign-up") => (next ? { pathname: path, query: { next } } : path);
  const authLink = (path: "/sign-in" | "/sign-up", text: string) => overlay ? (
    <Link href={keepNext(path)} className={linkClass}>{text}</Link>
  ) : (
    <a href={`${LOCALE_PREFIXES[locale]}${path}${next ? `?next=${encodeURIComponent(next)}` : ""}`} className={linkClass}>{text}</a>
  );

  if (verifyEmail) {
    return (
      <AuthWindow title={t("verify.title")} {...windowProps} trailing={<PublicLanguageSwitcher />}>
        <VerifyEmailForm
          client={webAuthClient}
          email={verifyEmail}
          onDone={goToApp}
          onBack={() => setVerifyEmail(null)}
          showDevHint={process.env.NODE_ENV === "development"}
        />
      </AuthWindow>
    );
  }

  return mode === "signIn" ? (
    <AuthWindow title={t("signIn.title")} {...windowProps} trailing={<PublicLanguageSwitcher />}>
      <SignInForm
        client={webAuthClient}
        onDone={goToApp}
        onVerify={setVerifyEmail}
        signUpLink={authLink("/sign-up", t("signIn.toSignUp"))}
      />
    </AuthWindow>
  ) : (
    <AuthWindow title={t("signUp.title")} {...windowProps} trailing={<PublicLanguageSwitcher />}>
      <SignUpForm
        client={webAuthClient}
        inviteCode={inviteCode}
        onDone={goToApp}
        onVerify={setVerifyEmail}
        signInLink={authLink("/sign-in", t("signUp.toSignIn"))}
      />
    </AuthWindow>
  );
}
