import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FiArrowRight, FiCalendar, FiClock, FiCreditCard, FiRefreshCw } from "react-icons/fi";
import EChart from "../Components/EChart";
import { getAnalyticsBookings, getAnalyticsRevenue, getAppointmentsCreatedInsight, getMoneyReceivedInsight } from "../src/api/analytics";
import { APPOINTMENT_METRICS, REVENUE_METRICS, reportPeriodLabel } from "../src/analytics/portalReports";
import { permissionState } from "../src/auth/permissions";
import {
  MONEY_SOURCES, buildAppointmentsTrendOption,
  buildMoneyTrendOption, buildRevenueComparisonOption, comparisonDirection, comparisonLabel, comparisonSentiment, formatCurrency,
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

function ChangePill({ comparison, lowerIsBetter = false }) {
  const direction = comparisonDirection(comparison);
  const sentiment = comparisonSentiment(comparison, lowerIsBetter);
  const symbol = direction === "up" ? "↗" : direction === "down" ? "↘" : "→";
  return <span className={`change-pill change-pill--${sentiment}`}><span aria-hidden="true">{symbol}</span> {comparisonLabel(comparison)}</span>;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const canViewReports = permissionState("reports.view") !== false;
  const today = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());

  const revenueQuery = useQuery({ queryKey: ["analytics-revenue", {}], queryFn: () => getAnalyticsRevenue(), enabled: canViewReports, ...querySettings });
  const bookingsQuery = useQuery({ queryKey: ["analytics-bookings", {}], queryFn: () => getAnalyticsBookings(), enabled: canViewReports, ...querySettings });
  const moneyQuery = useQuery({ queryKey: ["portal-insights", "money-received"], queryFn: getMoneyReceivedInsight, enabled: canViewReports, ...querySettings });
  const appointmentsQuery = useQuery({ queryKey: ["portal-insights", "appointments-created"], queryFn: getAppointmentsCreatedInsight, enabled: canViewReports, ...querySettings });

  const revenue = revenueQuery.data;
  const bookings = bookingsQuery.data;
  const money = moneyQuery.data;
  const appointments = appointmentsQuery.data;
  const currency = money?.summary?.currencies?.[0]?.currency;
  const moneySummary = money?.summary?.currencies?.find((row) => row.currency === currency);
  const moneyComparison = money?.comparison?.currencies?.find((row) => row.currency === currency);
  const moneyOption = useMemo(() => buildMoneyTrendOption(money, currency, "week"), [money, currency]);
  const appointmentsOption = useMemo(() => buildAppointmentsTrendOption(appointments, "week"), [appointments]);
  const revenueOption = useMemo(() => buildRevenueComparisonOption(revenue), [revenue]);
  const moneySources = useMemo(() => (money?.breakdowns?.by_source ?? [])
    .filter((row) => row.currency === currency)
    .map((row) => ({ ...row, clientLabel: MONEY_SOURCES.find((source) => source.key === String(row.source ?? "").replaceAll("-", "_"))?.label || row.label || "Other/unclassified" })), [money, currency]);
  const salesMix = useMemo(() => (money?.breakdowns?.by_domain ?? [])
    .filter((row) => row.currency === currency && ["booking", "commerce"].includes(row.domain))
    .map((row) => ({
      name: row.domain === "booking" ? "Appointments" : "Commerce",
      description: row.domain === "booking" ? "Payments received from appointments" : "Payments received from shop orders",
      streams: MONEY_SOURCES.filter((source) => source.key !== "other" || Boolean(Number(row[source.field]))).map((source) => ({ ...source, amount: row[source.field] })),
    })), [money, currency]);

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
              <div className="summary-streams">{MONEY_SOURCES.filter((source) => source.key !== "other" || Boolean(Number(moneySummary[source.field]))).map((source) => <div key={source.key}><p className="summary-label">{source.label}</p><p className="summary-value">{formatCurrency(moneySummary[source.field], currency)}</p><ChangePill comparison={moneyComparison?.[source.field]} /><small>{formatNumber(moneySummary[source.countField])} transactions</small></div>)}</div>
              <p className="summary-footnote">{periodLabel(money.summary.period)}</p>
            </>}
            <button type="button" className="summary-link" onClick={() => navigate("/analytics#money")}>Explore receipt streams <FiArrowRight aria-hidden="true" /></button>
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

        <section className="dashboard-report-heading"><div><h2>Business performance</h2><p>Week to date, compared with the same weekdays last week.</p></div><span>{reportPeriodLabel(revenue?.week_comparison?.current_week || bookings?.week_comparison?.current_week)}</span></section>
        <section className="dashboard-business-grid">
          <article className="insight-panel dashboard-revenue-trend">
            <div className="panel-heading"><div><h2>Revenue this week</h2><p>Successful booking and commerce payments</p></div><span className="panel-chip">GHS</span></div>
            {revenueQuery.isLoading ? <LoadingBlock tall /> : revenueQuery.isError ? <ErrorState error={revenueQuery.error} retry={revenueQuery.refetch} /> : <>
              <EChart option={revenueOption} height={230} ariaLabel="Booking and commerce revenue, this week and the same days last week" />
              <div className="portal-revenue-summary">{REVENUE_METRICS.map((metric) => <div key={metric.key}><span>{metric.title}</span><b>{formatCurrency(revenue?.week_comparison?.current_week?.[metric.field])}</b><ChangePill comparison={revenue?.week_comparison?.changes?.[metric.field]} /></div>)}</div>
            </>}
            <button type="button" className="portal-report-link" onClick={() => navigate("/analytics#booking_revenue")}>Explore revenue <FiArrowRight aria-hidden="true" /></button>
          </article>

          <article className="insight-panel dashboard-booking-performance">
            <div className="panel-heading"><div><h2>Appointment activity</h2><p>Status changes recorded this week</p></div></div>
            {bookingsQuery.isLoading ? <LoadingBlock tall /> : bookingsQuery.isError ? <ErrorState error={bookingsQuery.error} retry={bookingsQuery.refetch} /> : <div className="booking-performance-grid">
              {APPOINTMENT_METRICS.map((metric) => <div key={metric.key}><span>{metric.title}</span><b>{formatNumber(bookings?.week_comparison?.current_week?.[metric.field])}</b><ChangePill comparison={bookings?.week_comparison?.changes?.[metric.field]} lowerIsBetter={metric.lowerIsBetter} /></div>)}
            </div>}
            <p className="summary-footnote">Arrival counts include transitions recorded since tracking began; historical arrivals are not backfilled.</p>
            <button type="button" className="portal-report-link" onClick={() => navigate("/analytics#arrived")}>Explore appointment activity <FiArrowRight aria-hidden="true" /></button>
          </article>
        </section>

        <article className="insight-panel dashboard-sales-mix">
          <div className="panel-heading"><div><h2>Sales from appointments and commerce</h2><p>Receipt streams stay separate in every business area</p></div>{currency && <span className="panel-chip">{currency}</span>}</div>
          {moneyQuery.isLoading ? <LoadingBlock tall /> : moneyQuery.isError ? <ErrorState error={moneyQuery.error} retry={moneyQuery.refetch} /> : salesMix.length ? <ul className="dashboard-domain-streams">{salesMix.map((row) => <li key={row.name}><span><b>{row.name}</b><small>{row.description}</small></span><div>{row.streams.map((source) => <p key={source.key}><span><i style={{ background: source.color }} />{source.label}</span><strong>{formatCurrency(source.amount, currency)}</strong></p>)}</div></li>)}</ul> : <div className="chart-empty">Appointment and commerce sales will appear after payments are recorded.</div>}
        </article>

        <section className="dashboard-chart-grid">
          <article className="insight-panel insight-panel--wide">
            <div className="panel-heading"><div><h2>Weekly pace</h2><p>Money received, compared day for day</p></div>{currency && <span className="panel-chip">{currency}</span>}</div>
            {moneyQuery.isLoading ? <LoadingBlock tall /> : moneyQuery.isError || !moneySummary ? <div className="chart-empty">Money trend will appear here when data is available.</div> : <EChart option={moneyOption} height={255} ariaLabel={`Paystack and on-site receipts in ${currency}, this week compared with the same days last week`} />}
          </article>

          <article className="insight-panel">
            <div className="panel-heading"><div><h2>How clients paid</h2><p>Payment methods grouped by receipt source</p></div></div>
            {moneyQuery.isLoading ? <LoadingBlock tall /> : moneySources.length ? <div className="dashboard-source-methods">{moneySources.map((source, sourceIndex) => <section key={`${source.source ?? "source"}-${sourceIndex}`}><header><span>{source.clientLabel}</span><strong>{formatCurrency(source.received_amount, currency)}</strong></header>{source.payment_methods?.length ? <ul>{source.payment_methods.map((method, index) => <li key={`${method.payment_method ?? "method"}-${index}`}><span>{method.payment_method_label || "Not captured"}</span><b>{formatCurrency(method.received_amount, currency)}</b></li>)}</ul> : <small>No payment-method detail.</small>}</section>)}</div> : <div className="chart-empty">Payment methods will appear once receipts are recorded.</div>}
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
