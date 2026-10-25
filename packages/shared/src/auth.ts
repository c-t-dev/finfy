import { z } from "zod";
import { LOCALES } from "./i18n/locales";

/**
 * Auth inputs shared by the forms and the API (wiki/decisoes/0004). The server
 * runs the same schemas, plus the breached-password check, which needs the
 * network.
 */

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;
export const OTP_LENGTH = 6;

/** Stable codes the API returns; the client translates them (errors.auth.*). */
export const AUTH_ERRORS = [
  "invalidInput",
  "invalidCredentials",
  "rateLimited",
  "invalidCode",
  "passwordTooShort",
  "passwordTooLong",
  "passwordSameAsEmail",
  "passwordBreached",
  "unauthenticated",
  "forbiddenOrigin",
  "unavailable",
] as const;
export type AuthError = (typeof AUTH_ERRORS)[number];

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email());

/** Length rules only: no composition rules, by design (OWASP, decision 0004). */
export function passwordProblem(password: string, email: string): AuthError | null {
  if (password.length < PASSWORD_MIN) return "passwordTooShort";
  if (password.length > PASSWORD_MAX) return "passwordTooLong";
  if (password.trim().toLowerCase() === email.trim().toLowerCase()) return "passwordSameAsEmail";
  return null;
}

export const signUpInput = z.object({
  name: z.string().trim().min(1).max(100),
  email: emailSchema,
  password: z.string().max(PASSWORD_MAX * 4),
  locale: z.enum(LOCALES),
});
export type SignUpInput = z.infer<typeof signUpInput>;

export const signInInput = z.object({
  email: emailSchema,
  password: z.string().min(1).max(PASSWORD_MAX * 4),
});
export type SignInInput = z.infer<typeof signInInput>;

export const verifyEmailInput = z.object({
  email: emailSchema,
  code: z
    .string()
    .trim()
    .regex(new RegExp(`^\\d{${OTP_LENGTH}}$`)),
});
export type VerifyEmailInput = z.infer<typeof verifyEmailInput>;

export const resendCodeInput = z.object({ email: emailSchema });

/** What a successful sign-up, sign-in or resend tells the client to do next. */
export type AuthNext = { next: "verifyEmail"; email: string } | { next: "app" };

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  language: (typeof LOCALES)[number];
  emailVerified: boolean;
}
