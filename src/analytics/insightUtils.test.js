import assert from "node:assert/strict";
import test from "node:test";
import { aggregatePaymentMethods, buildMetricComparisonOption, buildRevenueComparisonOption, comparisonLabel, comparisonSentiment, periodLabel, sumDecimalStrings } from "./insightUtils.js";
import { APPOINTMENT_METRICS, reportPeriod, reportPeriodLabel } from "./portalReports.js";

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

test("appointment activity compares actual counts without inventing a remainder", () => {
  const option = buildMetricComparisonOption(5, 7, ["This week", "Last week"], {
    seriesName: "Arrived appointments",
  });

  assert.deepEqual(option.xAxis.data, ["Last week", "This week"]);
  assert.deepEqual(option.series.map((series) => series.type), ["bar"]);
  assert.deepEqual(option.series[0].data, [7, 5]);
  assert.deepEqual(buildMetricComparisonOption(undefined, 0).series[0].data, [0, null]);
});

test("revenue remains separated across the server-defined weekly comparison", () => {
  const option = buildRevenueComparisonOption({ week_comparison: {
    current_week: { booking_revenue: "2500.00", commerce_revenue: "900.00" },
    previous_week: { booking_revenue: "2000.00", commerce_revenue: "1000.00" },
  } });
  assert.deepEqual(option.xAxis.data, ["Booking revenue", "Commerce revenue"]);
  assert.deepEqual(option.series.map(({ data }) => data), [[2500, 900], [2000, 1000]]);
  assert.deepEqual(buildRevenueComparisonOption().series[0].data, [null, null]);
});

test("every portal drilldown selects its server window and preserves inclusive end dates", () => {
  const data = {
    today: { appointments_arrived: 15 },
    week_comparison: {
      current_week: { date_from: "2026-09-21", date_to: "2026-09-25", appointments_arrived: 52 },
      previous_week: { date_from: "2026-09-14", date_to: "2026-09-18", appointments_arrived: 47 },
    },
    last_30_days: { appointments_arrived: 220 },
    last_90_days: { appointments_arrived: 640 },
    custom_period: { date_from: "2026-08-01", date_to: "2026-08-31", appointments_arrived: 205 },
  };
  assert.deepEqual(["today", "week", "previous_week", "30", "90", "custom"].map((key) => reportPeriod(data, key).appointments_arrived), [15, 52, 47, 220, 640, 205]);
  assert.equal(reportPeriodLabel(reportPeriod(data, "week")), "2026-09-21 to 2026-09-25");
  assert.equal(reportPeriodLabel(reportPeriod(data, "custom")), "2026-08-01 to 2026-08-31");
  assert.equal(reportPeriod(undefined, "week"), undefined);
  assert.deepEqual(APPOINTMENT_METRICS.map(({ field }) => field), ["appointments_completed", "appointments_no_show", "appointments_rescheduled", "appointments_arrived"]);
});

test("weekly change labels distinguish zero values from a missing previous base", () => {
  assert.equal(comparisonLabel({ percentage_change: "0.00", reason: null }), "No change from last week");
  assert.equal(comparisonLabel({ percentage_change: "25.00", reason: null }), "25.0% higher than last week");
  assert.equal(comparisonLabel({ percentage_change: "-10.00", reason: null }), "10.0% lower than last week");
  assert.equal(comparisonLabel(undefined), "Comparison unavailable");
});
