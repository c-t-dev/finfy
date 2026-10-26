import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { PgDialect } from "drizzle-orm/pg-core";
import { accumulatedBalance, accumulatedPendingBalance } from "../lib/server/account-balance";

test("accumulated cash includes opening balances and paid history, independently of monthly expense competence", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(`create table accounts (id text, wallet_id text, initial_balance_minor integer, archived_at text);
      create table transactions (account_id text, wallet_id text, type text, amount_minor integer, status text, transaction_date text, archived_at text);
      insert into accounts values ('a', 'wallet', 10000, null), ('b', 'wallet', 5000, null),
        ('archived', 'wallet', 90000, '2026-10-01'), ('foreign', 'other', 80000, null);`);
    const insert = db.prepare("insert into transactions values (?, ?, ?, ?, ?, ?, ?)");
    const entry = (account: string | null, type: string, amount: number, date: string, status = "PAID", archived: string | null = null, wallet = "wallet") =>
      insert.run(account, wallet, type, amount, status, date, archived);
    entry("a", "INCOME", 2000, "2026-09-01");
    entry("a", "EXPENSE", 1000, "2026-10-01");
    entry("a", "TRANSFER_OUT", 3000, "2026-10-02");
    entry("b", "TRANSFER_IN", 3000, "2026-10-02");
    entry("a", "ADJUSTMENT", -100, "2026-10-03");
    entry("a", "REFUND", 400, "2026-10-03");
    entry(null, "CREDIT_CARD_PURCHASE", 2000, "2026-10-06", "PENDING");
    entry(null, "CREDIT_CARD_PURCHASE", 1000, "2026-10-06");
    entry("a", "CREDIT_CARD_PAYMENT", 1000, "2026-10-30");
    entry("a", "INCOME", 90000, "2026-10-03", "PENDING");
    entry("a", "EXPENSE", 90000, "2026-10-03", "CANCELED");
    entry("a", "EXPENSE", 90000, "2026-10-03", "PAID", "2026-10-04");
    entry("a", "INCOME", 700, "2026-12-01");
    entry("a", "EXPENSE", 90000, "2026-12-01", "PENDING");
    entry("archived", "INCOME", 90000, "2026-10-01");
    entry("a", "INCOME", 90000, "2026-10-01", "PAID", null, "other");
    const balance = (to: string, accountId?: string, wallet = "wallet") => {
      const query = new PgDialect().sqlToQuery(accumulatedBalance(wallet, to, accountId));
      return db.prepare(`select ${query.sql.replace(/\$\d+/g, "?")} as balance`).get(...query.params as string[])?.balance;
    };
    assert.equal(balance("2026-08-31"), 15000);
    assert.equal(balance("2026-09-30"), 17000);
    assert.equal(balance("2026-10-29"), 16300);
    assert.equal(balance("2026-10-31"), 15300);
    assert.equal(balance("2026-11-30"), 15300);
    assert.equal(balance("2026-12-31"), 16000);
    assert.equal(balance("2026-10-31", "a"), 7300);
    assert.equal(balance("2026-10-31", "b"), 8000);
    assert.equal(balance("2026-10-31", "archived"), 0);
    assert.equal(balance("2026-10-31", "foreign"), 0);
    assert.equal(balance("2026-10-31", undefined, "empty"), 0);
    // The monthly list can be empty after any category/tag/search/date filter.
    // The scalar cash query must still return the full account balance.
    const filtered = new PgDialect().sqlToQuery(accumulatedBalance("wallet", "2026-10-31"));
    assert.equal(db.prepare(`select sum(amount_minor) as monthly, ${filtered.sql.replace(/\$\d+/g, "?")} as balance
      from transactions where 1 = 0`).get(...filtered.params as string[])?.balance, 15300);
    // Reopening an invoice archives its cash payment, restoring cash once.
    db.exec("update transactions set archived_at = '2026-10-31' where type = 'CREDIT_CARD_PAYMENT'");
    assert.equal(balance("2026-10-31"), 16300);
  } finally { db.close(); }
});

test("projected balance includes signed pending movements and card due dates exactly once across pay/reopen", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(`create table accounts (id text, wallet_id text, initial_balance_minor integer, archived_at text);
      create table transactions (account_id text, wallet_id text, type text, amount_minor integer, status text, transaction_date text, archived_at text, credit_card_id text, invoice_id text);
      create table credit_cards (id text, wallet_id text, payment_account_id text);
      create table credit_card_invoices (id text, wallet_id text, status text, archived_at text, due_date text);
      insert into accounts values ('a','wallet',10000,null), ('b','wallet',5000,null), ('old','wallet',90000,'archived');
      insert into credit_cards values ('card','wallet','a');
      insert into credit_card_invoices values ('invoice','wallet','OPEN',null,'2026-11-05');
      insert into transactions values
        ('a','wallet','INCOME',2000,'PENDING','2026-09-01',null,null,null),
        ('a','wallet','EXPENSE',500,'PENDING','2026-10-01',null,null,null),
        ('a','wallet','TRANSFER_OUT',1000,'PENDING','2026-10-02',null,null,null),
        ('b','wallet','TRANSFER_IN',1000,'PENDING','2026-10-02',null,null,null),
        ('a','wallet','ADJUSTMENT',-100,'PENDING','2026-10-03',null,null,null),
        ('a','wallet','REFUND',200,'PENDING','2026-10-03',null,null,null),
        ('a','wallet','EXPENSE',90000,'CANCELED','2026-10-03',null,null,null),
        ('a','wallet','EXPENSE',90000,'PENDING','2026-10-03','archived',null,null),
        ('old','wallet','EXPENSE',90000,'PENDING','2026-10-03',null,null,null),
        ('a','other','INCOME',90000,'PENDING','2026-10-03',null,null,null),
        (null,'wallet','CREDIT_CARD_PURCHASE',3000,'PENDING','2026-10-06',null,'card','invoice');`);
    const read = (to: string, accountId?: string) => {
      const dialect = new PgDialect();
      const value = (expression: ReturnType<typeof accumulatedBalance>) => {
        const query = dialect.sqlToQuery(expression);
        return Number(db.prepare(`select ${query.sql.replace(/\$\d+/g, "?")} as total`).get(...query.params as string[])?.total);
      };
      const confirmed = value(accumulatedBalance("wallet", to, accountId));
      const pending = value(accumulatedPendingBalance("wallet", to, accountId));
      return { confirmed, pending, projected: confirmed + pending };
    };
    assert.deepEqual(read("2026-08-31"), { confirmed: 15000, pending: 0, projected: 15000 });
    assert.equal(read("2026-10-31").pending, 1600);
    assert.equal(read("2026-10-31", "a").pending, 600);
    assert.equal(read("2026-10-31", "b").pending, 1000);
    assert.deepEqual(read("2026-11-30"), { confirmed: 15000, pending: -1400, projected: 13600 });
    assert.equal(read("2026-12-31").projected, 13600);
    assert.equal(read("2026-11-30", "a").pending, -2400);
    assert.equal(read("2026-11-30", "old").projected, 0);
    assert.equal(read("2026-11-30", "missing").projected, 0);
    // Paying early removes projected purchases and debits the actual payment date.
    db.exec(`update transactions set status = 'PAID' where type = 'CREDIT_CARD_PURCHASE';
      update credit_card_invoices set status = 'PAID';
      insert into transactions values ('b','wallet','CREDIT_CARD_PAYMENT',3000,'PAID','2026-10-30',null,null,null);`);
    assert.deepEqual(read("2026-11-30"), { confirmed: 12000, pending: 1600, projected: 13600 });
    assert.equal(read("2026-10-31").projected, 13600);
    assert.equal(read("2026-11-30", "b").confirmed, 2000);
    db.exec(`update transactions set archived_at = 'archived' where type = 'CREDIT_CARD_PAYMENT';
      update transactions set status = 'PENDING' where type = 'CREDIT_CARD_PURCHASE';
      update credit_card_invoices set status = 'OPEN';`);
    assert.deepEqual(read("2026-11-30"), { confirmed: 15000, pending: -1400, projected: 13600 });
    assert.equal(read("2026-10-31").projected, 16600);
  } finally { db.close(); }
});
