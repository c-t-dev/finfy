"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AuthWindow, SignInForm, SignUpForm, VerifyEmailForm } from "@packages/app/auth";
import { APP_BASE } from "@packages/app/navigation";
import { PublicLanguageSwitcher } from "@/components/language-switcher";
import { Link } from "@/i18n/navigation";
import { webAuthClient } from "@/lib/auth-client";

const linkClass = "font-medium text-primary hover:underline";

/**
 * Sign-in or sign-up, then the e-mail code step when needed. The step lives
 * in state, so the e-mail never goes into the URL.
 */
export function AuthFlow({ mode }: { mode: "signIn" | "signUp" }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [verifyEmail, setVerifyEmail] = React.useState<string | null>(null);
  const goToApp = () => {
    router.replace(APP_BASE);
    router.refresh();
  };

  if (verifyEmail) {
    return (
      <AuthWindow title={t("verify.title")} trailing={<PublicLanguageSwitcher />}>
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
    <AuthWindow title={t("signIn.title")} trailing={<PublicLanguageSwitcher />}>
      <SignInForm
        client={webAuthClient}
        onDone={goToApp}
        onVerify={setVerifyEmail}
        signUpLink={
          <Link href="/sign-up" className={linkClass}>
            {t("signIn.toSignUp")}
          </Link>
        }
      />
    </AuthWindow>
  ) : (
    <AuthWindow title={t("signUp.title")} trailing={<PublicLanguageSwitcher />}>
      <SignUpForm
        client={webAuthClient}
        onVerify={setVerifyEmail}
        signInLink={
          <Link href="/sign-in" className={linkClass}>
            {t("signUp.toSignIn")}
          </Link>
        }
      />
    </AuthWindow>
  );
}
