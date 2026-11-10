import "server-only";
import { env } from "@packages/env/server";
import type { RenderedEmail } from "./mail-templates";

export interface MailMessage extends RenderedEmail { to: string }
/** Providers must honor the stable idempotency key, including after ambiguous failures. */
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
