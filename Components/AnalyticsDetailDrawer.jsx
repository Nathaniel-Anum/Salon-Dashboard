import { useMemo, useState } from "react";
import { Drawer } from "antd";
import { useQuery } from "@tanstack/react-query";
import { FiAlertCircle, FiCalendar, FiCheckCircle, FiClock, FiCreditCard, FiSlash } from "react-icons/fi";
import EChart from "./EChart";
import { getAnalyticsBookings } from "../src/api/analytics";
import { isoDate, reportingRange, subtractDays } from "../src/analytics/dateRanges";
import {
  PALETTE,
  aggregatePaymentMethods,
  buildAppointmentsTrendOption,
  buildDonutOption,
  buildHorizontalBarOption,
  buildMetricComparisonOption,
  buildMoneyTrendOption,
  comparisonDirection,
  comparisonLabel,
  comparisonSentiment,
  formatCurrency,
  formatDate,
  formatFreshness,
  formatNumber,
  periodLabel,
  sumDecimalStrings,
} from "../src/analytics/insightUtils";

const PERIODS = [
  { key: "week", label: "This week" },
  { key: "30", label: "Last 30 days" },
  { key: "90", label: "Last 3 months" },
  { key: "custom", label: "Custom" },
];

const METRICS = {
  money: { title: "Money received", description: "Payments recorded by the salon", icon: FiCreditCard, accent: "gold" },
  created: { title: "Appointments created", description: "New appointment records", icon: FiCalendar, accent: "sage" },
  completed: { title: "Completed appointments", description: "Appointments marked as completed", icon: FiCheckCircle, accent: "sage" },
  cancelled: { title: "Cancelled appointments", description: "Appointments marked as cancelled", icon: FiSlash, accent: "rose" },
};

function percentComparison(current, previous) {
  const currentValue = Number(current) || 0;
  const previousValue = Number(previous) || 0;
  if (!previousValue) return { percentage_change: null, reason: "NO_PREVIOUS_BASE" };
  return { percentage_change: (((currentValue - previousValue) / previousValue) * 100).toFixed(2), reason: null };
}

function ChangeBadge({ comparison, lowerIsBetter = false }) {
  const direction = comparisonDirection(comparison);
  const sentiment = comparisonSentiment(comparison, lowerIsBetter);
  return <span className={`drawer-change drawer-change--${sentiment}`}><b>{direction === "up" ? "↗" : direction === "down" ? "↘" : "→"}</b>{comparisonLabel(comparison)}</span>;
}

function DrawerError({ message = "This report is unavailable right now." }) {
  return <div className="drawer-error" role="alert"><FiAlertCircle /><span>{message}</span></div>;
}

function DrawerLoading() {
  return <div className="insight-skeleton insight-skeleton--chart" aria-label="Loading detailed report" />;
}

function ChartDataTable({ caption, headers, rows }) {
  if (!rows.length) return null;
  return <details className="chart-data drawer-chart-data">
    <summary>View chart data</summary>
    <div className="chart-data__scroll"><table><caption>{caption}</caption><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={`${row[0]}-${rowIndex}`}>{row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>)}</tr>)}</tbody></table></div>
  </details>;
}

function DataQuality({ meta }) {
  if (!meta) return null;
  const quality = [
    ["Records reviewed", meta.source_fact_count],
    ["Reliable", meta.reliable_count],
    ["Partial", meta.partial_count],
    ["Estimated", meta.inferred_count],
    ["Unclassified", meta.unknown_count],
  ].filter(([, value]) => value !== null && value !== undefined);
  const warnings = meta.warnings ?? [];

  return <>
    {quality.length > 0 && <section className="drawer-breakdown drawer-quality"><h3>Data confidence</h3><p>How the records behind this report were classified.</p><div className="drawer-quality__grid">{quality.map(([label, value]) => <div key={label}><span>{label}</span><b>{formatNumber(value)}</b></div>)}</div></section>}
    {warnings.length > 0 && <div className="warning-stack">{warnings.map((warning, index) => <div key={warning.code || index}><FiAlertCircle aria-hidden="true" /><span>{warning.message}</span></div>)}</div>}
    {(meta.data_through || meta.generated_at || meta.coverage_start) && <footer className="drawer-freshness drawer-freshness--full">
      {meta.data_through && <span><FiClock aria-hidden="true" /> Data through {formatFreshness(meta.data_through)}</span>}
      {meta.generated_at && <span>Report prepared {formatFreshness(meta.generated_at)}</span>}
      {meta.coverage_start && <span>Coverage begins {formatDate(meta.coverage_start, { year: true })}</span>}
    </footer>}
  </>;
}

function moneyPeriodPoints(data, currency, period) {
  const history = period === "30" ? data?.series?.last_30_days : data?.series?.last_90_days;
  return history?.currencies?.find((row) => row.currency === currency)?.points ?? [];
}

export default function AnalyticsDetailDrawer({ metric, onClose, money, appointments, currency, moneyLoading, appointmentsLoading, moneyError, appointmentsError }) {
  const [period, setPeriod] = useState("week");
  const [selectedCurrency, setSelectedCurrency] = useState(currency || "");
  const [selectedSourceKey, setSelectedSourceKey] = useState("");
  const today = isoDate(new Date());
  const [customStart, setCustomStart] = useState(isoDate(subtractDays(new Date(), 6)));
  const [customEnd, setCustomEnd] = useState(today);
  const config = METRICS[metric];
  const lifecycleMetric = metric === "completed" || metric === "cancelled";
  const range = useMemo(() => reportingRange(period, customStart, customEnd), [period, customStart, customEnd]);

  const currentQuery = useQuery({
    queryKey: ["analytics-bookings", metric, "current", range.current],
    queryFn: () => getAnalyticsBookings(range.current),
    enabled: lifecycleMetric,
    staleTime: 60_000,
    retry: 1,
  });
  const previousQuery = useQuery({
    queryKey: ["analytics-bookings", metric, "previous", range.previous],
    queryFn: () => getAnalyticsBookings(range.previous),
    enabled: lifecycleMetric,
    staleTime: 60_000,
    retry: 1,
  });

  const currencies = money?.summary?.currencies?.map((row) => row.currency) ?? [];
  const effectiveCurrency = currencies.includes(selectedCurrency) ? selectedCurrency : currency || currencies[0];
  const moneySummary = money?.summary?.currencies?.find((row) => row.currency === effectiveCurrency);
  const moneyComparison = money?.comparison?.currencies?.find((row) => row.currency === effectiveCurrency)?.received_amount;
  const selectedMoneyPoints = period === "week" ? [] : moneyPeriodPoints(money, effectiveCurrency, period);
  const selectedMoneyTotal = period === "week" ? moneySummary?.received_amount : sumDecimalStrings(selectedMoneyPoints.map((point) => point.received_amount));
  const selectedAppointmentPoints = period === "30" ? appointments?.series?.last_30_days?.points ?? [] : appointments?.series?.last_90_days?.points ?? [];
  const selectedAppointmentTotal = period === "week" ? appointments?.summary?.appointments_created ?? 0 : selectedAppointmentPoints.reduce((total, point) => total + Number(point.appointments_created || 0), 0);

  const lifecycleField = metric === "completed" ? "appointments_completed" : "appointments_cancelled";
  const lifecycleRateField = metric === "completed" ? "completion_rate" : "cancellation_rate";
  const lifecycleCurrent = currentQuery.data?.[lifecycleField] ?? 0;
  const lifecyclePrevious = previousQuery.data?.[lifecycleField] ?? 0;
  const lifecycleCurrentTotal = currentQuery.data?.bookings_created ?? 0;
  const lifecyclePreviousTotal = previousQuery.data?.bookings_created ?? 0;
  const lifecycleComparison = percentComparison(lifecycleCurrent, lifecyclePrevious);

  const trendOption = (() => {
    if (metric === "money") return buildMoneyTrendOption(money, effectiveCurrency, period);
    if (metric === "created") return buildAppointmentsTrendOption(appointments, period);
    return buildMetricComparisonOption(lifecycleCurrent, lifecyclePrevious, [range.currentLabel, range.previousLabel], {
      currentTotal: lifecycleCurrentTotal,
      previousTotal: lifecyclePreviousTotal,
      seriesName: config.title,
      remainderName: metric === "cancelled" ? "Confirmed appointments" : "Remaining appointments",
      accent: metric === "cancelled" ? "#c97b63" : "#6f7d66",
    });
  })();

  const paymentMethods = aggregatePaymentMethods(money, effectiveCurrency);
  const paymentOption = buildDonutOption(paymentMethods, { valueFormatter: (value) => formatCurrency(value, effectiveCurrency, true), centerLabel: "Received" });
  const moneyDomains = (money?.breakdowns?.by_domain ?? []).filter((row) => row.currency === effectiveCurrency).map((row, index) => ({
    name: row.domain === "booking" ? "Appointment payments" : row.domain === "commerce" ? "Shop payments" : row.domain || "Not captured",
    value: Number(row.received_amount || 0),
    amount: row.received_amount,
    itemStyle: { color: PALETTE[index % PALETTE.length] },
  }));
  const domainOption = buildDonutOption(moneyDomains, { valueFormatter: (value) => formatCurrency(value, effectiveCurrency, true), centerLabel: "Received" });
  const moneySources = (money?.breakdowns?.by_source ?? []).filter((row) => row.currency === effectiveCurrency).map((row, index) => ({ ...row, clientLabel: row.label || "Not captured", key: `${row.source ?? "unknown"}-${row.currency}-${index}` }));
  const activeSource = moneySources.find((source) => source.key === selectedSourceKey) || moneySources[0];

  const bookingSources = (appointments?.breakdowns?.by_booking_source ?? []).map((row) => ({ name: row.label, value: row.appointments_created }));
  const bookingOption = buildHorizontalBarOption(bookingSources);
  const creationChannels = (appointments?.breakdowns?.by_creation_channel ?? []).map((row, index) => ({ name: row.label, value: row.appointments_created, itemStyle: { color: PALETTE[index % PALETTE.length] } }));
  const channelOption = buildDonutOption(creationChannels, { centerLabel: "Created" });

  const trendTable = (() => {
    if (metric === "money") {
      if (period === "week") {
        const points = [...(money?.series?.week_comparison?.currencies?.find((row) => row.currency === effectiveCurrency)?.points ?? [])].sort((a, b) => Number(a.position) - Number(b.position));
        return { headers: ["Day", "This week", "Last week"], rows: points.map((point) => [point.label, formatCurrency(point.active_week?.received_amount, effectiveCurrency), formatCurrency(point.previous_week?.received_amount, effectiveCurrency)]) };
      }
      return { headers: ["Period", "Money received"], rows: selectedMoneyPoints.map((point) => [formatDate(point.date_from, { year: period === "90" }), formatCurrency(point.received_amount, effectiveCurrency)]) };
    }
    if (metric === "created") {
      if (period === "week") {
        const points = [...(appointments?.series?.week_comparison?.points ?? [])].sort((a, b) => Number(a.position) - Number(b.position));
        return { headers: ["Day", "This week", "Last week"], rows: points.map((point) => [point.label, formatNumber(point.active_week?.appointments_created), formatNumber(point.previous_week?.appointments_created)]) };
      }
      return { headers: ["Period", "Appointments created"], rows: selectedAppointmentPoints.map((point) => [formatDate(point.date_from, { year: period === "90" }), formatNumber(point.appointments_created)]) };
    }
    return {
      headers: ["Period", config.title, metric === "cancelled" ? "Confirmed appointments" : "Remaining appointments"],
      rows: [
        [range.previousLabel, formatNumber(lifecyclePrevious), formatNumber(Math.max(lifecyclePreviousTotal - lifecyclePrevious, 0))],
        [range.currentLabel, formatNumber(lifecycleCurrent), formatNumber(Math.max(lifecycleCurrentTotal - lifecycleCurrent, 0))],
      ],
    };
  })();

  const loading = lifecycleMetric ? currentQuery.isLoading || previousQuery.isLoading : metric === "money" ? moneyLoading : appointmentsLoading;
  const failed = lifecycleMetric ? currentQuery.isError || previousQuery.isError : metric === "money" ? Boolean(moneyError) : Boolean(appointmentsError);
  const headline = metric === "money" ? formatCurrency(selectedMoneyTotal, effectiveCurrency) : metric === "created" ? formatNumber(selectedAppointmentTotal) : formatNumber(lifecycleCurrent);
  const comparison = metric === "money" ? moneyComparison : metric === "created" ? appointments?.comparison?.appointments_created : lifecycleComparison;
  const showComparison = period === "week" || lifecycleMetric;
  const Icon = config.icon;
  const customAllowed = lifecycleMetric;

  return <Drawer
    open
    onClose={onClose}
    placement="right"
    size={560}
    keyboard
    destroyOnHidden
    rootClassName="analytics-drawer"
    title={<div className="drawer-title"><span className={`drawer-title__icon drawer-title__icon--${config.accent}`}><Icon /></span><span><b>{config.title}</b><small>{config.description}</small></span></div>}
  >
    <div className="drawer-periods" role="group" aria-label={`${config.title} period`}>
      {PERIODS.map((item) => <button key={item.key} type="button" className={period === item.key ? "active" : ""} disabled={item.key === "custom" && !customAllowed} title={item.key === "custom" && !customAllowed ? "Custom dates are not supported by this report" : undefined} onClick={() => setPeriod(item.key)}>{item.label}</button>)}
    </div>

    {metric === "money" && currencies.length > 1 && <div className="drawer-currency" role="group" aria-label="Currency"><span>Currency</span>{currencies.map((code) => <button type="button" key={code} className={effectiveCurrency === code ? "active" : ""} onClick={() => setSelectedCurrency(code)}>{code}</button>)}</div>}
    {!customAllowed && <p className="drawer-endpoint-note">This report provides fixed weekly, 30-day and 90-day periods. Custom dates are not available yet.</p>}
    {period === "custom" && customAllowed && <div className="drawer-custom-range"><label>From<input type="date" value={customStart} max={customEnd} onChange={(event) => setCustomStart(event.target.value)} /></label><label>To<input type="date" value={customEnd} min={customStart} max={today} onChange={(event) => setCustomEnd(event.target.value)} /></label></div>}

    {failed ? <DrawerError /> : loading ? <DrawerLoading /> : <>
      <section className="drawer-portfolio">
        <p>{range.currentLabel}</p>
        <strong>{headline}</strong>
        {showComparison && <ChangeBadge comparison={comparison} lowerIsBetter={metric === "cancelled"} />}
        <small>{metric === "money" && period === "week" ? periodLabel(money?.summary?.period) : metric === "created" && period === "week" ? periodLabel(appointments?.summary?.period) : `${range.current.date_from} to ${range.current.date_to}`}</small>
      </section>

      <section className="drawer-chart-card">
        <div><h3>{lifecycleMetric ? "Period comparison" : `${config.title} over time`}</h3><p>{lifecycleMetric ? metric === "cancelled" ? "Cancelled appointments compared with confirmed appointments, which exclude cancellations." : "Completed appointments compared with remaining appointments." : period === "week" ? "Compared with the same elapsed days last week." : "Rolling history supplied by the report."}</p></div>
        <EChart option={trendOption} height={260} ariaLabel={`${config.title} for ${range.currentLabel}`} />
        <ChartDataTable caption={`${config.title} chart values`} headers={trendTable.headers} rows={trendTable.rows} />
      </section>

      {metric === "money" && <>
        <section className="drawer-breakdown"><h3>This week’s payment activity</h3><p>Recorded payments, reversals, and the amount retained after reversals.</p><div className="drawer-supporting-metrics drawer-supporting-metrics--four"><div><span>Payments recorded</span><b>{formatNumber(moneySummary?.received_transaction_count)}</b></div><div><span>Payments reversed</span><b>{formatNumber(moneySummary?.reversed_transaction_count)}</b></div><div><span>Recorded reversals</span><b>{formatCurrency(moneySummary?.reversed_amount, effectiveCurrency)}</b></div><div><span>After reversals</span><b>{formatCurrency(moneySummary?.received_after_reversals_amount, effectiveCurrency)}</b></div></div></section>
        <section className="drawer-breakdown"><h3>Money by business area this week</h3><p>Appointment payments and shop payments are kept separate.</p>{moneyDomains.length ? <><EChart option={domainOption} height={225} ariaLabel={`Money received by business area in ${effectiveCurrency}`} /><ul>{moneyDomains.map((domain) => <li key={domain.name}><span><i style={{ background: domain.itemStyle.color }} />{domain.name}</span><b>{formatCurrency(domain.amount, effectiveCurrency)}</b></li>)}</ul></> : <p>No business-area breakdown is available.</p>}</section>
        <section className="drawer-breakdown"><h3>How clients paid this week</h3>{paymentMethods.length ? <><EChart option={paymentOption} height={230} ariaLabel={`Money received by payment method in ${effectiveCurrency}`} /><ul>{paymentMethods.map((method) => <li key={method.name}><span><i style={{ background: method.itemStyle.color }} />{method.name}</span><b>{formatCurrency(method.amount, effectiveCurrency)}</b></li>)}</ul></> : <p>No payment method details are available.</p>}</section>
        <section className="drawer-breakdown"><h3>Payment sources this week</h3><p>Select a source to see how those clients paid.</p>{moneySources.length ? <><div className="source-list drawer-source-list">{moneySources.map((source) => <button type="button" key={source.key} className={activeSource?.key === source.key ? "active" : ""} onClick={() => setSelectedSourceKey(source.key)}><span><b>{source.clientLabel}</b><small>{formatNumber(source.received_transaction_count)} recorded payments</small></span><strong>{formatCurrency(source.received_amount, effectiveCurrency)}</strong></button>)}</div>{activeSource && <div className="source-detail"><p>{activeSource.clientLabel} payment methods</p>{activeSource.payment_methods?.length ? <ul>{activeSource.payment_methods.map((method, index) => <li key={`${activeSource.key}-${method.business_source ?? "source"}-${method.processor ?? "processor"}-${method.payment_method ?? index}`}><span>{method.payment_method_label || "Not captured"}</span><b>{formatCurrency(method.received_amount, effectiveCurrency)}</b></li>)}</ul> : <span className="muted-copy">No payment method detail is available for this source.</span>}</div>}</> : <p>No payment source details are available.</p>}</section>
        <DataQuality meta={money?.meta} />
      </>}

      {metric === "created" && <>
        <section className="drawer-breakdown"><h3>Booking source this week</h3><p>How the appointment was recorded.</p>{bookingSources.length ? <><EChart option={bookingOption} height={250} ariaLabel="Appointments created by booking source" /><ul>{appointments.breakdowns.by_booking_source.map((row, index) => <li key={`${row.booking_source ?? "unknown"}-${index}`}><span><i style={{ background: PALETTE[index % PALETTE.length] }} />{row.label}</span><b>{formatNumber(row.appointments_created)} · {row.percentage_of_total ?? "0"}%</b></li>)}</ul></> : <p>No booking source data is available.</p>}</section>
        <section className="drawer-breakdown"><h3>Creation channel this week</h3><p>Where each appointment record was created.</p>{creationChannels.length ? <><EChart option={channelOption} height={230} ariaLabel="Appointments created by channel" /><ul>{appointments.breakdowns.by_creation_channel.map((row, index) => <li key={`${row.creation_channel ?? "unknown"}-${index}`}><span><i style={{ background: PALETTE[index % PALETTE.length] }} />{row.label}</span><b>{formatNumber(row.appointments_created)} · {row.percentage_of_total ?? "0"}%</b></li>)}</ul></> : <p>No creation-channel data is available.</p>}</section>
        <DataQuality meta={appointments?.meta} />
      </>}

      {lifecycleMetric && <>
        <section className="drawer-breakdown"><h3>Selected period summary</h3><div className="drawer-supporting-metrics drawer-supporting-metrics--four"><div><span>Appointments created</span><b>{formatNumber(currentQuery.data?.bookings_created)}</b></div><div><span>{metric === "completed" ? "Completion rate" : "Cancellation rate"}</span><b>{currentQuery.data?.[lifecycleRateField] == null ? "—" : `${currentQuery.data[lifecycleRateField]}%`}</b></div><div><span>No-shows</span><b>{formatNumber(currentQuery.data?.appointments_no_show)}</b></div><div><span>Rescheduled</span><b>{formatNumber(currentQuery.data?.appointments_rescheduled)}</b></div></div></section>
        <section className="drawer-breakdown"><h3>Waitlist activity</h3><div className="drawer-supporting-metrics drawer-supporting-metrics--three"><div><span>Joined waitlist</span><b>{formatNumber(currentQuery.data?.waitlist_created)}</b></div><div><span>Moved into schedule</span><b>{formatNumber(currentQuery.data?.waitlist_promoted)}</b></div><div><span>Offers expired</span><b>{formatNumber(currentQuery.data?.waitlist_hold_expired)}</b></div></div></section>
      </>}
    </>}
  </Drawer>;
}
