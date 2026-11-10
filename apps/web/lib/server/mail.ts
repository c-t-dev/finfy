import "server-only";
import type { Locale } from "@packages/shared/i18n";
import { emailOutbox } from "@packages/shared/db/schema";
import { env } from "@packages/env/server";
import type { getDb } from "@/lib/server/db";

type Db = Pick<ReturnType<typeof getDb>, "insert">;

import type { EmailTemplate } from "./mail-templates";
export type { EmailTemplate } from "./mail-templates";

export const EMAIL_DELIVERY_ENABLED =
  env.EMAIL_DELIVERY_ENABLED === "true" &&
  Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD && env.SMTP_FROM);

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
}
