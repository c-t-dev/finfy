import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { AsyncLocalStorage } from "node:async_hooks";
import { createRequire } from "node:module";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { users, userCredentials, userSessions, otpCodes } from "@packages/shared/db/schema";

const require = createRequire(new URL("../package.json", import.meta.url));
const meta = { ip: "192.0.2.1", userAgent: null };
const oldPassword = "synthetic-old-password";
const newPassword = "synthetic-new-password";
const oldHash = "synthetic-old-hash";
const newHash = "synthetic-new-hash";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

async function fixture() {
  const pg = new PGlite();
  const directory = path.resolve(import.meta.dirname, "../../../packages/shared/drizzle");
  for (const file of fs.readdirSync(directory).filter((name) => name.endsWith(".sql")).sort()) {
    await pg.exec(fs.readFileSync(path.join(directory, file), "utf8"));
  }
  const db = drizzle(pg);
  const context = new AsyncLocalStorage<Map<string, string>>();
  const fallbackCookies = new Map<string, string>();
  const options = { rehash: false, beforeVerify: async () => {}, beforeHash: async (_password: string) => {} };
  const modules = new Map<string, { exports: any }>();
  // Load real server commands with an isolated database and request cookie context.
  // Password crypto is substituted only to control interleaving deterministically.
  function load(file: string): any {
    file = path.resolve(import.meta.dirname, "..", file);
    if (modules.has(file)) return modules.get(file)!.exports;
    const module = { exports: {} };
    modules.set(file, module);
    const localRequire = (name: string): any => {
      if (name === "server-only") return {};
      if (name === "@/lib/server/db") return { getDb: () => db };
      if (name === "@packages/env/server") return { env: { NODE_ENV: "test", DATABASE_URL: "postgres://unused", SIGN_UP_MODE: "open" } };
      if (name === "react") return { cache: (fn: unknown) => fn };
      if (name === "next/headers") return { cookies: async () => {
        const store = context.getStore() ?? fallbackCookies;
        return { get: (key: string) => store.has(key) ? { value: store.get(key) } : undefined,
          set: (key: string, value: string) => store.set(key, value), delete: (key: string) => store.delete(key) };
      } };
      if (name === "@/lib/server/auth/breached" || name === "./breached") return { isBreachedPassword: async () => false };
      if (name === "@/lib/server/auth/password" || name === "./password") return {
        verifyPassword: async (stored: { hash: string }, password: string) => {
          await options.beforeVerify();
          return { ok: (stored.hash === oldHash && password === oldPassword) || (stored.hash === newHash && password === newPassword), needsRehash: options.rehash };
        },
        hashPassword: async (password: string) => { await options.beforeHash(password); return { hash: password === newPassword ? newHash : "synthetic-rehashed-old", pepperVersion: 1 }; },
        verifyDummyPassword: async () => {}, hmacSecret: (value: string) => value,
      };
      if (name.startsWith("@/")) return load(name.slice(2) + ".ts");
      if (name.startsWith(".")) return load(path.resolve(path.dirname(file), name + ".ts"));
      return require(name);
    };
    const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInThisContext("(function(require,module,exports){" + code + "\n})", { filename: file })(localRequire, module, module.exports);
    return module.exports;
  }
  const [user] = await db.insert(users).values({ name: "Synthetic", email: "race@example.invalid" }).returning();
  await db.insert(userCredentials).values({ userId: user.id, passwordHash: oldHash, pepperVersion: 1 });
  return { pg, db, context, options, user, auth: load("lib/server/auth/service.ts"),
    account: load("lib/server/account.ts"), sessions: load("lib/server/auth/session.ts"), otp: load("lib/server/auth/otp.ts") };
}

for (const rehash of [false, true]) {
  test(`password change rejects an in-flight old login (rehash=${rehash})`, async () => {
    const f = await fixture();
    try {
      const owner = new Map<string, string>();
      const attacker = new Map<string, string>();
      await f.context.run(owner, () => f.sessions.startSession(f.user.id, meta));
      const entered = deferred(), release = deferred();
      let first = true;
      f.options.rehash = rehash;
      f.options.beforeVerify = async () => { if (first) { first = false; entered.resolve(); await release.promise; } };
      const login = f.context.run(attacker, () => f.auth.signIn({ email: f.user.email, password: oldPassword }, meta));
      await entered.promise;
      const changed = await f.context.run(owner, () => f.account.changePassword(f.user.id, f.user.email,
        { currentPassword: oldPassword, newPassword }, meta));
      assert.equal(changed.ok, true);
      release.resolve();
      assert.equal((await login).error, "invalidCredentials");
      assert.equal(attacker.size, 0);
      assert.equal((await f.db.select().from(userCredentials))[0].passwordHash, newHash);
      assert.equal((await f.db.select().from(userSessions)).length, 1);
      assert.equal(await f.context.run(attacker, () => f.sessions.getSession()), null);
      assert.equal((await f.context.run(owner, () => f.sessions.getSession())).user.id, f.user.id);
      f.options.rehash = false;
      assert.equal((await f.context.run(attacker, () => f.auth.signIn({ email: f.user.email, password: oldPassword }, meta))).error, "invalidCredentials");
      assert.equal((await f.context.run(attacker, () => f.auth.signIn({ email: f.user.email, password: newPassword }, meta))).ok, true);
    } finally { await f.pg.close(); }
  });
}

test("password change revokes a login that committed first and preserves its own session", async () => {
  const f = await fixture();
  try {
    const owner = new Map<string, string>(), other = new Map<string, string>();
    await f.context.run(owner, () => f.sessions.startSession(f.user.id, meta));
    assert.equal((await f.context.run(other, () => f.auth.signIn({ email: f.user.email, password: oldPassword }, meta))).ok, true);
    assert.equal((await f.context.run(owner, () => f.account.changePassword(f.user.id, f.user.email,
      { currentPassword: oldPassword, newPassword }, meta))).ok, true);
    assert.equal(await f.context.run(other, () => f.sessions.getSession()), null);
    assert.equal((await f.context.run(owner, () => f.sessions.getSession())).user.id, f.user.id);
  } finally { await f.pg.close(); }
});

test("concurrent password changes cannot overwrite a newly changed credential", async () => {
  const f = await fixture();
  try {
    await f.sessions.startSession(f.user.id, meta);
    const entered = deferred(), release = deferred(); let first = true;
    f.options.beforeHash = async () => { if (first) { first = false; entered.resolve(); await release.promise; } };
    const stale = f.account.changePassword(f.user.id, f.user.email, { currentPassword: oldPassword, newPassword: "synthetic-stale-change" }, meta);
    await entered.promise;
    assert.equal((await f.account.changePassword(f.user.id, f.user.email, { currentPassword: oldPassword, newPassword }, meta)).ok, true);
    release.resolve();
    assert.equal((await stale).error, "invalidCredentials");
    assert.equal((await f.db.select().from(userCredentials))[0].passwordHash, newHash);
  } finally { await f.pg.close(); }
});

test("OTP attempts are bounded, one-time and checked against current expiry", async () => {
  const f = await fixture();
  try {
    const input = { email: f.user.email, userId: f.user.id, purpose: "EMAIL_VERIFY" };
    const code = await f.otp.issueOtp(f.db, input);
    await f.pg.exec("update otp_codes set attempts=4");
    let readers = 0; const ready = deferred();
    const synchronizedDb = new Proxy(f.db, { get(target, key) {
      if (key !== "select") return Reflect.get(target, key);
      return (...args: any[]) => {
        const wrap = (q: any): any => new Proxy(q, { get(obj, prop) {
          if (prop === "then") return (resolve: any, reject: any) => Promise.resolve(obj).then(async (rows) => {
            if (++readers === 10) ready.resolve(); await ready.promise; return rows;
          }).then(resolve, reject);
          const value = Reflect.get(obj, prop);
          return typeof value === "function" ? (...xs: any[]) => wrap(value.apply(obj, xs)) : value;
        } });
        return wrap((target.select as any)(...args));
      };
    } });
    const wrong = code === "000000" ? "111111" : "000000";
    const results = await Promise.all(Array.from({ length: 10 }, () => f.otp.consumeOtp(synchronizedDb, { ...input, code: wrong })));
    assert.equal(results.some(Boolean), false);
    assert.equal((await f.db.select().from(otpCodes))[0].attempts, 5);
    assert.equal(await f.otp.consumeOtp(f.db, { ...input, code }), false);
    const fresh = await f.otp.issueOtp(f.db, input);
    const matches = await Promise.all(Array.from({ length: 10 }, () => f.otp.consumeOtp(f.db, { ...input, code: fresh })));
    assert.equal(matches.filter(Boolean).length, 1);
    const expired = await f.otp.issueOtp(f.db, input);
    await f.pg.exec("update otp_codes set expires_at=now() - interval '1 second'");
    assert.equal(await f.otp.consumeOtp(f.db, { ...input, code: expired }), false);
  } finally { await f.pg.close(); }
});

test("password replacement, revocation and audit roll back together", async () => {
  const f = await fixture();
  try {
    const owner = new Map<string, string>(), other = new Map<string, string>();
    await f.context.run(owner, () => f.sessions.startSession(f.user.id, meta));
    await f.context.run(other, () => f.sessions.startSession(f.user.id, meta));
    await f.pg.exec(`create function reject_password_event() returns trigger language plpgsql as $$
      begin if NEW.type = 'PASSWORD_CHANGED' then raise exception 'synthetic audit failure'; end if; return NEW; end $$;
      create trigger reject_password_event before insert on security_events for each row execute function reject_password_event();`);
    await assert.rejects(f.context.run(owner, () => f.account.changePassword(f.user.id, f.user.email,
      { currentPassword: oldPassword, newPassword }, meta)));
    assert.equal((await f.db.select().from(userCredentials))[0].passwordHash, oldHash);
    assert.equal((await f.context.run(other, () => f.sessions.getSession())).user.id, f.user.id);
  } finally { await f.pg.close(); }
});

test("failed login commit does not publish a session cookie or leave a session", async () => {
  const f = await fixture();
  try {
    const browser = new Map<string, string>();
    await f.pg.exec(`create function reject_login_event() returns trigger language plpgsql as $$
      begin if NEW.type = 'LOGIN' then raise exception 'synthetic audit failure'; end if; return NEW; end $$;
      create trigger reject_login_event before insert on security_events for each row execute function reject_login_event();`);
    await assert.rejects(f.context.run(browser, () => f.auth.signIn({ email: f.user.email, password: oldPassword }, meta)));
    assert.equal(browser.size, 0);
    assert.equal((await f.db.select().from(userSessions)).length, 0);
  } finally { await f.pg.close(); }
});
