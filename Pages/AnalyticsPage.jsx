import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FiArrowUpRight, FiCalendar, FiCreditCard, FiRefreshCw, FiSlash } from "react-icons/fi";
import AnalyticsDetailDrawer from "../Components/AnalyticsDetailDrawer";
import EChart from "../Components/EChart";
import { getAnalyticsBookings, getAnalyticsRevenue, getAppointmentsCreatedInsight, getMoneyReceivedInsight } from "../src/api/analytics";
import { PORTAL_METRICS, reportPeriodLabel } from "../src/analytics/portalReports";
import { permissionState } from "../src/auth/permissions";
import { PALETTE, aggregatePaymentMethods, buildDonutOption, comparisonDirection, comparisonLabel, comparisonSentiment, formatCurrency, formatNumber, periodLabel } from "../src/analytics/insightUtils";
import "./Insights.css";

const querySettings = { staleTime: 60_000, refetchOnWindowFocus: true, retry: 1 };

function ChangePill({ comparison, lowerIsBetter = false }) {
  const direction = comparisonDirection(comparison);
  const sentiment = comparisonSentiment(comparison, lowerIsBetter);
  const symbol = direction === "up" ? "↗" : direction === "down" ? "↘" : "→";
  return <span className={`change-pill change-pill--${sentiment}`}><span aria-hidden="true">{symbol}</span> {comparisonLabel(comparison)}</span>;
}

function MetricCard({ title, period, value, comparison, icon, accent, loading, onClick, lowerIsBetter = false }) {
  const CardIcon = icon;
  return <button type="button" className={`analytics-metric-card analytics-metric-card--${accent}`} onClick={onClick} aria-haspopup="dialog">
    <span className="analytics-metric-card__top"><span className="analytics-metric-card__icon"><CardIcon aria-hidden="true" /></span><span>{period}</span></span>
    <span className="analytics-metric-card__title">{title}</span>
    {loading ? <span className="text-skeleton" aria-label={`Loading ${title}`} /> : <strong>{value}</strong>}
    {!loading && <ChangePill comparison={comparison} lowerIsBetter={lowerIsBetter} />}
    <span className="analytics-metric-card__action">View details <FiArrowUpRight aria-hidden="true" /></span>
  </button>;
}

export default function AnalyticsPage() {
  const canViewReports = permissionState("reports.view") !== false;
  const [activeMetric, setActiveMetric] = useState(() => {
    const requestedReport = typeof window === "undefined" ? "" : window.location.hash.slice(1);
    return requestedReport === "appointments" ? "created" : ["money", "created", ...PORTAL_METRICS.map(({ key }) => key)].includes(requestedReport) ? requestedReport : null;
  });

  const moneyQuery = useQuery({ queryKey: ["portal-insights", "money-received"], queryFn: getMoneyReceivedInsight, enabled: canViewReports, ...querySettings });
  const appointmentsQuery = useQuery({ queryKey: ["portal-insights", "appointments-created"], queryFn: getAppointmentsCreatedInsight, enabled: canViewReports, ...querySettings });
  const bookingsQuery = useQuery({ queryKey: ["analytics-bookings", {}], queryFn: () => getAnalyticsBookings(), enabled: canViewReports, ...querySettings });
  const revenueQuery = useQuery({ queryKey: ["analytics-revenue", {}], queryFn: () => getAnalyticsRevenue(), enabled: canViewReports, ...querySettings });

  const money = moneyQuery.data;
  const appointments = appointmentsQuery.data;
  const currency = money?.summary?.currencies?.[0]?.currency;
  const moneySummary = money?.summary?.currencies?.find((row) => row.currency === currency);
  const moneyComparison = money?.comparison?.currencies?.find((row) => row.currency === currency)?.received_amount;
  const primaryMethod = useMemo(() => aggregatePaymentMethods(money, currency)[0], [money, currency]);
  const primaryBookingSource = appointments?.breakdowns?.by_booking_source?.[0];
  const portalBookingSources = useMemo(() => (appointments?.breakdowns?.by_booking_source ?? []).filter((row) => {
    const key = String(row.booking_source ?? row.label ?? "").toLowerCase().replaceAll("_", "-");
    return key === "online" || key === "mobile-app" || key === "walk-in" || key.includes("walk-in");
  }).map((row, index) => {
    const key = String(row.booking_source ?? row.label ?? "").toLowerCase().replaceAll("_", "-");
    return { name: key === "online" || key === "mobile-app" ? "Mobile app" : "Walk-in", value: row.appointments_created, itemStyle: { color: PALETTE[index % PALETTE.length] } };
  }), [appointments]);
  const bookingSourceOption = useMemo(() => buildDonutOption(portalBookingSources, { centerLabel: "Bookings" }), [portalBookingSources]);
  const refreshing = moneyQuery.isFetching || appointmentsQuery.isFetching || bookingsQuery.isFetching || revenueQuery.isFetching;

  const refetchAll = () => {
    moneyQuery.refetch();
    appointmentsQuery.refetch();
    bookingsQuery.refetch();
    revenueQuery.refetch();
  };

  if (!canViewReports) return <main className="insights-page"><section className="insight-no-access">You do not have permission to view reports.</section></main>;

  return <main className="insights-page analytics-insights analytics-insights--drawer-led">
    <header className="analytics-intro">
      <div><p className="analytics-kicker">Business overview</p><h1>Know what moved.</h1><p>Open any report for comparisons, longer trends and a clear breakdown.</p></div>
      <button type="button" className="refresh-button" onClick={refetchAll} disabled={refreshing}><FiRefreshCw className={refreshing ? "spin" : ""} aria-hidden="true" /> {refreshing ? "Refreshing" : "Refresh data"}</button>
    </header>

    <div className="analytics-card-heading"><div><h2>This week at a glance</h2><p>Each card opens its detailed report.</p></div><span>{periodLabel(money?.summary?.period || appointments?.summary?.period)}</span></div>

    <section className="analytics-metric-grid" aria-label="This week's headline reports">
      <MetricCard title="Money received" period="This week" value={moneySummary ? formatCurrency(moneySummary.received_amount, currency) : "—"} comparison={moneyComparison} icon={FiCreditCard} accent="gold" loading={moneyQuery.isLoading} onClick={() => setActiveMetric("money")} />
      <MetricCard title="Appointments created" period="This week" value={formatNumber(appointments?.summary?.appointments_created)} comparison={appointments?.comparison?.appointments_created} icon={FiCalendar} accent="sage" loading={appointmentsQuery.isLoading} onClick={() => setActiveMetric("created")} />
      {PORTAL_METRICS.map((metric) => {
        const query = metric.revenue ? revenueQuery : bookingsQuery;
        const value = query.data?.week_comparison?.current_week?.[metric.field];
        return <MetricCard key={metric.key} title={metric.title} period="Week to date" value={query.isError ? "Unavailable" : metric.revenue ? formatCurrency(value) : formatNumber(value)} comparison={query.isError ? undefined : query.data?.week_comparison?.changes?.[metric.field]} icon={metric.revenue ? FiCreditCard : FiCalendar} accent={metric.accent} loading={query.isLoading} lowerIsBetter={metric.lowerIsBetter} onClick={() => setActiveMetric(metric.key)} />;
      })}
    </section>
    {[ ["Revenue", revenueQuery], ["Appointment activity", bookingsQuery] ].filter(([, query]) => query.isError).map(([label, query]) => <div className="report-error" role="alert" key={label}><FiSlash aria-hidden="true" /><strong>{label} is unavailable.</strong><button type="button" onClick={() => query.refetch()}>Retry</button></div>)}

    <section className="analytics-context-grid" aria-label="This week's supporting analytics">
      <article>
        <span>Leading payment method</span>
        <strong>{primaryMethod?.name || "No payments yet"}</strong>
        <small>{primaryMethod ? formatCurrency(primaryMethod.amount, currency) : "Payment mix will appear after receipts are recorded."}</small>
      </article>
      <article>
        <span>Leading booking source</span>
        <strong>{primaryBookingSource?.label || "No bookings yet"}</strong>
        <small>{primaryBookingSource ? `${formatNumber(primaryBookingSource.appointments_created)} appointments · ${primaryBookingSource.percentage_of_total ?? "0"}%` : "Booking sources will appear after appointments are created."}</small>
      </article>
      <article>
        <span>Appointment activity period</span>
        <strong>{reportPeriodLabel(bookingsQuery.data?.week_comparison?.current_week)}</strong>
        <small>Arrival counts include transitions recorded since tracking began. Historical arrivals are not backfilled.</small>
      </article>
    </section>

    <section className="analytics-booking-report" aria-labelledby="booking-performance-title">
      <header className="analytics-booking-report__heading"><div><p>Portal bookings</p><h2 id="booking-performance-title">Bookings by source</h2><span>Where this week’s new appointments began.</span></div><small>{periodLabel(appointments?.summary?.period)}</small></header>
          <article className="report-panel analytics-source-panel"><div className="panel-heading"><div><h3>Bookings by source</h3><p>Mobile app and walk-in bookings</p></div></div>{appointmentsQuery.isLoading ? <div className="insight-skeleton insight-skeleton--tall" /> : portalBookingSources.length ? <><EChart option={bookingSourceOption} height={230} ariaLabel="Bookings from the mobile app and walk-ins" /><ul>{portalBookingSources.map((row) => <li key={row.name}><span><i style={{ background: row.itemStyle.color }} />{row.name}</span><b>{formatNumber(row.value)}</b></li>)}</ul></> : <div className="chart-empty">No mobile-app or walk-in bookings were recorded this week.</div>}</article>
    </section>

    {activeMetric && <AnalyticsDetailDrawer
      key={activeMetric}
      metric={activeMetric}
      onClose={() => setActiveMetric(null)}
      money={money}
      appointments={appointments}
      currency={currency}
      moneyLoading={moneyQuery.isLoading}
      appointmentsLoading={appointmentsQuery.isLoading}
      moneyError={moneyQuery.error}
      appointmentsError={appointmentsQuery.error}
    />}
  </main>;
}
