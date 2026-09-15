import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FiArrowRight, FiCalendar, FiClock, FiCreditCard, FiRefreshCw } from "react-icons/fi";
import EChart from "../Components/EChart";
import { getAnalyticsBookings, getAnalyticsRevenue, getAppointmentsCreatedInsight, getMoneyReceivedInsight } from "../src/api/analytics";
import { reportingRange } from "../src/analytics/dateRanges";
import { permissionState } from "../src/auth/permissions";
import {
  PALETTE, aggregatePaymentMethods, buildAppointmentsTrendOption, buildDonutOption,
  buildMoneyTrendOption, buildRevenueTrendOption, comparisonDirection, comparisonLabel, formatCurrency,
  formatNumber, periodLabel,
} from "../src/analytics/insightUtils";
import "./Insights.css";

const querySettings = { staleTime: 60_000, refetchOnWindowFocus: true, retry: 1 };

function LoadingBlock({ tall = false }) {
  return <div className={`insight-skeleton ${tall ? "insight-skeleton--tall" : ""}`} aria-label="Loading report" />;
}

function ErrorState({ error, retry }) {
  const status = error?.response?.status;
  const message = status === 403 ? "You do not have permission to view reports." : "This report is unavailable right now.";
  return <div className="insight-error" role="alert"><span>{message}</span>{status !== 403 && <button type="button" onClick={retry}><FiRefreshCw /> Retry</button>}</div>;
}

function ChangePill({ comparison }) {
  const direction = comparisonDirection(comparison);
  const symbol = direction === "up" ? "↗" : direction === "down" ? "↘" : "→";
  return <span className={`change-pill change-pill--${direction}`}><span aria-hidden="true">{symbol}</span> {comparisonLabel(comparison)}</span>;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const canViewReports = permissionState("reports.view") !== false;
  const weekRange = useMemo(() => reportingRange("week"), []);
  const today = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());

  const revenueQuery = useQuery({ queryKey: ["analytics-revenue", "dashboard", weekRange.current], queryFn: () => getAnalyticsRevenue(weekRange.current), enabled: canViewReports, ...querySettings });
  const bookingsQuery = useQuery({ queryKey: ["analytics-bookings", "dashboard", weekRange.current], queryFn: () => getAnalyticsBookings(weekRange.current), enabled: canViewReports, ...querySettings });
  const moneyQuery = useQuery({ queryKey: ["portal-insights", "money-received"], queryFn: getMoneyReceivedInsight, enabled: canViewReports, ...querySettings });
  const appointmentsQuery = useQuery({ queryKey: ["portal-insights", "appointments-created"], queryFn: getAppointmentsCreatedInsight, enabled: canViewReports, ...querySettings });

  const revenue = revenueQuery.data;
  const bookings = bookingsQuery.data;
  const money = moneyQuery.data;
  const appointments = appointmentsQuery.data;
  const currency = money?.summary?.currencies?.[0]?.currency;
  const moneySummary = money?.summary?.currencies?.find((row) => row.currency === currency);
  const moneyComparison = money?.comparison?.currencies?.find((row) => row.currency === currency)?.received_amount;
  const moneyOption = useMemo(() => buildMoneyTrendOption(money, currency, "week"), [money, currency]);
  const appointmentsOption = useMemo(() => buildAppointmentsTrendOption(appointments, "week"), [appointments]);
  const methods = useMemo(() => aggregatePaymentMethods(money, currency).slice(0, 6), [money, currency]);
  const methodsOption = useMemo(() => buildDonutOption(methods, { valueFormatter: (value) => formatCurrency(value, currency, true), centerLabel: "Received" }), [methods, currency]);
  const revenueOption = useMemo(() => buildRevenueTrendOption(revenue, currency || "GHS"), [revenue, currency]);
  const salesMix = useMemo(() => (money?.breakdowns?.by_domain ?? [])
    .filter((row) => row.currency === currency && ["booking", "commerce"].includes(row.domain))
    .map((row, index) => ({
      name: row.domain === "booking" ? "Appointments" : "Commerce",
      description: row.domain === "booking" ? "Payments received from appointments" : "Payments received from shop orders",
      amount: row.received_amount,
      value: Number(row.received_amount ?? 0),
      itemStyle: { color: PALETTE[index % 2] },
    })), [money, currency]);
  const salesMixOption = useMemo(() => buildDonutOption(salesMix, { valueFormatter: (value) => formatCurrency(value, currency, true), centerLabel: "Sales" }), [salesMix, currency]);

  return (
    <main className="insights-page dashboard-insights">
      <section className="dashboard-intro">
        <div><p className="dashboard-date">{today}</p><h1>A clear view of this week.</h1><p>Track money received and new appointments as they happen.</p></div>
        <button type="button" className="schedule-button" onClick={() => navigate("/schedules")}><FiClock aria-hidden="true" /> View schedule <FiArrowRight aria-hidden="true" /></button>
      </section>

      {!canViewReports ? <section className="insight-no-access">You do not have permission to view reports.</section> : <>
        <section className="dashboard-summary-grid" aria-label="This week's overview">
          <article className="summary-feature summary-feature--money">
            <div className="summary-feature__topline"><span className="summary-icon"><FiCreditCard aria-hidden="true" /></span><span>{money?.summary?.period?.label || "This week"}</span></div>
            {moneyQuery.isLoading ? <LoadingBlock /> : moneyQuery.isError ? <ErrorState error={moneyQuery.error} retry={moneyQuery.refetch} /> : !moneySummary ? <div className="summary-empty">No payment receipts were recorded in the available 90-day period.</div> : <>
              <p className="summary-label">Money received</p><p className="summary-value">{formatCurrency(moneySummary.received_amount, currency)}</p><ChangePill comparison={moneyComparison} />
              <p className="summary-footnote">{formatNumber(moneySummary.received_transaction_count)} recorded payments · {periodLabel(money.summary.period)}</p>
            </>}
            <button type="button" className="summary-link" onClick={() => navigate("/analytics#money")}>Explore money received <FiArrowRight aria-hidden="true" /></button>
          </article>

          <article className="summary-feature summary-feature--appointments">
            <div className="summary-feature__topline"><span className="summary-icon"><FiCalendar aria-hidden="true" /></span><span>{appointments?.summary?.period?.label || "This week"}</span></div>
            {appointmentsQuery.isLoading ? <LoadingBlock /> : appointmentsQuery.isError ? <ErrorState error={appointmentsQuery.error} retry={appointmentsQuery.refetch} /> : <>
              <p className="summary-label">Appointments created</p><p className="summary-value">{formatNumber(appointments?.summary?.appointments_created ?? 0)}</p><ChangePill comparison={appointments?.comparison?.appointments_created} />
              <p className="summary-footnote">Created during {periodLabel(appointments?.summary?.period)}</p>
            </>}
            <button type="button" className="summary-link" onClick={() => navigate("/analytics#appointments")}>Explore appointments <FiArrowRight aria-hidden="true" /></button>
          </article>
        </section>

        <section className="dashboard-report-heading"><div><h2>Business performance</h2><p>Operational totals from the portal’s weekly reports.</p></div><span>{weekRange.current.date_from} to {weekRange.current.date_to}</span></section>
        <section className="dashboard-business-grid">
          <article className="insight-panel dashboard-revenue-trend">
            <div className="panel-heading"><div><h2>Revenue trend</h2><p>Successful payments recorded each day this week</p></div>{currency && <span className="panel-chip">{currency}</span>}</div>
            {revenueQuery.isLoading ? <LoadingBlock tall /> : revenueQuery.isError ? <ErrorState error={revenueQuery.error} retry={revenueQuery.refetch} /> : (revenue?.revenue_by_day ?? []).length ? <><EChart option={revenueOption} height={270} ariaLabel="Daily revenue trend for this week" /><p className="dashboard-chart-total"><span>Week total</span><b>{formatCurrency(revenue.total_revenue, currency || "GHS")}</b></p></> : <div className="chart-empty">Revenue will appear after successful payments are recorded.</div>}
          </article>

          <article className="insight-panel dashboard-booking-performance">
            <div className="panel-heading"><div><h2>Booking performance</h2><p>How this week’s appointments are progressing</p></div></div>
            {bookingsQuery.isLoading ? <LoadingBlock tall /> : bookingsQuery.isError ? <ErrorState error={bookingsQuery.error} retry={bookingsQuery.refetch} /> : <div className="booking-performance-grid">
              <div><span>Bookings created</span><b>{formatNumber(bookings?.bookings_created)}</b></div>
              <div><span>Completed</span><b>{formatNumber(bookings?.appointments_completed)}</b></div>
              <div><span>Cancelled</span><b>{formatNumber(bookings?.appointments_cancelled)}</b></div>
              <div><span>No-shows</span><b>{formatNumber(bookings?.appointments_no_show)}</b></div>
              <div><span>Rescheduled</span><b>{formatNumber(bookings?.appointments_rescheduled)}</b></div>
              <div className="booking-performance-grid__rate"><span>Completion rate</span><b>{bookings?.completion_rate == null ? "—" : `${bookings.completion_rate}%`}</b></div>
            </div>}
          </article>
        </section>

        <article className="insight-panel dashboard-sales-mix">
          <div className="panel-heading"><div><h2>Sales from appointments and commerce</h2><p>Money received this week by business area</p></div>{currency && <span className="panel-chip">{currency}</span>}</div>
          {moneyQuery.isLoading ? <LoadingBlock tall /> : moneyQuery.isError ? <ErrorState error={moneyQuery.error} retry={moneyQuery.refetch} /> : salesMix.length ? <div className="dashboard-sales-mix__layout">
            <EChart option={salesMixOption} height={250} ariaLabel={`Sales received from appointments and commerce in ${currency}`} />
            <ul className="dashboard-sales-mix__list">{salesMix.map((row) => <li key={row.name}>
              <i style={{ background: row.itemStyle.color }} aria-hidden="true" />
              <span><b>{row.name}</b><small>{row.description}</small></span>
              <strong>{formatCurrency(row.amount, currency)}</strong>
            </li>)}</ul>
          </div> : <div className="chart-empty">Appointment and commerce sales will appear after payments are recorded.</div>}
        </article>

        <section className="dashboard-chart-grid">
          <article className="insight-panel insight-panel--wide">
            <div className="panel-heading"><div><h2>Weekly pace</h2><p>Money received, compared day for day</p></div>{currency && <span className="panel-chip">{currency}</span>}</div>
            {moneyQuery.isLoading ? <LoadingBlock tall /> : moneyQuery.isError || !moneySummary ? <div className="chart-empty">Money trend will appear here when data is available.</div> : <EChart option={moneyOption} height={255} ariaLabel={`Money received in ${currency}, this week compared with the same days last week`} />}
          </article>

          <article className="insight-panel">
            <div className="panel-heading"><div><h2>How clients paid</h2><p>Money received by payment method</p></div></div>
            {moneyQuery.isLoading ? <LoadingBlock tall /> : methods.length ? <><EChart option={methodsOption} height={220} ariaLabel={`Money received by payment method in ${currency}`} /><ul className="compact-legend">{methods.slice(0, 4).map((method) => <li key={method.name}><span style={{ background: method.itemStyle.color }} />{method.name}<strong>{formatCurrency(method.amount, currency)}</strong></li>)}</ul></> : <div className="chart-empty">Payment methods will appear once receipts are recorded.</div>}
          </article>

          <article className="insight-panel insight-panel--wide">
            <div className="panel-heading"><div><h2>Appointment interest</h2><p>New appointment records, compared day for day</p></div></div>
            {appointmentsQuery.isLoading ? <LoadingBlock tall /> : appointmentsQuery.isError ? <div className="chart-empty">Appointment trend will appear here when data is available.</div> : <EChart option={appointmentsOption} height={255} ariaLabel="Appointments created this week compared with the same days last week" />}
          </article>

          <article className="insight-panel dashboard-sources">
            <div className="panel-heading"><div><h2>Where bookings begin</h2><p>Recorded booking source this week</p></div></div>
            {appointmentsQuery.isLoading ? <LoadingBlock tall /> : (appointments?.breakdowns?.by_booking_source ?? []).length ? <ul className="rank-list">{appointments.breakdowns.by_booking_source.map((row, index) => <li key={`${row.booking_source ?? "unknown"}-${index}`}><span className="rank-number">{String(index + 1).padStart(2, "0")}</span><span><strong>{row.label}</strong><small>{row.percentage_of_total ?? "0"}% of appointments</small></span><b>{formatNumber(row.appointments_created)}</b></li>)}</ul> : <div className="chart-empty">Booking sources will appear once appointments are created.</div>}
          </article>
        </section>

        <button type="button" className="analytics-cta" onClick={() => navigate("/analytics")}><span><strong>See the complete story</strong><small>Explore longer trends, payment sources and booking channels.</small></span><FiArrowRight aria-hidden="true" /></button>
      </>}
    </main>
  );
}
