import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import ts from "typescript";
import { accounts, agentConnections, auditLogs, categories, creditCards, recurrences, transactionLinks, transactions, users, wallets, walletMembers } from "@packages/shared/db/schema";

const require = createRequire(new URL("../package.json", import.meta.url));
const id = (n: number) => "00000000-0000-4000-8000-" + String(n).padStart(12, "0");

test("agent HTTP access follows plan, connection scope and live wallet role", async () => {
  const pg = new PGlite();
  try {
    const dir = path.resolve(import.meta.dirname, "../../../packages/shared/drizzle");
    for (const file of fs.readdirSync(dir).filter(file => file.endsWith(".sql")).sort()) {
      await pg.exec(fs.readFileSync(path.join(dir, file), "utf8"));
    }
    const db = drizzle(pg);
    const transact = db.transaction.bind(db);
    // Adapt raw result rows to postgres-js, as used by the shared audit writer.
    db.transaction = ((callback: Parameters<typeof transact>[0], config: Parameters<typeof transact>[1]) =>
      transact(async tx => {
        const execute = tx.execute.bind(tx);
        tx.execute = (async (...args: Parameters<typeof execute>) => (await execute(...args)).rows) as unknown as typeof execute;
        return callback(tx);
      }, config)) as typeof transact;

    let signedInUser: string | null = id(1);
    const cache = new Map<string, { exports: unknown }>();
    function load(file: string): any {
      file = path.resolve(import.meta.dirname, "..", file);
      if (cache.has(file)) return cache.get(file)!.exports;
      const mod = { exports: {} };
      cache.set(file, mod);
      const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
      }).outputText;
      const localRequire = (name: string) => {
        if (name === "server-only") return {};
        if (name === "@/lib/server/db" || name === "./db") return { getDb: () => db };
        if (name === "@/lib/server/auth/session") return {
          getSession: async () => signedInUser && { user: { id: signedInUser }, deviceId: null },
        };
        if (name === "@packages/env/server") return { env: { DATABASE_URL: "postgres://unused" } };
        if (name === "@packages/env/client") return { clientEnv: { NEXT_PUBLIC_APP_URL: "http://localhost:3000" } };
        if (name.startsWith("@/")) return load(name.slice(2) + ".ts");
        if (name.startsWith(".")) return load(path.resolve(path.dirname(file), name + ".ts"));
        return require(name);
      };
      vm.runInThisContext("(function(require,module,exports){" + code + "\n})", { filename: file })(localRequire, mod, mod.exports);
      return mod.exports;
    }

    await db.insert(users).values([
      { id: id(1), name: "Synthetic user", email: "agent@example.invalid" },
      { id: id(2), name: "Another user", email: "other@example.invalid" },
    ]);
    await db.insert(wallets).values([
      { id: id(3), name: "Allowed wallet", currencyCode: "EUR" },
      { id: id(4), name: "Unlisted wallet", currencyCode: "BRL" },
    ]);
    await db.insert(walletMembers).values([
      { id: id(5), walletId: id(3), userId: id(1), role: "EDITOR" },
      { id: id(6), walletId: id(4), userId: id(1), role: "OWNER" },
    ]);
    await db.insert(accounts).values([
      { id: id(10), walletId: id(3), name: "Payment", type: "CASH" },
      { id: id(12), walletId: id(3), name: "Savings", type: "SAVINGS" },
      { id: id(13), walletId: id(4), name: "Foreign account", type: "CASH" },
    ]);
    await db.insert(creditCards).values({
      id: id(11), walletId: id(3), paymentAccountId: id(10), name: "Card", brand: "VISA", closingDay: 15, dueDay: 5,
    });
    const categoryRows = await db.select().from(categories);
    const category = categoryRows.find(row => row.kind === "EXPENSE")!;
    const incomeCategory = categoryRows.find(row => row.kind === "INCOME")!;
    const manage = load("app/api/integrations/route.ts");
    const revoke = load("app/api/integrations/[id]/revoke/route.ts").POST;
    const discover = load("app/api/agent/v1/wallets/route.ts").GET;
    const invoices = load("app/api/agent/v1/wallets/[id]/invoices/route.ts").GET;
    const targets = load("app/api/agent/v1/wallets/[id]/purchase-targets/route.ts").GET;
    const purchase = load("app/api/agent/v1/wallets/[id]/cards/[cardId]/purchases/route.ts").POST;
    const entries = load("app/api/agent/v1/wallets/[id]/entries/route.ts");
    const ctx = (walletId = id(3), cardId = id(11)) => ({ params: Promise.resolve({ id: walletId, cardId }) });
    const managementRequest = (value: unknown, origin = "http://localhost:3000") =>
      new Request("http://localhost:3000/api/integrations", { method: "POST", headers: { Origin: origin }, body: JSON.stringify(value) });
    const agentRequest = (token?: string, value?: unknown) => new Request("https://finfy.example.invalid/api/agent/v1/wallets", {
      headers: token ? { Authorization: "Bearer " + token } : undefined,
      ...(value === undefined ? {} : { method: "POST", body: JSON.stringify(value) }),
    });
    const connectionInput = { name: "Synthetic agent", walletIds: [id(3)], scopes: ["invoices:read", "purchases:create"] };
    const setPlan = (plan: string) => pg.query("update users set plan=$1 where id=$2", [plan, id(1)]);
    const expectStatus = async (response: Promise<Response>, status: number) => {
      const result = await response;
      assert.equal(result.status, status, status !== result.status ? await result.text() : undefined);
      return result;
    };

    assert.equal((await (await manage.GET()).json()).plan, "FREE");
    assert.equal((await manage.POST(managementRequest(connectionInput))).status, 403);
    await setPlan("PAID");
    assert.equal((await manage.POST(managementRequest(connectionInput, "https://other.example.invalid"))).status, 403);
    const created = await expectStatus(manage.POST(managementRequest(connectionInput)), 201);
    assert.equal(created.headers.get("Cache-Control"), "no-store");
    const connection = await created.json();
    const { token } = connection;
    const [stored] = await db.select().from(agentConnections);
    assert.equal(stored.tokenHash, createHash("sha256").update(token).digest("hex"));
    assert.deepEqual(await (await manage.GET()).json(), {
      plan: "PAID", connections: [{ ...connectionInput, id: connection.id, revoked: false }],
    });
    const readOnly = await (await expectStatus(manage.POST(managementRequest({
      ...connectionInput, scopes: ["invoices:read"],
    })), 201)).json();
    for (const scope of ["purchases:create", "entries:create"]) {
      await expectStatus(manage.POST(managementRequest({ ...connectionInput, scopes: [scope] })), 400);
    }
    const writer = await (await expectStatus(manage.POST(managementRequest({
      ...connectionInput, scopes: ["invoices:read", "entries:create"],
    })), 201)).json();
    const writeOnly = await (await expectStatus(manage.POST(managementRequest(connectionInput)), 201)).json();
    await pg.query("update agent_connections set scopes=ARRAY['purchases:create'] where id=$1", [writeOnly.id]);
    assert.deepEqual(await (await discover(agentRequest(writeOnly.token))).json(), []);

    assert.equal((await discover(agentRequest())).status, 401);
    assert.equal((await discover(agentRequest("finfy_agent_" + "X".repeat(43)))).status, 401);
    assert.deepEqual(await (await discover(agentRequest(token))).json(), [{
      id: id(3), name: "Allowed wallet", currencyCode: "EUR", scopes: connectionInput.scopes,
    }]);
    await expectStatus(invoices(agentRequest(token), ctx(id(4))), 403);
    await expectStatus(invoices(agentRequest(writeOnly.token), ctx()), 403);
    await expectStatus(targets(agentRequest(readOnly.token), ctx()), 403);
    await expectStatus(targets(agentRequest(writeOnly.token), ctx()), 403);
    assert.deepEqual((await (await targets(agentRequest(token), ctx())).json()).cards, [{ id: id(11), name: "Card" }]);

    const date = new Date().toISOString().slice(0, 10);
    const input = { requestId: id(20), description: "Synthetic purchase", categoryId: category.id,
      amountMinor: 1234, currencyCode: "EUR", transactionDate: date };
    const submit = (token: string, body: unknown = input, target = ctx()) => purchase(agentRequest(token, body), target);
    await expectStatus(submit(readOnly.token), 403);
    await expectStatus(submit(token, { ...input, installments: 2 }), 400);
    await expectStatus(submit(token, { ...input, currencyCode: "BRL" }), 400);
    await expectStatus(submit(token, input, ctx(id(3), id(99))), 404);
    assert.equal((await db.select().from(transactions)).length, 0);

    const responses = await Promise.all([expectStatus(submit(token), 201), expectStatus(submit(token), 201)]);
    const [receipt, retried] = await Promise.all(responses.map(response => response.json()));
    assert.deepEqual(retried, receipt);
    await expectStatus(submit(token, { ...input, amountMinor: 100 }), 409);
    const [entry] = await db.select().from(transactions);
    assert.equal((await db.select().from(transactions)).length, 1);
    assert.equal(entry.id, receipt.purchaseId);
    assert.equal(entry.invoiceId, receipt.invoiceId);
    assert.equal(entry.installmentGroupId, null);
    const audit = (await db.select().from(auditLogs)).find(row => row.entityId === entry.id);
    assert.equal(audit?.sourceRefId, connection.id);
    const [{ nextInvoice }] = await (await invoices(agentRequest(readOnly.token), ctx())).json();
    assert.equal(nextInvoice.totalMinor, 1234);

    // The read+write grant exposes only IDs and labels needed to create entries.
    await expectStatus(entries.GET(agentRequest(readOnly.token), ctx()), 403);
    await expectStatus(entries.GET(agentRequest(writer.token), ctx(id(4))), 403);
    const entryTargets = await (await expectStatus(entries.GET(agentRequest(writer.token), ctx()), 200)).json();
    assert.deepEqual(entryTargets.accounts, [{ id: id(10), name: "Payment" }, { id: id(12), name: "Savings" }]);
    assert.ok(entryTargets.categories.some((target: { id: string }) => target.id === incomeCategory.id));
    await expectStatus(invoices(agentRequest(writer.token), ctx()), 200);
    const common = { description: "Synthetic entry", amountMinor: 300, currencyCode: "EUR" };
    const expense = { ...common, kind: "entry", type: "EXPENSE", requestId: id(31), accountId: id(10),
      categoryId: category.id, status: "PENDING", transactionDate: date };
    const postEntry = (body: unknown, credential = writer.token) => entries.POST(agentRequest(credential, body), ctx());
    const createEntry = async (body: unknown) => (await expectStatus(postEntry(body), 201)).json();
    await expectStatus(postEntry(expense, token), 403);
    await expectStatus(postEntry(expense, readOnly.token), 403);
    await expectStatus(postEntry(expense, writeOnly.token), 403);
    await expectStatus(postEntry({ ...expense, accountId: id(13) }), 400);
    await expectStatus(postEntry({ ...expense, currencyCode: "BRL" }), 400);
    const [expenseReceipt, duplicateExpense] = await Promise.all([createEntry(expense), createEntry(expense)]);
    assert.deepEqual(duplicateExpense, expenseReceipt);
    await expectStatus(postEntry({ ...expense, amountMinor: 301 }), 409);
    const incomeReceipt = await createEntry({ ...expense, requestId: id(32), type: "INCOME", status: "PAID", categoryId: incomeCategory.id });

    const transfer = { ...common, kind: "transfer", requestId: id(33), fromAccountId: id(10), toAccountId: id(12),
      status: "PENDING", transactionDate: date };
    await expectStatus(postEntry({ ...transfer, toAccountId: id(10) }), 400);
    const transferReceipt = await createEntry(transfer);
    assert.deepEqual(await createEntry(transfer), transferReceipt);
    const [link] = await db.select().from(transactionLinks);
    assert.deepEqual(transferReceipt.ids, [link.sourceTransactionId, link.targetTransactionId]);

    const cardPurchase = { ...common, kind: "purchase", requestId: id(34), cardId: id(11), categoryId: category.id,
      transactionDate: date, installments: 3 };
    const installmentReceipt = await createEntry(cardPurchase);
    assert.equal(installmentReceipt.ids.length, 3);
    assert.deepEqual(await createEntry(cardPurchase), installmentReceipt);
    const singleReceipt = await createEntry({ ...cardPurchase, requestId: id(38), installments: 1 });
    assert.equal(singleReceipt.ids.length, 1);

    const recurrence = { ...common, kind: "recurrence", requestId: id(35), type: "EXPENSE", accountId: id(10),
      categoryId: category.id, frequency: "MONTHLY", startDate: date, endDate: date, firstPaid: true };
    await expectStatus(postEntry({ ...recurrence, fromEntryId: expenseReceipt.ids[0] }), 400);
    await expectStatus(postEntry({ ...recurrence, creditCardId: id(11) }), 400);
    const accountSchedule = await createEntry(recurrence);
    const cardSchedule = await createEntry({ ...recurrence, requestId: id(36), accountId: null, creditCardId: id(11), firstPaid: false });
    const recurringIncome = await createEntry({ ...recurrence, requestId: id(37), type: "INCOME", categoryId: incomeCategory.id, endDate: null });
    assert.deepEqual(await createEntry(recurrence), accountSchedule);
    assert.equal((await db.select().from(recurrences)).length, 3);
    const walletEntries = await db.select().from(transactions);
    assert.equal(walletEntries.find(row => row.id === expenseReceipt.ids[0])?.status, "PENDING");
    assert.equal(walletEntries.find(row => row.id === incomeReceipt.ids[0])?.status, "PAID");
    assert.equal(walletEntries.find(row => row.recurrenceId === accountSchedule.ids[0])?.status, "PAID");
    assert.ok(walletEntries.find(row => row.recurrenceId === cardSchedule.ids[0])?.invoiceId);
    assert.equal(walletEntries.find(row => row.recurrenceId === recurringIncome.ids[0])?.type, "INCOME");
    const auditRows = await db.select().from(auditLogs);
    for (const receipt of [expenseReceipt, incomeReceipt, transferReceipt, installmentReceipt, singleReceipt, accountSchedule, cardSchedule, recurringIncome]) {
      for (const entityId of receipt.ids) {
        assert.equal(auditRows.find(row => row.entityId === entityId)?.sourceRefId, writer.id);
      }
    }

    await pg.query("update wallet_members set role='VIEWER' where id=$1", [id(5)]);
    await expectStatus(submit(token), 403);
    await expectStatus(postEntry(expense), 403);
    await expectStatus(invoices(agentRequest(token), ctx()), 200);
    await pg.query("update wallet_members set removed_at=now() where id=$1", [id(5)]);
    await expectStatus(invoices(agentRequest(token), ctx()), 404);
    assert.deepEqual(await (await discover(agentRequest(token))).json(), []);
    await setPlan("FREE");
    await expectStatus(discover(agentRequest(token)), 403);
    await expectStatus(submit(token), 403);
    await expectStatus(postEntry(expense), 403);

    signedInUser = id(2);
    await expectStatus(revoke(managementRequest({}), ctx(connection.id)), 204);
    await expectStatus(discover(agentRequest(token)), 403);
    signedInUser = id(1);
    await expectStatus(revoke(managementRequest({}), ctx(connection.id)), 204);
    await expectStatus(revoke(managementRequest({}), ctx(writer.id)), 204);
    await setPlan("PAID");
    await expectStatus(postEntry(expense), 401);
    await expectStatus(discover(agentRequest(token)), 401);
    await expectStatus(submit(token), 401);
    signedInUser = null;
    await expectStatus(manage.GET(), 401);
  } finally {
    await pg.close();
  }
});
