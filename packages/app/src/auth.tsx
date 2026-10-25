"use client";

import * as React from "react";
import { MailCheckIcon } from "lucide-react";
import {
  AUTH_ERRORS,
  OTP_LENGTH,
  PASSWORD_MAX,
  PASSWORD_MIN,
  passwordProblem,
  type AuthError,
  type AuthNext,
} from "@packages/shared/auth";
import { Button } from "@packages/ui/components/button";
import { Input } from "@packages/ui/components/input";
import { Label } from "@packages/ui/components/label";
import { MacTitlebar, MacWindow } from "@packages/ui/components/mac-window";
import { Spinner } from "@packages/ui/components/spinner";
import { AppIcon } from "./app-shell";
import { useLocale, useTranslations } from "./i18n";

/**
 * Sign-in, sign-up and e-mail verification forms. They talk to the API only
 * through `AuthClient`, so the web (cookies) and, later, the native apps can
 * plug in their own transport.
 */

export type AuthFailure = { error: AuthError; retryAfterSeconds?: number };
export type AuthResponse = AuthNext | AuthFailure;

export interface AuthClient {
  signIn(input: { email: string; password: string }): Promise<AuthResponse>;
  signUp(input: { name: string; email: string; password: string; locale: string }): Promise<AuthResponse>;
  verifyEmail(input: { email: string; code: string }): Promise<AuthResponse>;
  resendCode(input: { email: string }): Promise<AuthResponse>;
}

export function isFailure(response: AuthResponse): response is AuthFailure {
  return "error" in response;
}

/** Turns any response body into an AuthResponse; unknown errors become `unavailable`. */
export function toAuthResponse(body: unknown): AuthResponse {
  if (body && typeof body === "object" && "next" in body) return body as AuthNext;
  const error = (body as { error?: string } | null)?.error;
  const retryAfterSeconds = (body as { retryAfterSeconds?: number } | null)?.retryAfterSeconds;
  return { error: AUTH_ERRORS.includes(error as AuthError) ? (error as AuthError) : "unavailable", retryAfterSeconds };
}

function ErrorMessage({ failure }: { failure: AuthFailure | null }) {
  const t = useTranslations("errors.auth");
  if (!failure) return null;
  const text =
    failure.error === "rateLimited"
      ? t("rateLimited", { minutes: Math.max(1, Math.ceil((failure.retryAfterSeconds ?? 60) / 60)) })
      : failure.error === "passwordTooShort"
        ? t("passwordTooShort", { min: PASSWORD_MIN })
        : failure.error === "passwordTooLong"
          ? t("passwordTooLong", { max: PASSWORD_MAX })
          : t(failure.error);
  return (
    <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
      {text}
    </p>
  );
}

/** Small macOS window centred on the wallpaper, used by every auth step. */
export function AuthWindow({ title, children, trailing }: { title: string; children: React.ReactNode; trailing?: React.ReactNode }) {
  const t = useTranslations("common");
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <MacWindow className="w-full max-w-sm rounded-xl border border-border">
        <MacTitlebar icon={<AppIcon />} title={t("appName")} trailing={trailing} className="static" />
        <div className="flex flex-col gap-4 p-6">
          <h1 className="text-xl font-semibold">{title}</h1>
          {children}
        </div>
      </MacWindow>
    </main>
  );
}

function Field({ id, label, hint, ...props }: React.ComponentProps<"input"> & { id: string; label: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} aria-describedby={hint ? `${id}-hint` : undefined} {...props} />
      {hint && (
        <p id={`${id}-hint`} className="text-[11px] text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  const t = useTranslations("common");
  return (
    <Button type="submit" size="lg" disabled={pending} className="mt-1 w-full">
      {pending ? <Spinner label={t("loading")} /> : children}
    </Button>
  );
}

/** Runs a submit, keeping the pending flag and the last failure. */
function useSubmit(onNext: (next: AuthNext) => void) {
  const [pending, setPending] = React.useState(false);
  const [failure, setFailure] = React.useState<AuthFailure | null>(null);
  const run = async (request: () => Promise<AuthResponse>) => {
    setPending(true);
    setFailure(null);
    try {
      const response = await request();
      if (isFailure(response)) setFailure(response);
      else onNext(response);
    } catch {
      setFailure({ error: "unavailable" });
    } finally {
      setPending(false);
    }
  };
  return { pending, failure, setFailure, run };
}

export function SignInForm({
  client,
  onDone,
  onVerify,
  signUpLink,
}: {
  client: AuthClient;
  onDone: () => void;
  onVerify: (email: string) => void;
  signUpLink: React.ReactNode;
}) {
  const t = useTranslations("auth");
  const { pending, failure, run } = useSubmit((next) => (next.next === "app" ? onDone() : onVerify(next.email)));
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        void run(() => client.signIn({ email: String(data.get("email")), password: String(data.get("password")) }));
      }}
    >
      <ErrorMessage failure={failure} />
      <Field id="email" label={t("fields.email")} type="email" autoComplete="email" required autoFocus />
      <Field id="password" label={t("fields.password")} type="password" autoComplete="current-password" required />
      <SubmitButton pending={pending}>{t("signIn.submit")}</SubmitButton>
      <p className="text-center text-[12px] text-muted-foreground">
        {t("signIn.noAccount")} {signUpLink}
      </p>
    </form>
  );
}

export function SignUpForm({
  client,
  onDone,
  onVerify,
  signInLink,
}: {
  client: AuthClient;
  onDone: () => void;
  onVerify: (email: string) => void;
  signInLink: React.ReactNode;
}) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const { pending, failure, setFailure, run } = useSubmit((next) => (next.next === "app" ? onDone() : onVerify(next.email)));
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const input = {
          name: String(data.get("name")),
          email: String(data.get("email")),
          password: String(data.get("password")),
          locale,
        };
        // Same rules as the server, checked first to save a round trip.
        const problem = passwordProblem(input.password, input.email);
        if (problem) return setFailure({ error: problem });
        void run(() => client.signUp(input));
      }}
    >
      <ErrorMessage failure={failure} />
      <Field id="name" label={t("fields.name")} autoComplete="name" required autoFocus maxLength={100} />
      <Field id="email" label={t("fields.email")} type="email" autoComplete="email" required />
      <Field
        id="password"
        label={t("fields.password")}
        type="password"
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN}
        maxLength={PASSWORD_MAX}
        hint={t("signUp.passwordHint", { min: PASSWORD_MIN })}
      />
      <SubmitButton pending={pending}>{t("signUp.submit")}</SubmitButton>
      <p className="text-center text-[12px] text-muted-foreground">
        {t("signUp.haveAccount")} {signInLink}
      </p>
    </form>
  );
}

export function VerifyEmailForm({
  client,
  email,
  onDone,
  onBack,
  showDevHint,
}: {
  client: AuthClient;
  email: string;
  onDone: () => void;
  onBack: () => void;
  showDevHint?: boolean;
}) {
  const t = useTranslations("auth.verify");
  const tFields = useTranslations("auth.fields");
  const [resent, setResent] = React.useState(false);
  const { pending, failure, run } = useSubmit((next) => next.next === "app" && onDone());
  const resend = useSubmit(() => setResent(true));
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const code = String(new FormData(event.currentTarget).get("code"));
        void run(() => client.verifyEmail({ email, code }));
      }}
    >
      <MailCheckIcon className="size-8 text-primary" aria-hidden />
      <p className="text-[13px] text-muted-foreground">{t("body", { email, length: OTP_LENGTH })}</p>
      {showDevHint && <p className="text-[11px] text-muted-foreground">{t("devHint")}</p>}
      <ErrorMessage failure={failure ?? resend.failure} />
      <Field
        id="code"
        label={tFields("code")}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern={`\\d{${OTP_LENGTH}}`}
        maxLength={OTP_LENGTH}
        required
        autoFocus
        className="text-center font-mono text-lg tracking-[0.4em]"
      />
      <SubmitButton pending={pending}>{t("submit")}</SubmitButton>
      {resent && (
        <p role="status" className="text-[12px] text-muted-foreground">
          {t("resent")}
        </p>
      )}
      <div className="flex justify-between">
        <Button type="button" variant="link" size="sm" className="px-0" onClick={onBack}>
          {t("back")}
        </Button>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="px-0"
          disabled={resend.pending}
          onClick={() => void resend.run(() => client.resendCode({ email }))}
        >
          {t("resend")}
        </Button>
      </div>
    </form>
  );
}
