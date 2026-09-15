import assert from "node:assert/strict";
import test from "node:test";
import { reportingRange } from "./dateRanges.js";

const sunday = new Date("2026-09-06T12:00:00Z");

test("weekly report compares the same elapsed weekdays", () => {
  const range = reportingRange("week", undefined, undefined, sunday);
  assert.deepEqual(range.current, { date_from: "2026-08-31", date_to: "2026-09-06" });
  assert.deepEqual(range.previous, { date_from: "2026-08-24", date_to: "2026-08-30" });
});

test("custom report creates an immediately preceding matching range", () => {
  const range = reportingRange("custom", "2026-08-10", "2026-08-14", sunday);
  assert.deepEqual(range.previous, { date_from: "2026-08-05", date_to: "2026-08-09" });
});
