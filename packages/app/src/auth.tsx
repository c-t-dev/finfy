"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
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
import { ScreenTransition } from "./screen-transition";
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
  signUp(input: { name: string; email: string; password: string; locale: string; inviteCode?: string }): Promise<AuthResponse>;
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

export function ErrorMessage({ failure }: { failure: AuthFailure | null }) {
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
export function AuthWindow({ title, children, trailing, overlay = false, minimized = false, onMinimizedChange }: {
  title: string;
  children: React.ReactNode;
  trailing?: React.ReactNode;
  overlay?: boolean;
  minimized?: boolean;
  onMinimizedChange?: (minimized: boolean) => void;
}) {
  const t = useTranslations("common");
  const reduceMotion = useReducedMotion();
  const restoreRef = React.useRef<HTMLButtonElement>(null);
  const windowRef = React.useRef<HTMLDivElement>(null);
  const wasMinimized = React.useRef(minimized);
  React.useEffect(() => {
    if (wasMinimized.current && !minimized) windowRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    wasMinimized.current = minimized;
  }, [minimized]);
  const minimize = () => {
    onMinimizedChange?.(true);
    requestAnimationFrame(() => restoreRef.current?.focus());
  };
  const restore = () => {
    onMinimizedChange?.(false);
  };
  return (
    <>
      {overlay && <motion.div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-30 bg-black/20 backdrop-blur-sm motion-reduce:transition-none"
        initial={false}
        animate={{ opacity: minimized ? 0 : 1 }}
        transition={{ duration: reduceMotion === false ? 0.25 : 0.12 }}
      />}
      <div className={overlay ? "pointer-events-none fixed inset-0 z-40 flex items-center justify-center overflow-y-auto p-4" : "flex flex-1 items-center justify-center p-4"}>
      <motion.div
        ref={windowRef}
        inert={minimized}
        aria-hidden={minimized}
        className="w-full max-w-sm"
        style={{ pointerEvents: minimized ? "none" : "auto", transformOrigin: "bottom center" }}
        animate={{ opacity: minimized ? 0 : 1, y: minimized && reduceMotion === false ? "40vh" : 0, scale: minimized && reduceMotion === false ? 0.15 : 1 }}
        transition={{ duration: reduceMotion === false ? 0.35 : 0.12, ease: "easeInOut" }}
      >
      <ScreenTransition transitionKey={title} emphasis="window" className="w-full max-w-sm">
        <MacWindow className="w-full rounded-xl border border-border">
          <MacTitlebar icon={<AppIcon />} title={t("appName")} trailing={trailing} className="static" trafficLights={overlay ? { onMinimize: minimize, labels: { minimize: t("window.minimize") } } : undefined} />
          <div className="flex flex-col gap-4 p-6">
            <h1 className="text-xl font-semibold">{title}</h1>
            {children}
          </div>
        </MacWindow>
      </ScreenTransition>
      </motion.div>
      </div>
      {minimized && <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
        <div className="flex items-center gap-4 rounded-xl border border-border bg-window px-4 py-3 shadow-lg backdrop-blur-2xl">
          <AppIcon /><span className="text-[13px] font-medium">{title}</span>
          <button ref={restoreRef} type="button" onClick={restore} aria-label={t("window.restore")} title={t("window.restore")} className="flex size-6 items-center justify-center rounded-full bg-[#28c840] text-black focus-visible:outline-2 focus-visible:outline-ring">+</button>
        </div>
      </div>}
    </>
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
  inviteCode = null,
}: {
  client: AuthClient;
  onDone: () => void;
  onVerify: (email: string) => void;
  signInLink: React.ReactNode;
  /** Shows the invite code field: needed while sign-up is closed, prefilled from an invite link. */
  inviteCode?: { required: boolean; value: string } | null;
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
          ...(inviteCode && data.get("inviteCode") ? { inviteCode: String(data.get("inviteCode")) } : {}),
        };
        // Same rules as the server, checked first to save a round trip.
        const problem = passwordProblem(input.password, input.email);
        if (problem) return setFailure({ error: problem });
        void run(() => client.signUp(input));
      }}
    >
      <ErrorMessage failure={failure} />
      {inviteCode && (
        <Field
          id="inviteCode"
          label={t("fields.inviteCode")}
          defaultValue={inviteCode.value}
          required={inviteCode.required}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={40}
          className="font-mono uppercase"
          hint={t("signUp.inviteCodeHint")}
        />
      )}
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
