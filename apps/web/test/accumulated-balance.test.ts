import assert from "node:assert/strict";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { PgDialect } from "drizzle-orm/pg-core";
import { accumulatedBalance } from "../lib/server/account-balance";

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
