import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { accounts, creditCards, creditCardInvoices, transactions, wallets } from "@packages/shared/db/schema";
import { entrySummarySchema, type EntryFilter } from "@packages/shared/transactions";
import { selectStatementRows, selectStatementTotals } from "../lib/server/entry-queries";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

test("statement totals execute on PostgreSQL with the real migrated schema", async () => {
  const pg = new PGlite();
  try {
    const directory = new URL("../../../packages/shared/drizzle/", import.meta.url);
    for (const file of (await readdir(directory)).filter(name => name.endsWith(".sql")).sort()) {
      await pg.exec(await readFile(new URL(file, directory), "utf8"));
    }
    const db = drizzle(pg);
    const walletId = id(1);
    const filter: EntryFilter = { from: "2026-10-01", to: "2026-10-31" };
    const totals = async (filters = filter) => {
      const [row] = await selectStatementTotals(db, walletId, filters);
      const numeric = Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value)]));
      return entrySummarySchema.parse({ ...numeric,
        accumulatedBalanceMinor: numeric.confirmedBalanceMinor + numeric.accumulatedPendingMinor });
    };
    // The actual Drizzle single-table SELECT failed even for an empty wallet.
    assert.equal((await totals()).accumulatedBalanceMinor, 0);
    await db.insert(wallets).values([{ id: walletId, name: "Synthetic wallet", currencyCode: "EUR" },
      { id: id(2), name: "Other synthetic wallet", currencyCode: "EUR" }]);
    await db.insert(accounts).values([
      { id: id(10), walletId, name: "Synthetic account A", type: "CHECKING", initialBalanceMinor: 10000 },
      { id: id(11), walletId, name: "Synthetic account B", type: "CASH", initialBalanceMinor: 5000 },
      { id: id(12), walletId: id(2), name: "Other account", type: "CASH", initialBalanceMinor: 90000 },
      { id: id(13), walletId, name: "Archived account", type: "CASH", initialBalanceMinor: 90000, archivedAt: new Date() },
    ]);
    await db.insert(creditCards).values({ id: id(20), walletId, name: "Synthetic card", paymentAccountId: id(10),
      brand: "VISA", closingDay: 15, dueDay: 5 });
    await db.insert(creditCardInvoices).values({ id: id(21), walletId, creditCardId: id(20), referenceYear: 2026,
      referenceMonth: 10, openingDate: "2026-09-16", closingDate: "2026-10-15", dueDate: "2026-11-05" });
    const common = { walletId, description: "Synthetic entry", transactionDate: "2026-10-06" };
    await db.insert(transactions).values([
      { ...common, id: id(30), accountId: id(10), type: "INCOME", status: "PAID", amountMinor: 2000, transactionDate: "2026-09-01" },
      { ...common, id: id(31), accountId: id(10), type: "EXPENSE", status: "PAID", amountMinor: 1000 },
      { ...common, id: id(32), accountId: id(10), type: "INCOME", status: "PENDING", amountMinor: 500 },
      { ...common, id: id(33), accountId: id(10), type: "TRANSFER_OUT", status: "PENDING", amountMinor: 700 },
      { ...common, id: id(34), accountId: id(11), type: "TRANSFER_IN", status: "PENDING", amountMinor: 700 },
      { ...common, id: id(35), creditCardId: id(20), invoiceId: id(21), type: "CREDIT_CARD_PURCHASE", status: "PENDING", amountMinor: 3000 },
      { ...common, id: id(36), walletId: id(2), accountId: id(12), type: "INCOME", status: "PAID", amountMinor: 90000 },
    ]);
    const october = await totals();
    assert.equal(october.confirmedBalanceMinor, 16000);
    assert.equal(october.accumulatedPendingMinor, 500);
    assert.equal(october.accumulatedBalanceMinor, 16500);
    assert.equal(october.expenseMinor, 1000);
    const november = { from: "2026-11-01", to: "2026-11-30" };
    assert.equal((await totals(november)).accumulatedBalanceMinor, 13500);
    assert.equal((await totals(november)).expenseMinor, 3000);
    const rows = await selectStatementRows(db, walletId, november);
    assert.deepEqual(rows.map(row => [row.id, row.statementDate]), [[id(35), "2026-11-05"]]);
    for (const extra of [{ q: "no matching entry" }, { categoryId: id(99) }, { tagId: id(99) }]) {
      assert.equal((await selectStatementRows(db, walletId, { ...november, ...extra })).length, 0);
      const filtered = await totals({ ...november, ...extra });
      assert.equal(filtered.expenseMinor, 0);
      assert.equal(filtered.accumulatedBalanceMinor, 13500);
    }
    assert.equal((await totals({ ...november, accountId: id(10) })).accumulatedBalanceMinor, 7800);
    assert.equal((await totals({ ...november, accountId: id(11) })).accumulatedBalanceMinor, 5700);
    assert.equal((await totals({ ...november, accountId: id(12) })).accumulatedBalanceMinor, 0);
    assert.equal((await totals({ ...november, accountId: id(13) })).accumulatedBalanceMinor, 0);
    assert.equal((await totals({ from: "2026-12-01", to: "2026-12-31" })).accumulatedBalanceMinor, 13500);
    await db.insert(transactions).values({ ...common, id: id(37), accountId: id(11), type: "CREDIT_CARD_PAYMENT",
      status: "PAID", amountMinor: 3000, transactionDate: "2026-10-30" });
    await db.update(transactions).set({ status: "PAID" }).where(eq(transactions.id, id(35)));
    await db.update(creditCardInvoices).set({ status: "PAID", paymentTransactionId: id(37) }).where(eq(creditCardInvoices.id, id(21)));
    assert.equal((await totals(november)).accumulatedBalanceMinor, 13500);
    assert.equal((await totals()).accumulatedBalanceMinor, 13500);
    await db.update(transactions).set({ archivedAt: new Date() }).where(eq(transactions.id, id(37)));
    await db.update(transactions).set({ status: "PENDING" }).where(eq(transactions.id, id(35)));
    await db.update(creditCardInvoices).set({ status: "OPEN", paymentTransactionId: null }).where(eq(creditCardInvoices.id, id(21)));
    assert.equal((await totals(november)).accumulatedBalanceMinor, 13500);
    assert.equal((await totals()).accumulatedBalanceMinor, 16500);
  } finally { await pg.close(); }
});
