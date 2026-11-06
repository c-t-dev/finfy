import assert from "node:assert/strict";
import { test } from "node:test";
import type { Invoice } from "@packages/shared/cards";
import { cardPaymentOverview } from "../lib/server/card-overview";

const invoice = (id: string, dueDate: string, totalMinor: number, state: Invoice["state"] = "OPEN"): Invoice => ({
  id, creditCardId: "synthetic-card", referenceYear: 2026, referenceMonth: 10,
  openingDate: "2026-09-16", closingDate: "2026-10-15", dueDate, totalMinor, state,
  paymentTransactionId: null, version: 1,
});

test("card overview uses full outstanding totals and excludes paid invoices", () => {
  const result = cardPaymentOverview([
    invoice("later", "2026-12-05", 15000),
    invoice("late", "2026-10-05", 5000, "OVERDUE"),
    invoice("next", "2026-11-05", 10000, "CLOSED"),
    invoice("paid", "2026-10-06", 99900, "PAID"),
    invoice("forecast-only", "2026-10-30", 7000),
  ], "2026-10-27");
  assert.equal(result.nextInvoice?.id, "forecast-only");
  assert.equal(result.nextInvoice?.totalMinor, 7000);
  assert.equal(result.overdueMinor, 5000);
  assert.equal(result.overdueCount, 1);
  assert.equal(result.overdueInvoice?.id, "late");
  assert.equal(result.nextForecast, null);
});

test("future-dated entries remain payable and an invoice due today is next", () => {
  const rows = [invoice("today", "2026-10-27", 1000), invoice("tomorrow", "2026-10-28", 2000)];
  assert.equal(cardPaymentOverview(rows, "2026-10-27").nextInvoice?.id, "today");
  const forecast = cardPaymentOverview(rows, "2026-10-27");
  assert.equal(forecast.nextInvoice?.totalMinor, 1000);
  assert.equal(forecast.overdueMinor, 0);
  assert.equal(forecast.nextForecast, null);
  assert.deepEqual(cardPaymentOverview([], "2026-10-27"), {
    nextInvoice: null, overdueMinor: 0, overdueCount: 0, overdueInvoice: null, nextForecast: null,
  });
});

 test("mixed invoice shows 1548.45 instead of only its committed 48.45", () => {
 const result = cardPaymentOverview([invoice("mixed", "2026-12-05", 154845), invoice("empty", "2026-11-10", 0)], "2026-11-06");
 assert.equal(result.nextInvoice?.totalMinor,154845);
 assert.equal(result.nextInvoice?.id,"mixed");
 assert.equal(result.nextForecast,null);
 });
