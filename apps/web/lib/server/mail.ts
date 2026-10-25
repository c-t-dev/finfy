import "server-only";
import type { Locale } from "@packages/shared/i18n";
import { emailOutbox } from "@packages/shared/db/schema";
import { env } from "@packages/env/server";
import type { getDb } from "@/lib/server/db";

type Db = Pick<ReturnType<typeof getDb>, "insert">;

export type EmailTemplate = "verify-email" | "sign-up-existing-account";

/**
 * Queues an e-mail in `email_outbox`; a cron job sends it once a provider is
 * chosen (wiki/decisoes/0003). Until then, development prints it to the server
 * log so codes can be used locally. Payloads with codes are short-lived and
 * must be cleared after sending.
 */
export async function queueEmail(
  db: Db,
  email: { to: string; template: EmailTemplate; locale: Locale; payload: Record<string, unknown> },
): Promise<void> {
  await db.insert(emailOutbox).values({
    toEmail: email.to,
    template: email.template,
    locale: email.locale,
    payload: email.payload,
  });
  if (env.NODE_ENV === "development") {
    console.info(`[mail:dev] ${email.template} → ${email.to} (${email.locale})`, email.payload);
  }
}
