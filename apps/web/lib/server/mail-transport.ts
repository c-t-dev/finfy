import "server-only";
import nodemailer from "nodemailer";
import { env } from "@packages/env/server";
import type { RenderedEmail } from "./mail-templates";

export interface MailMessage extends RenderedEmail { to: string }
/** Stable message identity across delivery attempts. */
export interface MailTransport {
  send(message: MailMessage, options: { idempotencyKey: string; signal: AbortSignal }): Promise<void>;
}

/** Captures messages in memory only. Never sends mail or writes codes to logs/disk. */
export function createDevelopmentMailTransport() {
  if (env.NODE_ENV === "production") throw new Error("development_mail_transport_disabled");
  const captured = new Map<string, MailMessage>();
  const transport: MailTransport = {
    async send(message, options) {
      options.signal.throwIfAborted();
      if (!captured.has(options.idempotencyKey)) captured.set(options.idempotencyKey, { ...message });
    },
  };
  return { transport, messages: () => [...captured.values()].map(message => ({ ...message })), clear: () => captured.clear() };
}

export function createSmtpMailTransport(): MailTransport {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD || !SMTP_FROM) {
    throw new Error("smtp_not_configured");
  }
  const secure = SMTP_PORT === 465;
  const client = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure,
    requireTLS: !secure,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    connectionTimeout: 4000,
    greetingTimeout: 4000,
    socketTimeout: 4000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  const domain = SMTP_FROM.split("@").at(-1);
  return {
    async send(message, { signal, idempotencyKey }) {
      signal.throwIfAborted();
      await client.sendMail({
        ...message,
        from: SMTP_FROM,
        messageId: "<" + idempotencyKey + "@" + domain + ">",
      });
    },
  };
}
