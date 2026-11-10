import "server-only";
import { and, asc, eq, notInArray, sql } from "drizzle-orm";
import { emailOutbox } from "@packages/shared/db/schema";
import type { getDb } from "./db";
import { hasLiveEmailOtp } from "./auth/otp";
import { renderEmail } from "./mail-templates";
import type { MailTransport } from "./mail-transport";

const MAX_ATTEMPTS = 3;
const SEND_TIMEOUT_MS = 5000;

/** Explicit worker entry point, with no route, scheduler or automatic activation. */
export async function deliverEmailOutbox(db: ReturnType<typeof getDb>, transport: MailTransport, batchSize = 10) {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 50) throw new Error("invalid_email_batch_size");
  const processed: string[] = [];
  const result = { sent: 0, retry: 0, discarded: 0 };
  for (let index = 0; index < batchSize; index++) {
    const outcome = await db.transaction(async tx => {
      const [row] = await tx.select().from(emailOutbox)
        .where(and(eq(emailOutbox.status, "PENDING"), processed.length ? notInArray(emailOutbox.id, processed) : undefined))
        .orderBy(asc(emailOutbox.createdAt), asc(emailOutbox.id)).for("update", { skipLocked: true }).limit(1);
      if (!row) return null;
      const attempts = Math.min(row.attempts + 1, MAX_ATTEMPTS);
      const discard = async (error: string) => {
        await tx.update(emailOutbox).set({ status: "FAILED", attempts, payload: {}, error }).where(eq(emailOutbox.id, row.id));
        return { id: row.id, state: "discarded" as const };
      };
      if (row.attempts >= MAX_ATTEMPTS) return discard("attempts_exhausted");
      let rendered;
      try { rendered = renderEmail(row.template, row.locale, row.payload); }
      catch { return discard("invalid_message"); }
      if (row.template === "verify-email" && !(await hasLiveEmailOtp(tx, row.toEmail, row.payload.code as string))) {
        return discard("code_unavailable");
      }
      try {
        // Bound time holding the row lock; adapters must also honor cancellation.
        const controller = new AbortController();
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            controller.abort();
            reject(new Error("delivery_timeout"));
          }, SEND_TIMEOUT_MS);
          Promise.resolve().then(() => transport.send({ ...rendered, to: row.toEmail }, {
            idempotencyKey: `finfy-email-${row.id}`, signal: controller.signal,
          })).then(resolve, reject).finally(() => clearTimeout(timeout));
        });
      } catch {
        const terminal = attempts >= MAX_ATTEMPTS;
        await tx.update(emailOutbox).set({ attempts, status: terminal ? "FAILED" : "PENDING",
          payload: terminal ? {} : row.payload, error: "delivery_failed" }).where(eq(emailOutbox.id, row.id));
        return { id: row.id, state: terminal ? "discarded" as const : "retry" as const };
      }
      await tx.update(emailOutbox).set({ status: "SENT", attempts, sentAt: sql`now()`, error: null, payload: {} })
        .where(eq(emailOutbox.id, row.id));
      return { id: row.id, state: "sent" as const };
    });
    if (!outcome) break;
    processed.push(outcome.id);
    result[outcome.state]++;
  }
  return result;
}
