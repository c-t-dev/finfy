import assert from "node:assert/strict";
import { test } from "node:test";
import type { Invoice } from "@packages/shared/cards";
import { cardPaymentOverview } from "../lib/server/card-overview";

const invoice = (id: string, dueDate: string, totalMinor: number, state: Invoice["state"] = "OPEN"): Invoice => ({
  id, creditCardId: "synthetic-card", referenceYear: 2026, referenceMonth: 10,
  openingDate: "2026-09-16", closingDate: "2026-10-15", dueDate, totalMinor, state,
  paymentTransactionId: null, version: 1,
});

test("card overview separates next actual invoice, overdue debt and forecasts", () => {
  const result = cardPaymentOverview([
    invoice("later", "2026-12-05", 15000),
    invoice("late", "2026-10-05", 5000, "OVERDUE"),
    invoice("next", "2026-11-05", 10000, "CLOSED"),
    invoice("paid", "2026-10-06", 99900, "PAID"),
    invoice("forecast-only", "2026-10-30", 7000),
  ], new Map([["next", 8000], ["late", 5000], ["later", 500], ["paid", 99900]]), "2026-10-27");
  assert.equal(result.nextInvoice?.id, "next");
  assert.equal(result.nextInvoice?.totalMinor, 8000);
  assert.equal(result.overdueMinor, 5000);
  assert.equal(result.overdueCount, 1);
  assert.equal(result.overdueInvoice?.id, "late");
  assert.deepEqual(result.nextForecast, { dueDate: "2026-10-30", amountMinor: 7000 });
});

test("an invoice due today is next, and a forecast alone never becomes a payable amount", () => {
  const rows = [invoice("today", "2026-10-27", 1000), invoice("tomorrow", "2026-10-28", 2000)];
  assert.equal(cardPaymentOverview(rows, new Map([["today", 1000]]), "2026-10-27").nextInvoice?.id, "today");
  const forecast = cardPaymentOverview(rows, new Map(), "2026-10-27");
  assert.equal(forecast.nextInvoice, null);
  assert.equal(forecast.overdueMinor, 0);
  assert.deepEqual(forecast.nextForecast, { dueDate: "2026-10-27", amountMinor: 1000 });
  assert.deepEqual(cardPaymentOverview([], new Map(), "2026-10-27"), {
    nextInvoice: null, overdueMinor: 0, overdueCount: 0, overdueInvoice: null, nextForecast: null,
  });
});
