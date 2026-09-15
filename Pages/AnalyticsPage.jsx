import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FiArrowUpRight, FiCalendar, FiCheckCircle, FiCreditCard, FiRefreshCw, FiSlash } from "react-icons/fi";
import AnalyticsDetailDrawer from "../Components/AnalyticsDetailDrawer";
import BookingLeaderboard from "../Components/BookingLeaderboard";
import EChart from "../Components/EChart";
import _axios from "../src/api/_axios";
import { getAnalyticsBookings, getAppointmentsCreatedInsight, getMoneyReceivedInsight } from "../src/api/analytics";
import { reportingRange } from "../src/analytics/dateRanges";
import { permissionState } from "../src/auth/permissions";
import { PALETTE, aggregatePaymentMethods, buildDonutOption, comparisonDirection, comparisonLabel, comparisonSentiment, formatCurrency, formatNumber, periodLabel } from "../src/analytics/insightUtils";
import "./Insights.css";

const querySettings = { staleTime: 60_000, refetchOnWindowFocus: true, retry: 1 };

function integerComparison(current, previous) {
  const currentValue = Number(current) || 0;
  const previousValue = Number(previous) || 0;
  if (!previousValue) return { percentage_change: null, reason: "NO_PREVIOUS_BASE" };
  return { percentage_change: (((currentValue - previousValue) / previousValue) * 100).toFixed(2), reason: null };
}

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
    return requestedReport === "appointments" ? "created" : ["money", "created", "completed", "cancelled"].includes(requestedReport) ? requestedReport : null;
  });
  const weekRange = useMemo(() => reportingRange("week"), []);

  const moneyQuery = useQuery({ queryKey: ["portal-insights", "money-received"], queryFn: getMoneyReceivedInsight, enabled: canViewReports, ...querySettings });
  const appointmentsQuery = useQuery({ queryKey: ["portal-insights", "appointments-created"], queryFn: getAppointmentsCreatedInsight, enabled: canViewReports, ...querySettings });
  const lifecycleCurrent = useQuery({ queryKey: ["analytics-bookings", "headline", "current", weekRange.current], queryFn: () => getAnalyticsBookings(weekRange.current), enabled: canViewReports, ...querySettings });
  const lifecyclePrevious = useQuery({ queryKey: ["analytics-bookings", "headline", "previous", weekRange.previous], queryFn: () => getAnalyticsBookings(weekRange.previous), enabled: canViewReports, ...querySettings });
  const servicesQuery = useQuery({ queryKey: ["analytics-service-directory"], queryFn: () => _axios.get("/api/portal/v1/booking/services/").then((response) => Array.isArray(response.data) ? response.data : response.data?.results ?? []), enabled: canViewReports, staleTime: 5 * 60_000, retry: 1 });
  const staffQuery = useQuery({ queryKey: ["analytics-staff-directory"], queryFn: () => _axios.get("/api/portal/v1/accounts/staff/").then((response) => Array.isArray(response.data) ? response.data : response.data?.results ?? []), enabled: canViewReports, staleTime: 5 * 60_000, retry: 1 });

  const money = moneyQuery.data;
  const appointments = appointmentsQuery.data;
  const currency = money?.summary?.currencies?.[0]?.currency;
  const moneySummary = money?.summary?.currencies?.find((row) => row.currency === currency);
  const moneyComparison = money?.comparison?.currencies?.find((row) => row.currency === currency)?.received_amount;
  const lifecycleLoading = lifecycleCurrent.isLoading || lifecyclePrevious.isLoading;
  const completed = lifecycleCurrent.data?.appointments_completed;
  const cancelled = lifecycleCurrent.data?.appointments_cancelled;
  const completedComparison = integerComparison(completed, lifecyclePrevious.data?.appointments_completed);
  const cancelledComparison = integerComparison(cancelled, lifecyclePrevious.data?.appointments_cancelled);
  const primaryMethod = useMemo(() => aggregatePaymentMethods(money, currency)[0], [money, currency]);
  const primaryBookingSource = appointments?.breakdowns?.by_booking_source?.[0];
  const serviceNames = useMemo(() => Object.fromEntries((servicesQuery.data ?? []).map((service) => [String(service.id), service.name || service.service_name || `Service ${service.id}`])), [servicesQuery.data]);
  const staffNames = useMemo(() => Object.fromEntries((staffQuery.data ?? []).map((staff) => [String(staff.id), staff.full_name || staff.name || `Team member ${staff.id}`])), [staffQuery.data]);
  const topServices = useMemo(() => [...(lifecycleCurrent.data?.bookings_by_service ?? [])].sort((a, b) => Number(b.count) - Number(a.count)).slice(0, 10).map((row) => ({ name: row.service_name || serviceNames[String(row.service_id)] || `Service ${row.service_id}`, value: row.count })), [lifecycleCurrent.data, serviceNames]);
  const topStaff = useMemo(() => [...(lifecycleCurrent.data?.bookings_by_staff ?? [])].sort((a, b) => Number(b.count) - Number(a.count)).slice(0, 10).map((row) => ({ name: row.staff_name || staffNames[String(row.staff_id)] || `Team member ${row.staff_id}`, value: row.count })), [lifecycleCurrent.data, staffNames]);
  const portalBookingSources = useMemo(() => (appointments?.breakdowns?.by_booking_source ?? []).filter((row) => {
    const key = String(row.booking_source ?? row.label ?? "").toLowerCase().replaceAll("_", "-");
    return key === "online" || key === "mobile-app" || key === "walk-in" || key.includes("walk-in");
  }).map((row, index) => {
    const key = String(row.booking_source ?? row.label ?? "").toLowerCase().replaceAll("_", "-");
    return { name: key === "online" || key === "mobile-app" ? "Mobile app" : "Walk-in", value: row.appointments_created, itemStyle: { color: PALETTE[index % PALETTE.length] } };
  }), [appointments]);
  const bookingSourceOption = useMemo(() => buildDonutOption(portalBookingSources, { centerLabel: "Bookings" }), [portalBookingSources]);
  const refreshing = moneyQuery.isFetching || appointmentsQuery.isFetching || lifecycleCurrent.isFetching || lifecyclePrevious.isFetching || servicesQuery.isFetching || staffQuery.isFetching;

  const refetchAll = () => {
    moneyQuery.refetch();
    appointmentsQuery.refetch();
    lifecycleCurrent.refetch();
    lifecyclePrevious.refetch();
    servicesQuery.refetch();
    staffQuery.refetch();
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
      <MetricCard title="Completed appointments" period="This week" value={formatNumber(completed)} comparison={completedComparison} icon={FiCheckCircle} accent="green" loading={lifecycleLoading} onClick={() => setActiveMetric("completed")} />
      <MetricCard title="Cancelled appointments" period="This week" value={formatNumber(cancelled)} comparison={cancelledComparison} icon={FiSlash} accent="rose" loading={lifecycleLoading} lowerIsBetter onClick={() => setActiveMetric("cancelled")} />
    </section>

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
        <span>Appointment outcomes</span>
        <strong>{lifecycleCurrent.data?.completion_rate == null ? "Not available" : `${lifecycleCurrent.data.completion_rate}% completed`}</strong>
        <small>{lifecycleCurrent.data?.cancellation_rate == null ? "Cancellation rate is not available." : `${lifecycleCurrent.data.cancellation_rate}% cancelled this week`}</small>
      </article>
    </section>

    <section className="analytics-booking-report" aria-labelledby="booking-performance-title">
      <header className="analytics-booking-report__heading"><div><p>Portal bookings</p><h2 id="booking-performance-title">Booking performance</h2><span>The operational view from the previous analytics report, now paired with source and ranking detail.</span></div><small>{weekRange.current.date_from} to {weekRange.current.date_to}</small></header>

      {lifecycleCurrent.isError ? <div className="report-error"><FiSlash aria-hidden="true" /><div><strong>Booking performance is unavailable.</strong><span>The other analytics reports remain available.</span></div><button type="button" onClick={() => lifecycleCurrent.refetch()}>Retry</button></div> : <>
        <div className="booking-kpi-grid">
          <article><span>Bookings created</span><b>{lifecycleCurrent.isLoading ? "—" : formatNumber(lifecycleCurrent.data?.bookings_created)}</b></article>
          <article><span>Completed</span><b>{lifecycleCurrent.isLoading ? "—" : formatNumber(lifecycleCurrent.data?.appointments_completed)}</b></article>
          <article className="booking-kpi-grid__cancelled"><span>Cancelled</span><b>{lifecycleCurrent.isLoading ? "—" : formatNumber(lifecycleCurrent.data?.appointments_cancelled)}</b></article>
          <article><span>No-shows</span><b>{lifecycleCurrent.isLoading ? "—" : formatNumber(lifecycleCurrent.data?.appointments_no_show)}</b></article>
          <article><span>Rescheduled</span><b>{lifecycleCurrent.isLoading ? "—" : formatNumber(lifecycleCurrent.data?.appointments_rescheduled)}</b></article>
          <article className="booking-kpi-grid__rate"><span>Booking completion rate</span><b>{lifecycleCurrent.isLoading || lifecycleCurrent.data?.completion_rate == null ? "—" : `${lifecycleCurrent.data.completion_rate}%`}</b></article>
        </div>

        <div className="analytics-booking-detail-grid">
          <article className="report-panel analytics-source-panel"><div className="panel-heading"><div><h3>Bookings by source</h3><p>Mobile app and walk-in bookings</p></div></div>{appointmentsQuery.isLoading ? <div className="insight-skeleton insight-skeleton--tall" /> : portalBookingSources.length ? <><EChart option={bookingSourceOption} height={230} ariaLabel="Bookings from the mobile app and walk-ins" /><ul>{portalBookingSources.map((row) => <li key={row.name}><span><i style={{ background: row.itemStyle.color }} />{row.name}</span><b>{formatNumber(row.value)}</b></li>)}</ul></> : <div className="chart-empty">No mobile-app or walk-in bookings were recorded this week.</div>}</article>
          <article className="report-panel"><div className="panel-heading"><div><h3>Top 10 staff</h3><p>Team members receiving the most bookings</p></div></div>{lifecycleCurrent.isLoading || staffQuery.isLoading ? <div className="insight-skeleton insight-skeleton--tall" /> : <BookingLeaderboard rows={topStaff} emptyMessage="Top staff will appear after bookings are created." />}</article>
          <article className="report-panel"><div className="panel-heading"><div><h3>Top 10 services</h3><p>Services booked most frequently</p></div></div>{lifecycleCurrent.isLoading || servicesQuery.isLoading ? <div className="insight-skeleton insight-skeleton--tall" /> : <BookingLeaderboard rows={topServices} emptyMessage="Top services will appear after bookings are created." />}</article>
        </div>
      </>}
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
