import assert from "node:assert/strict";
import { test } from "node:test";
import { matchLocale } from "../src/i18n/locales.ts";
import { CURRENCIES, formatMoney, parseMoney } from "../src/money.ts";
import { can, canChangeRole } from "../src/roles.ts";

// Intl uses non-breaking spaces; compare with plain ones.
const plain = (value: string) => value.replace(/ | /g, " ");

test("money is formatted by language, not by currency", () => {
  assert.equal(plain(formatMoney(123456, CURRENCIES.BRL, "pt-BR")), "R$ 1.234,56");
  assert.equal(formatMoney(123456, CURRENCIES.BRL, "en"), "R$1,234.56");
  assert.equal(formatMoney(123456, CURRENCIES.EUR, "en"), "€1,234.56");
});

test("typed amounts become minor units without floats", () => {
  assert.equal(parseMoney("1.234,56", CURRENCIES.BRL, ","), 123456);
  assert.equal(parseMoney("1,234.5", CURRENCIES.EUR, "."), 123450);
  assert.equal(parseMoney("-12", CURRENCIES.EUR, "."), -1200);
  assert.equal(parseMoney("1.234", CURRENCIES.EUR, "."), null);
  assert.equal(parseMoney("abc", CURRENCIES.EUR, "."), null);
});

test("permission matrix (wiki/decisoes/0002)", () => {
  assert.equal(can("VIEWER", "editEntries"), false);
  assert.equal(can("EDITOR", "editEntries"), true);
  assert.equal(can("ADMIN", "transferOwnership"), false);
  assert.equal(can("OWNER", "leave"), false);
});

test("role changes stay below the actor's own role", () => {
  assert.equal(canChangeRole("ADMIN", "EDITOR", "VIEWER", false), true);
  assert.equal(canChangeRole("ADMIN", "EDITOR", "ADMIN", false), false);
  assert.equal(canChangeRole("ADMIN", "ADMIN", "EDITOR", false), false);
  assert.equal(canChangeRole("OWNER", "ADMIN", "EDITOR", false), true);
  assert.equal(canChangeRole("OWNER", "EDITOR", "OWNER", false), false);
  assert.equal(canChangeRole("ADMIN", "ADMIN", "VIEWER", true), false);
});

test("Accept-Language falls back to English (wiki/decisoes/0011)", () => {
  assert.equal(matchLocale("pt-PT,pt;q=0.9,en;q=0.8"), "pt-BR");
  assert.equal(matchLocale("de-DE,fr;q=0.9"), "en");
  assert.equal(matchLocale("en-GB"), "en");
  assert.equal(matchLocale(null), "en");
});

test("every transaction type has a balance sign, and card purchases skip the account", async () => {
  const { BALANCE_SIGN, TRANSACTION_TYPES } = await import("../src/finance.ts");
  assert.deepEqual(Object.keys(BALANCE_SIGN).sort(), [...TRANSACTION_TYPES].sort());
  assert.equal(BALANCE_SIGN.CREDIT_CARD_PURCHASE, 0);
  assert.equal(BALANCE_SIGN.EXPENSE, -1);
  // ADJUSTMENT is stored signed, so it adds as is.
  assert.equal(BALANCE_SIGN.ADJUSTMENT, 1);
});

test("system categories: unique keys, parents first, translated, and seeded with their IDs", async () => {
  const { readFileSync, readdirSync } = await import("node:fs");
  const { SYSTEM_CATEGORIES } = await import("../src/system-categories.ts");
  const { deterministicId } = await import("../src/ids.ts");
  const keys = SYSTEM_CATEGORIES.map((c) => c.key);
  assert.equal(new Set(keys).size, keys.length);
  SYSTEM_CATEGORIES.forEach((c, index) => {
    if (c.parent) assert.ok(keys.indexOf(c.parent) < index && keys.indexOf(c.parent) >= 0, c.key);
    else assert.ok(c.icon && c.color, c.key);
  });
  for (const locale of ["en", "pt-BR"]) {
    const messages = JSON.parse(readFileSync(new URL(`../src/i18n/messages/${locale}.json`, import.meta.url), "utf8"));
    for (const key of keys) assert.ok(messages.categories[key], `${locale}: categories.${key}`);
  }
  const migrations = new URL("../drizzle/", import.meta.url);
  const sql = readdirSync(migrations)
    .filter((file) => file.endsWith(".sql"))
    .map((file) => readFileSync(new URL(file, migrations), "utf8"))
    .join("\n");
  for (const key of keys) assert.ok(sql.includes(deterministicId("system_category", key)), `migration: ${key}`);
});

test("month helpers give the first and last day, across years", async () => {
  const { addMonths, monthRange } = await import("../src/transactions.ts");
  assert.deepEqual(monthRange("2026-02"), { from: "2026-02-01", to: "2026-02-28" });
  assert.deepEqual(monthRange("2028-02"), { from: "2028-02-01", to: "2028-02-29" });
  assert.equal(addMonths("2026-12", 1), "2027-01");
  assert.equal(addMonths("2026-01", -1), "2025-12");
});

test("card invoices: purchases after the closing day roll to the next invoice", async () => {
  const { invoiceForDate, invoicePeriod, splitInstallments, addMonthsToDate, invoiceState } = await import("../src/invoice-math.ts");
  // Closes on the 25th, due on the 5th of the next month.
  assert.deepEqual(invoiceForDate("2026-10-25", 25, 5), {
    referenceYear: 2026, referenceMonth: 10, openingDate: "2026-09-26", closingDate: "2026-10-25", dueDate: "2026-11-05",
  });
  assert.equal(invoiceForDate("2026-10-26", 25, 5).referenceMonth, 11);
  assert.equal(invoiceForDate("2026-12-30", 25, 5).referenceYear, 2027);
  // Closes on the 3rd, due on the 10th of the same month.
  assert.equal(invoicePeriod(2026, 10, 3, 10).dueDate, "2026-10-10");
  // Closing day 31 in February closes on the last day.
  assert.equal(invoicePeriod(2026, 2, 31, 10).closingDate, "2026-02-28");
  assert.equal(invoicePeriod(2026, 3, 31, 10).openingDate, "2026-03-01");
  assert.deepEqual(splitInstallments(10000, 3), [3334, 3333, 3333]);
  assert.equal(splitInstallments(999, 1)[0], 999);
  assert.equal(addMonthsToDate("2026-01-31", 1), "2026-02-28");
  assert.equal(invoiceState("OPEN", "2026-10-25", "2026-11-05", "2026-10-30"), "CLOSED");
  assert.equal(invoiceState("OPEN", "2026-10-25", "2026-11-05", "2026-11-06"), "OVERDUE");
  assert.equal(invoiceState("PAID", "2026-10-25", "2026-11-05", "2026-11-06"), "PAID");
});

test("members: who may invite and remove whom", async () => {
  const { canInvite, canRemoveMember } = await import("../src/roles.ts");
  assert.equal(canInvite("OWNER", "ADMIN"), true);
  assert.equal(canInvite("ADMIN", "ADMIN"), false);
  assert.equal(canInvite("ADMIN", "EDITOR"), true);
  assert.equal(canInvite("EDITOR", "VIEWER"), false);
  assert.equal(canRemoveMember("OWNER", "ADMIN", false), true);
  assert.equal(canRemoveMember("ADMIN", "ADMIN", false), false);
  assert.equal(canRemoveMember("ADMIN", "VIEWER", false), true);
  assert.equal(canRemoveMember("OWNER", "OWNER", true), false);
  assert.equal(canRemoveMember("EDITOR", "VIEWER", false), false);
});
