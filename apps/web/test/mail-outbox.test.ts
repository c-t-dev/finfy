import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { createHmac } from "node:crypto";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { emailOutbox, otpCodes } from "@packages/shared/db/schema";
import { renderEmail } from "../lib/server/mail-templates";

const require = createRequire(import.meta.url);

test("OTP email preparation remains local and processes the outbox safely", async (t) => {
  const pg = new PGlite();
  const db = drizzle(pg);
  const directory = path.resolve(import.meta.dirname, "../../../packages/shared/drizzle");
  for (const file of fs.readdirSync(directory).filter(name => name.endsWith(".sql")).sort()) {
    await pg.exec(fs.readFileSync(path.join(directory, file), "utf8"));
  }
  const environment = { NODE_ENV: "test" };
  const cache = new Map<string, { exports: any }>();
  function load(file: string): any {
    file = path.resolve(import.meta.dirname, "..", file);
    if (cache.has(file)) return cache.get(file)!.exports;
    const module = { exports: {} };
    cache.set(file, module);
    const localRequire = (name: string): any => {
      if (name === "server-only") return {};
      if (name === "@packages/env/server") return { env: environment };
      if (name === "./password") return { hmacSecret: (value: string) => createHmac("sha256", "synthetic-test-pepper").update(value).digest("base64url") };
      if (name.startsWith("@/")) return load(name.slice(2) + ".ts");
      if (name.startsWith(".")) return load(path.resolve(path.dirname(file), name + ".ts"));
      return require(name);
    };
    const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    vm.runInThisContext("(function(require,module,exports){" + code + "\n})", { filename: file })(localRequire, module, module.exports);
    return module.exports;
  }
  const mail = load("lib/server/mail.ts");
  const otp = load("lib/server/auth/otp.ts");
  const { deliverEmailOutbox } = load("lib/server/mail-outbox.ts");
  const { createDevelopmentMailTransport } = load("lib/server/mail-transport.ts");
  const local = createDevelopmentMailTransport();
  const clear = async () => { await db.delete(emailOutbox); await db.delete(otpCodes); local.clear(); };
  const queue = async (email = "synthetic@example.invalid", locale = "en") => {
    const code = await otp.issueOtp(db, { email, userId: null, purpose: "EMAIL_VERIFY" });
    await mail.queueEmail(db, { to: email, template: "verify-email", locale, payload: { code } });
    return { email, code, purpose: "EMAIL_VERIFY" };
  };
  try {
    await t.test("queue, bilingual render, local capture and OTP verification work together", async () => {
      const first = await queue();
      await queue("synthetic-pt@example.invalid", "pt-BR");
      assert.deepEqual(await deliverEmailOutbox(db, local.transport), { sent: 2, retry: 0, discarded: 0 });
      assert.match(local.messages()[0].subject, /Verify/);
      assert.match(local.messages()[1].subject, /Confirme/);
      for (const row of await db.select().from(emailOutbox)) {
        assert.equal(row.status, "SENT"); assert.deepEqual(row.payload, {}); assert.equal(row.error, null);
      }
      assert.equal(await otp.consumeOtp(db, first), true);
      assert.equal(await otp.consumeOtp(db, first), false);
      assert.equal((await deliverEmailOutbox(db, local.transport)).sent, 0);
    });
    await t.test("superseded, expired and invalid messages are discarded and scrubbed", async () => {
      await clear();
      await queue();
      await queue();
      const expired = await queue("expired@example.invalid");
      await pg.query("update otp_codes set expires_at=now()-interval '1 second' where email=$1", [expired.email]);
      await mail.queueEmail(db, { to: "invalid@example.invalid", template: "verify-email", locale: "en", payload: { code: "<script>synthetic</script>" } });
      assert.deepEqual(await deliverEmailOutbox(db, local.transport), { sent: 1, retry: 0, discarded: 3 });
      assert.equal(local.messages().length, 1);
      for (const row of await db.select().from(emailOutbox)) assert.deepEqual(row.payload, {});
      assert.throws(() => renderEmail("verify-email", "en", { code: "<b>123456</b>" }));
      assert.throws(() => renderEmail("unknown", "en", {}));
    });
    await t.test("delivery failure retries once per batch, caps attempts and never stores provider secrets", async () => {
      await clear(); await queue();
      const failing = { send: async () => { throw new Error("synthetic private provider detail"); } };
      assert.deepEqual(await deliverEmailOutbox(db, failing), { sent: 0, retry: 1, discarded: 0 });
      assert.equal((await db.select().from(emailOutbox))[0].attempts, 1);
      await deliverEmailOutbox(db, failing);
      assert.deepEqual(await deliverEmailOutbox(db, failing), { sent: 0, retry: 0, discarded: 1 });
      const [row] = await db.select().from(emailOutbox);
      assert.equal(row.status, "FAILED"); assert.equal(row.attempts, 3); assert.equal(row.error, "delivery_failed"); assert.deepEqual(row.payload, {});
    });
    await t.test("ambiguous sends reuse the same idempotency key", async () => {
      await clear(); await queue(); let first = true; const keys: string[] = [];
      const ambiguous = { send: async (message: any, options: any) => {
        keys.push(options.idempotencyKey); await local.transport.send(message, options);
        if (first) { first = false; throw new Error("synthetic unknown delivery outcome"); }
      } };
      await deliverEmailOutbox(db, ambiguous);
      assert.equal((await deliverEmailOutbox(db, ambiguous)).sent, 1);
      assert.equal(keys[0], keys[1]); assert.equal(local.messages().length, 1);
    });
    await t.test("workers do not send a completed row twice", async () => {
      await clear(); await queue();
      const results = await Promise.all([deliverEmailOutbox(db, local.transport), deliverEmailOutbox(db, local.transport)]);
      assert.equal(results.reduce((sum, row) => sum + row.sent, 0), 1);
      assert.equal(local.messages().length, 1);
    });
    await t.test("failed database commit can be retried with the same delivery key", async () => {
      await clear(); await queue();
      await pg.exec(`create function reject_sent_email() returns trigger language plpgsql as $$
        begin if NEW.status='SENT' then raise exception 'synthetic write failure'; end if; return NEW; end $$;
        create trigger reject_sent_email before update on email_outbox for each row execute function reject_sent_email();`);
      await assert.rejects(deliverEmailOutbox(db, local.transport));
      assert.equal((await db.select().from(emailOutbox))[0].status, "PENDING");
      await pg.exec("drop trigger reject_sent_email on email_outbox; drop function reject_sent_email()");
      assert.equal((await deliverEmailOutbox(db, local.transport)).sent, 1);
      assert.equal(local.messages().length, 1);
    });
    await t.test("a stalled provider is cancelled and leaves a retryable row", async () => {
      await clear(); await queue(); let signal: AbortSignal | undefined;
      const stalled = { send: (_message: unknown, options: { signal: AbortSignal }) => {
        signal = options.signal; return new Promise<void>(() => {});
      } };
      assert.deepEqual(await deliverEmailOutbox(db, stalled), { sent: 0, retry: 1, discarded: 0 });
      assert.equal(signal?.aborted, true);
      assert.equal((await db.select().from(emailOutbox))[0].status, "PENDING");
    });
    await t.test("production stays disabled and development transport cannot be created in production", async () => {
      assert.equal(mail.EMAIL_DELIVERY_ENABLED, false);
      environment.NODE_ENV = "production";
      assert.throws(createDevelopmentMailTransport, /development_mail_transport_disabled/);
      environment.NODE_ENV = "test";
      await assert.rejects(deliverEmailOutbox(db, local.transport, 100));
    });
  } finally { await pg.close(); }
});
