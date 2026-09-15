import assert from "node:assert/strict";
import test from "node:test";
import { aggregatePaymentMethods, buildMetricComparisonOption, buildRevenueTrendOption, comparisonLabel, comparisonSentiment, periodLabel, sumDecimalStrings } from "./insightUtils.js";

test("payment methods are combined exactly across money sources", () => {
  const data = {
    breakdowns: {
      by_source: [
        { currency: "GHS", payment_methods: [{ payment_method_label: "Cash", received_amount: "0.10" }] },
        { currency: "GHS", payment_methods: [{ payment_method_label: "Cash", received_amount: "0.20" }] },
        { currency: "USD", payment_methods: [{ payment_method_label: "Cash", received_amount: "99.00" }] },
      ],
    },
  };

  assert.deepEqual(aggregatePaymentMethods(data, "GHS").map(({ name, amount }) => ({ name, amount })), [
    { name: "Cash", amount: "0.30" },
  ]);
});

test("a missing comparison base is described without a false zero percent", () => {
  assert.equal(comparisonLabel({ percentage_change: null, reason: "NO_PREVIOUS_BASE" }), "No comparable value last week");
});

test("exclusive period end is shown as its preceding day", () => {
  assert.equal(periodLabel({ date_from: "2026-08-03", date_to: "2026-08-06" }), "3 Aug – 5 Aug 2026");
});

test("money histories are totalled in minor units", () => {
  assert.equal(sumDecimalStrings(["0.10", "0.20", "1200.05"]), "1200.35");
});

test("a decrease is positive for lower-is-better metrics such as cancellations", () => {
  assert.equal(comparisonSentiment({ percentage_change: "-28.6" }, true), "up");
  assert.equal(comparisonSentiment({ percentage_change: "12.5" }, true), "down");
});

test("lifecycle comparison uses a truthful stacked line composition", () => {
  const option = buildMetricComparisonOption(5, 7, ["This week", "Last week"], {
    currentTotal: 46,
    previousTotal: 41,
    seriesName: "Cancelled appointments",
  });

  assert.deepEqual(option.xAxis.data, ["Last week", "This week"]);
  assert.deepEqual(option.series.map((series) => series.type), ["line", "line"]);
  assert.deepEqual(option.series.map((series) => series.stack), ["appointments", "appointments"]);
  assert.equal(option.series[1].name, "Confirmed appointments");
  assert.deepEqual(option.series[0].data, [7, 5]);
  assert.deepEqual(option.series[1].data, [34, 41]);
});

test("legacy revenue points are ordered before charting", () => {
  const option = buildRevenueTrendOption({ revenue_by_day: [{ date: "2026-09-02", revenue: "20.00" }, { date: "2026-09-01", revenue: "10.00" }] });
  assert.deepEqual(option.xAxis.data, ["1 Sept", "2 Sept"]);
  assert.deepEqual(option.series[0].data, [10, 20]);
});
