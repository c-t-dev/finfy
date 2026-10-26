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
  "emailTaken",
  "rateLimited",
  "invalidCode",
  "passwordTooShort",
  "passwordTooLong",
  "passwordSameAsEmail",
  "passwordBreached",
  "unauthenticated",
  "forbiddenOrigin",
  "unavailable",
  "inviteCodeRequired",
  "inviteCodeInvalid",
  "tooManyInvites",
  "notFound",
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
  /** Needed while sign-up is closed (`SIGN_UP_MODE=invite`); see ./signup-invites. */
  inviteCode: z.string().trim().max(40).optional(),
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
export const authNextSchema = z.discriminatedUnion("next", [
  z.object({ next: z.literal("verifyEmail"), email: z.string() }),
  z.object({ next: z.literal("app") }),
]);
export type AuthNext = z.infer<typeof authNextSchema>;

export const currentUserSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.string(),
  language: z.enum(LOCALES),
  emailVerified: z.boolean(),
});
export type CurrentUser = z.infer<typeof currentUserSchema>;

export const languageInput = z.object({ language: z.enum(LOCALES) });

export const profileInput = z.object({ name: z.string().trim().min(1).max(100) });
export type ProfileInput = z.infer<typeof profileInput>;

/** Changing the password asks for the current one; the other sessions end (wiki/decisoes/0004). */
export const changePasswordInput = z.object({
  currentPassword: z.string().min(1).max(PASSWORD_MAX * 4),
  newPassword: z.string().max(PASSWORD_MAX * 4),
});
export type ChangePasswordInput = z.infer<typeof changePasswordInput>;
