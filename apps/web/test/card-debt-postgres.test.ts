import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { accounts, creditCards, creditCardInvoices, recurrences, transactions, wallets } from "@packages/shared/db/schema";
import { selectCommittedCardDebt } from "../lib/server/card-debt";
import { selectStatementTotals, toEntrySummary } from "../lib/server/entry-queries";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

test("actual card debt excludes forecasts and keeps future installments of completed purchases", async () => {
  const pg = new PGlite();
  try {
    const directory = new URL("../../../packages/shared/drizzle/", import.meta.url);
    for (const file of (await readdir(directory)).filter(name => name.endsWith(".sql")).sort()) {
      await pg.exec(await readFile(new URL(file, directory), "utf8"));
    }
    const db = drizzle(pg);
    await db.insert(wallets).values([{ id: id(1), name: "Synthetic", currencyCode: "EUR" }, { id: id(2), name: "Other", currencyCode: "EUR" }]);
    await db.insert(accounts).values([{ id: id(3), walletId: id(1), name: "Synthetic account", type: "CASH" },
      { id: id(4), walletId: id(2), name: "Other account", type: "CASH" }]);
    const commonCard = { name: "Synthetic card", brand: "VISA" as const, closingDay: 15, dueDay: 5 };
    await db.insert(creditCards).values([{ ...commonCard, id: id(5), walletId: id(1), paymentAccountId: id(3) },
      { ...commonCard, id: id(6), walletId: id(2), paymentAccountId: id(4) }]);
    const invoice = { walletId: id(1), creditCardId: id(5), referenceYear: 2026,
      openingDate: "2026-09-01", closingDate: "2026-10-15", dueDate: "2026-11-05" };
    await db.insert(creditCardInvoices).values([
      { ...invoice, id: id(10), referenceMonth: 10 }, { ...invoice, id: id(11), referenceMonth: 11 },
      { ...invoice, id: id(12), referenceMonth: 9, status: "PAID" },
      { ...invoice, id: id(13), referenceMonth: 12, archivedAt: new Date() },
      { ...invoice, id: id(14), walletId: id(2), creditCardId: id(6), referenceMonth: 10 },
    ]);
    await db.insert(recurrences).values({ id: id(20), walletId: id(1), type: "EXPENSE", creditCardId: id(5),
      description: "Synthetic recurring purchase", amountMinor: 500, frequency: "MONTHLY", startDate: "2026-11-01" });
    const purchase = async (n: number, patch: Partial<typeof transactions.$inferInsert>) => db.insert(transactions).values({
      id: id(n), walletId: id(1), creditCardId: id(5), invoiceId: id(10), type: "CREDIT_CARD_PURCHASE",
      status: "PENDING", description: "Synthetic purchase", amountMinor: 100, transactionDate: "2026-10-10", ...patch,
    });
    await purchase(30, { amountMinor: 1000 });
    await purchase(31, { amountMinor: 200, transactionDate: "2026-10-27" });
    await purchase(32, { amountMinor: 500, transactionDate: "2026-11-01", invoiceId: id(11), recurrenceId: id(20), occurrenceDate: "2026-11-01" });
    await purchase(33, { amountMinor: 800, transactionDate: "2026-10-28", invoiceId: id(11) });
    for (const [first, date, status, archivedAt, firstInvoice] of [
      [100, "2026-10-10", "PENDING", null, 10],
      [110, "2026-09-10", "PAID", null, 12],
      [120, "2026-10-10", "CANCELED", null, 10],
      [130, "2026-10-10", "PENDING", new Date(), 10],
      [140, "2026-10-28", "PENDING", null, 10],
    ] as const) {
      const group = { installmentGroupId: id(first), installmentTotal: 2 };
      await purchase(first, { ...group, installmentNumber: 1, transactionDate: date, status, archivedAt, invoiceId: id(firstInvoice) });
      await purchase(first + 1, { ...group, installmentNumber: 2, transactionDate: "2026-11-28", invoiceId: id(11) });
    }
    await purchase(150, { amountMinor: 90000, invoiceId: id(13) });
    await purchase(151, { amountMinor: 90000, status: "CANCELED" });
    await purchase(152, { amountMinor: 90000, archivedAt: new Date() });
    await purchase(153, { amountMinor: 90000, walletId: id(2), creditCardId: id(6), invoiceId: id(14) });
    const debt = async (date: string, scope = eq(transactions.walletId, id(1))) =>
      (await selectCommittedCardDebt(db, scope, date)).reduce((sum, row) => sum + Number(row.totalMinor), 0);
    assert.equal(await debt("2026-10-27"), 1500); // 1000 + 200 + two installments (200) + unpaid leg of paid-origin purchase (100).
    assert.equal(await debt("2026-10-27", eq(transactions.creditCardId, id(5))), 1500); // Limit and net worth share the rule.
    assert.equal(await debt("2026-10-28"), 2500); // Future manual purchase + its now-committed installment group.
    assert.equal(await debt("2026-11-01"), 3000); // Recurrence counts only once its purchase date arrives.
    const [projected] = await selectStatementTotals(db, id(1), { from: "2026-11-01", to: "2026-11-30" });
    assert.ok(toEntrySummary(projected).expenseMinor > 3000); // Planning still includes forecasts.
    await db.update(creditCardInvoices).set({ status: "PAID" }).where(eq(creditCardInvoices.id, id(10)));
    assert.equal(await debt("2026-10-27"), 200); // Future unpaid installments remain committed even when the original invoice was paid.
    await db.update(creditCardInvoices).set({ status: "OPEN" }).where(eq(creditCardInvoices.id, id(10)));
    assert.equal(await debt("2026-10-27"), 1500);
    assert.equal(await debt("2026-10-27", eq(transactions.walletId, id(99))), 0);
  } finally { await pg.close(); }
});
