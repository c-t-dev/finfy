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
