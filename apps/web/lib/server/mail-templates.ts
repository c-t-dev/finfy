import type { Locale } from "@packages/shared/i18n";
import { OTP_TTL_MINUTES } from "@packages/shared/auth";
import en from "@packages/shared/i18n/messages/en";
import ptBR from "@packages/shared/i18n/messages/pt-BR";

export type EmailTemplate = "verify-email" | "sign-up-existing-account";
export interface RenderedEmail { subject: string; text: string; html: string }
const messages = { en, "pt-BR": ptBR };
const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

/** Text-only substitutions; no recipient data or payload can inject HTML. */
export function renderEmail(template: string, locale: Locale, payload: Record<string, unknown>): RenderedEmail {
  const dictionary = messages[locale];
  if (!dictionary) throw new Error("invalid_email_locale");
  let subject: string, text: string;
  if (template === "verify-email") {
    if (typeof payload.code !== "string" || !/^\d{6}$/.test(payload.code)) throw new Error("invalid_email_payload");
    subject = dictionary.emails.verify.subject;
    text = dictionary.emails.verify.body.replace("{code}", payload.code).replace("{minutes}", String(OTP_TTL_MINUTES));
  } else if (template === "sign-up-existing-account") {
    subject = dictionary.emails.existing.subject;
    text = dictionary.emails.existing.body;
  } else {
    throw new Error("invalid_email_template");
  }
  return { subject, text, html: `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head><body><p>${escapeHtml(text).replaceAll("\n", "<br>")}</p></body></html>` };
}
