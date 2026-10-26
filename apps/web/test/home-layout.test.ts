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
  assert.deepEqual(insightMonths("2026-02", 6), ["2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05"]);
  assert.equal(insightMonths("2026-10", 12).length, 15);
  assert.equal(homeInsightsQuery.safeParse({ month: "2026-10", months: "12" }).success, true);
  assert.equal(homeInsightsQuery.safeParse({ month: "2026-10", months: "7" }).success, false);
  assert.equal(homeInsightsQuery.safeParse({ month: "2026-13", months: "6" }).success, false);
});
