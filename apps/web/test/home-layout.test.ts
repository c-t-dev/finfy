import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_HOME_LAYOUT,
  HOME_WIDGETS,
  homeInsightsQuery,
  insightMonths,
  moveWidget,
  readHomeLayout,
  saveHomeLayoutInput,
} from "@packages/shared/home";
import { forecastEntries } from "../lib/server/forecast";

test("home layout: stored lists are read leniently, moves keep the rest in order (wiki/decisoes/0019)", () => {
  assert.deepEqual(DEFAULT_HOME_LAYOUT.map((widget) => widget.key), [...HOME_WIDGETS]);
  // Unknown keys (a newer app version), repeats and bad sizes never break the Home.
  assert.deepEqual(
    readHomeLayout([{ key: "recent", size: "half" }, { key: "future", size: "full" }, { key: "recent", size: "full" }, { key: "balance", size: "huge" }, null]),
    [{ key: "recent", size: "half" }, { key: "balance", size: "half" }],
  );
  assert.deepEqual(readHomeLayout([]), []);
  assert.equal(readHomeLayout("broken"), DEFAULT_HOME_LAYOUT);
  const three = readHomeLayout([{ key: "balance" }, { key: "month" }, { key: "recent" }]);
  assert.deepEqual(moveWidget(three, 2, 0).map((widget) => widget.key), ["recent", "balance", "month"]);
  assert.deepEqual(moveWidget(three, 0, 1).map((widget) => widget.key), ["month", "balance", "recent"]);
  assert.equal(moveWidget(three, 0, 3), three);
  assert.equal(saveHomeLayoutInput.safeParse({ widgets: [{ key: "balance", size: "full" }, { key: "balance", size: "half" }] }).success, false);
  assert.equal(saveHomeLayoutInput.safeParse({ widgets: null }).success, true);
  assert.equal(saveHomeLayoutInput.safeParse({ widgets: [{ key: "netWorthChart", size: "full" }] }).success, false);
  // Charts: the history ends on the current month, then three projected months, across years.
  assert.deepEqual(insightMonths("2026-02", 6, 3), ["2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05"]);
  assert.equal(insightMonths("2026-10", 12, 12).length, 24);
  assert.equal(insightMonths("2026-10", 6, 12).at(-1), "2027-10");
  assert.equal(homeInsightsQuery.safeParse({ month: "2026-10", months: "12", ahead: "12" }).success, true);
  assert.equal(homeInsightsQuery.safeParse({ month: "2026-10", months: "7", ahead: "3" }).success, false);
  assert.equal(homeInsightsQuery.safeParse({ month: "2026-10", months: "6", ahead: "24" }).success, false);
  assert.equal(homeInsightsQuery.safeParse({ month: "2026-13", months: "6", ahead: "3" }).success, false);
});

test("forecast: only dates after the horizon, cards on their due date, archived sources skipped", () => {
  const base = { endDate: null, accountId: "acc", creditCardId: null, frequency: "MONTHLY", startDate: "2026-01-05" };
  const card = { id: "card", closingDay: 10, dueDay: 20, paymentAccountId: "acc" };
  const active = new Set(["acc"]);
  const salary = { ...base, type: "INCOME" as const, amountMinor: 500000 };
  // Horizon 2027-01-24: the January 5 occurrence already exists as an entry, so it starts in February.
  assert.deepEqual(forecastEntries([salary], [], active, "2027-01-24", "2027-03-31").map((entry) => entry.date), ["2027-02-05", "2027-03-05"]);
  // Ends are respected.
  assert.equal(forecastEntries([{ ...salary, endDate: "2027-02-28" }], [], active, "2027-01-24", "2027-12-31").length, 1);
  // A purchase on the 15th, after closing on the 10th, is due on the 20th of the next month; a due date after `until` is left out.
  const gym = { ...base, type: "EXPENSE" as const, amountMinor: 9000, accountId: null, creditCardId: "card", startDate: "2026-01-15" };
  assert.deepEqual(forecastEntries([gym], [card], active, "2027-01-24", "2027-04-30"), [
    { type: "EXPENSE", amountMinor: 9000, date: "2027-03-20", affectsBalance: true },
    { type: "EXPENSE", amountMinor: 9000, date: "2027-04-20", affectsBalance: true },
  ]);
  // Archived account or card (absent from the lists): nothing; card paid from an archived account: expense, no cash.
  assert.equal(forecastEntries([salary], [], new Set(), "2027-01-24", "2027-12-31").length, 0);
  assert.equal(forecastEntries([gym], [], active, "2027-01-24", "2027-12-31").length, 0);
  assert.ok(forecastEntries([gym], [card], new Set(), "2027-01-24", "2027-04-30").every((entry) => !entry.affectsBalance));
  // A daily recurrence started years ago still reaches a year ahead.
  const daily = { ...base, type: "EXPENSE" as const, amountMinor: 100, frequency: "DAILY", startDate: "2020-01-01" };
  assert.equal(forecastEntries([daily], [], active, "2027-01-24", "2027-01-31").length, 7);
});
