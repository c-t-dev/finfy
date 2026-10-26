import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { PgDialect } from "drizzle-orm/pg-core";
import { statementDate } from "../lib/server/entry-dates";
import { addMonthsToDate, invoiceForDate } from "../../../packages/shared/src/invoice-math";

test("statement SQL allocates purchases and installments by saved invoice due date", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(`create table transactions (id text, wallet_id text, type text, invoice_id text, transaction_date text, amount_minor integer);
      create table credit_card_invoices (id text, wallet_id text, due_date text);`);
    const purchase = db.prepare("insert into transactions values (?, 'wallet', 'CREDIT_CARD_PURCHASE', ?, ?, ?)");
    const invoice = db.prepare("insert into credit_card_invoices values (?, 'wallet', ?)");
    for (const [id, date, closing, due, expected] of [
      ["reported", "2026-10-06", 15, 5, "2026-11-05"],
      ["same-month", "2026-10-02", 3, 10, "2026-10-10"],
      ["year-end", "2026-12-10", 15, 5, "2027-01-05"],
    ] as const) {
      const period = invoiceForDate(date, closing, due);
      assert.equal(period.dueDate, expected);
      invoice.run(id, period.dueDate);
      purchase.run(id, id, date, 140000);
    }
    for (let i = 0; i < 3; i++) {
      const date = addMonthsToDate("2026-10-26", i);
      const period = invoiceForDate(date, 15, 5);
      const id = `installment-${i}`;
      invoice.run(id, period.dueDate);
      purchase.run(id, id, date, 10000);
    }
    // Paying early changes cash on its actual date, never the purchase competence.
    db.exec("insert into transactions values ('payment', 'wallet', 'CREDIT_CARD_PAYMENT', 'reported', '2026-10-30', 140000)");
    const expression = new PgDialect().sqlToQuery(statementDate).sql;
    const rows = db.prepare(`select id, transaction_date, ${expression} as competence from transactions order by id`).all();
    assert.deepEqual(rows.map(r => [r.id, r.competence]), [
      ["installment-0", "2026-12-05"], ["installment-1", "2027-01-05"], ["installment-2", "2027-02-05"],
      ["payment", "2026-10-30"], ["reported", "2026-11-05"], ["same-month", "2026-10-10"], ["year-end", "2027-01-05"],
    ]);
    assert.equal(rows.find(r => r.id === "reported")?.transaction_date, "2026-10-06");
    const total = db.prepare(`select sum(amount_minor) as amount from transactions where type in ('EXPENSE', 'CREDIT_CARD_PURCHASE') and ${expression} between '2026-11-01' and '2026-11-30'`).get();
    assert.equal(total?.amount, 140000);
  } finally { db.close(); }
});
