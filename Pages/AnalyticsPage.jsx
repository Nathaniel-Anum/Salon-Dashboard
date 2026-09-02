import React, { useState, useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  FiTrendingUp, FiShoppingBag, FiCalendar, FiCreditCard, FiBell,
  FiRefreshCw, FiAlertCircle, FiFilter, FiCheck, FiX, FiRotateCw,
  FiActivity, FiPackage, FiShoppingCart, FiTruck, FiZap,
  FiAlertTriangle, FiEye, FiUsers, FiDollarSign, FiBookmark,
  FiBarChart2, FiTag, FiArrowRight,
} from "react-icons/fi";
import {
  getAnalyticsOverview,
  getAnalyticsRevenue,
  getAnalyticsBookings,
  getAnalyticsCommerce,
  getAnalyticsPayments,
} from "../src/api/analytics";
import _axios from "../src/api/_axios";
import PortalSelect from "../Components/PortalSelect";

/* ─── helpers ─── */
const fmt = (val, prefix = "GH₵") => {
  if (val === null || val === undefined) return "N/A";
  const n = parseFloat(val);
  if (isNaN(n)) return "N/A";
  if (n >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${prefix}${(n / 1_000).toFixed(1)}K`;
  return `${prefix}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const pct = (val) => (val === null || val === undefined ? "N/A" : `${val}%`);
const num = (val) => (val === null || val === undefined ? "—" : val.toLocaleString());

function toLocalDate(d) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
const today = toLocalDate(new Date());
const thirtyDaysAgo = toLocalDate(new Date(Date.now() - 29 * 86400000));

/* ─── design tokens ─── */
const GOLD    = "#BBA14F";
const DARK    = "#272727";
const MUTED   = "#987554";
const BG      = "#FDFAF5";
const CARD    = "#FDFAF5";
const BORDER  = "rgba(187,161,79,0.18)";
const SHADOW  = "0 4px 24px rgba(39,39,39,0.06)";


/* ═══════════════════════════════════════
   SUB-COMPONENTS
═══════════════════════════════════════ */

/* Gold left-bar section divider */
function SectionHeader({ icon, title }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-1 h-7 rounded-full" style={{ background: "linear-gradient(180deg, #BBA14F, #987554)" }} />
      <span style={{ color: "#BBA14F", fontSize: 18 }}>{icon}</span>
      <h2
        className="text-xl font-semibold tracking-tight"
        style={{ color: "#272727", fontFamily: "'Playfair Display', serif" }}
      >
        {title}
      </h2>
    </div>
  );
}

/* Premium KPI card — mirrors GlassCard */
function MetricCard({ label, value, icon, sub, loading, accent = "#BBA14F" }) {
  return (
    <div
      className="relative p-5 rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1"
      style={{
        background: "#FDFAF5",
        border: "1px solid rgba(187,161,79,0.18)",
        boxShadow: "0 4px 24px rgba(39,39,39,0.06)",
      }}
    >
      <div
        className="absolute top-0 right-0 w-20 h-20 rounded-bl-full pointer-events-none"
        style={{ background: accent, opacity: 0.07 }}
      />
      <div className="flex items-start justify-between mb-3">
        <p
          className="text-xs font-medium tracking-wide uppercase"
          style={{ color: "#987554", fontFamily: "'Poppins', sans-serif" }}
        >
          {label}
        </p>
        {icon && (
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
            style={{ background: `${accent}18`, color: accent }}
          >
            {icon}
          </div>
        )}
      </div>
      {loading ? (
        <div className="h-8 w-32 rounded-lg animate-pulse" style={{ background: "rgba(187,161,79,0.15)" }} />
      ) : (
        <p className="text-2xl font-bold leading-none" style={{ color: "#272727", fontFamily: "'Playfair Display', serif" }}>
          {value}
        </p>
      )}
      {sub && !loading && (
        <p className="text-xs mt-1.5" style={{ color: "#987554", fontFamily: "'Poppins', sans-serif" }}>{sub}</p>
      )}
    </div>
  );
}

/* Section-level error */
function SectionError({ onRetry }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 py-10 rounded-2xl"
      style={{
        background: "#FDFAF5",
        border: "1px solid rgba(220,53,69,0.18)",
        boxShadow: "0 4px 24px rgba(39,39,39,0.06)",
      }}
    >
      <FiAlertCircle size={26} color="#d97706" />
      <p className="text-sm font-medium" style={{ color: "#987554" }}>Failed to load this section.</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80"
          style={{
            background: "rgba(187,161,79,0.12)",
            color: "#BBA14F",
            border: "1px solid rgba(187,161,79,0.18)",
          }}
        >
          <FiRefreshCw size={12} /> Retry
        </button>
      )}
    </div>
  );
}

/* Key→Value breakdown rows */
function BreakdownList({ data, formatValue }) {
  if (!data || !Object.keys(data).length)
    return <p className="text-xs py-4 text-center" style={{ color: "#987554" }}>No data for this period.</p>;
  return (
    <div className="divide-y" style={{ borderColor: "rgba(187,161,79,0.18)" }}>
      {Object.entries(data).map(([k, v]) => (
        <div key={k} className="flex items-center justify-between py-2.5">
          <span className="text-sm capitalize" style={{ color: "#272727", fontFamily: "'Poppins', sans-serif" }}>
            {k.replace(/_/g, " ")}
          </span>
          <span className="text-sm font-semibold" style={{ color: "#BBA14F" }}>
            {formatValue ? formatValue(v) : v}
          </span>
        </div>
      ))}
    </div>
  );
}

/* Titled inner panel */
function Panel({ title, children, className = "" }) {
  return (
    <div
      className={`p-5 rounded-2xl ${className}`}
      style={{
        background: "#FDFAF5",
        border: "1px solid rgba(187,161,79,0.18)",
        boxShadow: "0 4px 24px rgba(39,39,39,0.06)",
      }}
    >
      {title && (
        <p
          className="text-xs font-semibold uppercase tracking-widest mb-4"
          style={{ color: "#987554", fontFamily: "'Poppins', sans-serif" }}
        >
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

/* Animated progress bar row */
function RateRow({ label, val }) {
  const width = val !== null && val !== undefined ? Math.min(parseFloat(val), 100) : null;
  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-sm" style={{ color: "#272727", fontFamily: "'Poppins', sans-serif" }}>{label}</span>
        <span className="text-sm font-semibold" style={{ color: "#BBA14F" }}>{pct(val)}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(187,161,79,0.13)" }}>
        {width !== null && (
          <div
            className="h-full rounded-full"
            style={{
              width: `${width}%`,
              background: "linear-gradient(90deg, #BBA14F, #987554)",
              transition: "width 0.8s ease",
            }}
          />
        )}
      </div>
    </div>
  );
}

/* Shimmer skeleton */
function Skeleton({ height = 48 }) {
  return (
    <div
      className="w-full rounded-xl animate-pulse"
      style={{ height, background: "rgba(187,161,79,0.1)" }}
    />
  );
}

/* Chart tooltip */
const ChartTooltip = ({ active, payload, label, isMoney }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="px-3 py-2 rounded-xl text-xs shadow-xl"
      style={{ background: "#272727", color: "#fff", border: "1px solid rgba(187,161,79,0.4)" }}
    >
      <p className="font-semibold mb-1" style={{ color: "#BBA14F" }}>{label}</p>
      {payload.map((pt, i) => (
        <p key={i}>{isMoney ? fmt(pt.value) : pt.value}</p>
      ))}
    </div>
  );
};

/* ═══════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════ */
export default function AnalyticsPage() {
  const [dateFrom, setDateFrom]         = useState(thirtyDaysAgo);
  const [dateTo, setDateTo]             = useState(today);
  const [showFilters, setShowFilters]   = useState(false);
  const [sourceFilter, setSourceFilter] = useState("");

  const filters = useMemo(
    () => ({ date_from: dateFrom, date_to: dateTo, ...(sourceFilter ? { source: sourceFilter } : {}) }),
    [dateFrom, dateTo, sourceFilter]
  );

  const [overviewQ, revenueQ, bookingsQ, commerceQ, paymentsQ, staffQ, servicesQ] = useQueries({
    queries: [
      { queryKey: ["analytics-overview", filters], queryFn: () => getAnalyticsOverview(filters), retry: 1 },
      { queryKey: ["analytics-revenue",  filters], queryFn: () => getAnalyticsRevenue(filters),  retry: 1 },
      { queryKey: ["analytics-bookings", filters], queryFn: () => getAnalyticsBookings(filters), retry: 1 },
      { queryKey: ["analytics-commerce", filters], queryFn: () => getAnalyticsCommerce(filters), retry: 1 },
      { queryKey: ["analytics-payments", filters], queryFn: () => getAnalyticsPayments(filters), retry: 1 },
      {
        queryKey: ["staff"],
        queryFn: () =>
          _axios.get("/api/portal/v1/accounts/staff/").then((r) =>
            Array.isArray(r.data) ? r.data : (r.data?.results ?? [])
          ),
        staleTime: 5 * 60_000,
      },
      {
        queryKey: ["services"],
        queryFn: () =>
          _axios.get("/api/portal/v1/booking/services/").then((r) =>
            Array.isArray(r.data) ? r.data : (r.data?.results ?? [])
          ),
        staleTime: 5 * 60_000,
      },
    ],
  });

  const o = overviewQ.data;
  const r = revenueQ.data;
  const b = bookingsQ.data;
  const c = commerceQ.data;
  const p = paymentsQ.data;

  const revenueChartData = useMemo(() => {
    if (!r?.revenue_by_day?.length) return [];
    return r.revenue_by_day.map((d) => ({ date: d.date.slice(5), revenue: parseFloat(d.revenue) || 0 }));
  }, [r]);

  const staffNameMap = useMemo(
    () =>
      Object.fromEntries(
        (staffQ.data || []).map((staff) => [
          String(staff.id),
          staff.full_name || staff.name || staff.email || `Staff #${staff.id}`,
        ])
      ),
    [staffQ.data]
  );

  const serviceNameMap = useMemo(
    () =>
      Object.fromEntries(
        (servicesQ.data || []).map((service) => [
          String(service.id),
          service.name || service.service_name || `Service #${service.id}`,
        ])
      ),
    [servicesQ.data]
  );

  const effectiveMeta = o?.meta || r?.meta;

  return (
    <div className="min-h-screen w-full" style={{ background: "#FDFAF5", fontFamily: "'Poppins', sans-serif" }}>

      {/* ── Dark hero banner ── */}
      <div
        className="relative overflow-hidden px-6 py-8 sm:px-10 sm:py-10"
        style={{
          background: "linear-gradient(120deg, #272727 0%, #3a2e1e 60%, #4a3a22 100%)",
          boxShadow: "0 8px 32px rgba(39,39,39,0.18)",
        }}
      >
        {/* dot grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(187,161,79,0.14) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        {/* gold radial glow */}
        <div
          className="absolute right-0 top-0 h-full w-1/2 pointer-events-none"
          style={{ background: "radial-gradient(circle at 85% 50%, rgba(187,161,79,0.1), transparent 65%)" }}
        />

        <div className="relative z-10 max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div>
            <p
              className="text-xs tracking-[0.25em] uppercase mb-1"
              style={{ color: "#BBA14F", fontFamily: "'Poppins', sans-serif" }}
            >
              Business Intelligence
            </p>
            <h1
              className="font-bold leading-snug"
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "clamp(1.8rem, 3.5vw, 2.5rem)",
                background: "linear-gradient(90deg, #f5e6c8 0%, #e8c96a 50%, #d4a853 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Analytics Dashboard
            </h1>
            {effectiveMeta && (
              <p className="text-white/45 text-xs mt-1.5" style={{ fontFamily: "'Poppins', sans-serif" }}>
                {effectiveMeta.date_from} → {effectiveMeta.date_to}
                {effectiveMeta.default_date_range_days && ` · last ${effectiveMeta.default_date_range_days} days`}
              </p>
            )}
          </div>

          {/* Date range + filter toggle */}
          <div
            className="flex flex-col gap-2 px-4 py-3 rounded-2xl"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(187,161,79,0.25)" }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "rgba(187,161,79,0.7)" }}>
              Date Range
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium" style={{ color: "rgba(255,255,255,0.45)", fontFamily: "'Poppins', sans-serif" }}>From</label>
                <input
                  type="date"
                  value={dateFrom}
                  max={dateTo}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="cursor-pointer text-xs px-3 py-2 rounded-xl outline-none"
                  style={{
                    background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(187,161,79,0.45)",
                    color: "#f0d98a",
                    fontFamily: "'Poppins', sans-serif",
                  }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-medium" style={{ color: "rgba(255,255,255,0.45)", fontFamily: "'Poppins', sans-serif" }}>To</label>
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="cursor-pointer text-xs px-3 py-2 rounded-xl outline-none"
                  style={{
                    background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(187,161,79,0.45)",
                    color: "#f0d98a",
                    fontFamily: "'Poppins', sans-serif",
                  }}
                />
              </div>
              <button
                onClick={() => setShowFilters((v) => !v)}
                className="cursor-pointer flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 hover:opacity-90"
                style={{
                  background: showFilters ? "rgba(187,161,79,0.35)" : "rgba(187,161,79,0.15)",
                  border: "1px solid rgba(187,161,79,0.5)",
                  color: "#f0d98a",
                }}
              >
                <FiFilter size={13} /> {showFilters ? "Hide Filters" : "Filters"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Source filter panel ── */}
      {showFilters && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div
            className="flex flex-wrap gap-4 p-4 rounded-2xl"
            style={{
              background: "#FDFAF5",
              border: "1px solid rgba(187,161,79,0.18)",
              boxShadow: "0 4px 24px rgba(39,39,39,0.06)",
            }}
          >
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: "#987554" }}>Source</label>
              <PortalSelect
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="text-xs px-3 py-2 rounded-xl outline-none"
                style={{
                  background: "#FDFAF5",
                  border: "1px solid rgba(187,161,79,0.18)",
                  color: "#272727",
                  fontFamily: "'Poppins', sans-serif",
                }}
              >
                <option value="">All sources</option>
                <option value="app">App</option>
                <option value="portal">Portal</option>
                <option value="public">Public</option>
                <option value="webhook">Webhook</option>
                <option value="system">System</option>
              </PortalSelect>
            </div>
          </div>
        </div>
      )}

      {/* ── Page body ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">

        {/* ────────────────────────────────────────
            § 1  Revenue Summary
        ──────────────────────────────────────── */}
        <section>
          <SectionHeader icon={<FiTrendingUp />} title="Revenue Summary" />

          {overviewQ.isError && revenueQ.isError ? (
            <SectionError onRetry={() => { overviewQ.refetch(); revenueQ.refetch(); }} />
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
                <MetricCard label="Gross Revenue"       value={fmt(o?.gross_revenue)}            icon={<FiTrendingUp />}   loading={overviewQ.isLoading} />
                <MetricCard label="Booking Revenue"     value={fmt(o?.booking_revenue)}          icon={<FiBookmark />}     loading={overviewQ.isLoading} />
                <MetricCard label="Commerce Revenue"    value={fmt(o?.commerce_revenue)}         icon={<FiShoppingBag />}  loading={overviewQ.isLoading} />
                <MetricCard label="Successful Payments" value={num(o?.successful_payment_count)} icon={<FiCheck />}        loading={overviewQ.isLoading} accent="#22863a" />
                <MetricCard label="Failed Payments"     value={num(o?.failed_payment_count)}     icon={<FiX />}            loading={overviewQ.isLoading} accent="#cb2431" />
                <MetricCard label="Success Rate"        value={pct(o?.payment_success_rate)}     icon={<FiActivity />}     loading={overviewQ.isLoading} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <Panel title="Revenue by Day" className="lg:col-span-2">
                  {revenueQ.isLoading ? <Skeleton height={200} /> :
                   revenueQ.isError   ? <SectionError onRetry={revenueQ.refetch} /> :
                   !revenueChartData.length ? (
                    <p className="text-xs py-10 text-center" style={{ color: "#987554" }}>No revenue data for this period.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={revenueChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(187,161,79,0.1)" />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#987554" }} tickLine={false} axisLine={false} />
                        <YAxis
                          tick={{ fontSize: 10, fill: "#987554" }} tickLine={false} axisLine={false}
                          tickFormatter={(v) => `GH₵${(v / 1000).toFixed(0)}K`}
                        />
                        <Tooltip content={<ChartTooltip isMoney />} />
                        <Bar dataKey="revenue" fill="#BBA14F" radius={[4, 4, 0, 0]} maxBarSize={32} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </Panel>

                <div className="flex flex-col gap-4">
                  <Panel title="By Payment Channel">
                    {revenueQ.isLoading ? <Skeleton height={60} /> : <BreakdownList data={r?.revenue_by_payment_channel} formatValue={fmt} />}
                  </Panel>
                  <Panel title="By Source">
                    {revenueQ.isLoading ? <Skeleton height={60} /> : <BreakdownList data={r?.revenue_by_source} formatValue={fmt} />}
                  </Panel>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <MetricCard label="Avg Order Value"       value={fmt(r?.average_order_value)}    icon={<FiTag />}           loading={revenueQ.isLoading} />
                <MetricCard label="Avg Booking Value"     value={fmt(r?.average_booking_value)}  icon={<FiCalendar />}      loading={revenueQ.isLoading} />
                <MetricCard label="Failed Payment Value"  value={fmt(r?.failed_payment_value)}   icon={<FiAlertTriangle />} loading={revenueQ.isLoading} accent="#cb2431" />
                <MetricCard label="Expired Checkout Val." value={fmt(r?.expired_checkout_value)} icon={<FiZap />}           loading={revenueQ.isLoading} accent="#987554" />
              </div>
            </div>
          )}
        </section>

        {/* ────────────────────────────────────────
            § 2  Booking Performance
        ──────────────────────────────────────── */}
        <section>
          <SectionHeader icon={<FiCalendar />} title="Booking Performance" />

          {bookingsQ.isError ? <SectionError onRetry={bookingsQ.refetch} /> : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
                <MetricCard label="Bookings Created" value={num(b?.bookings_created)}         icon={<FiCalendar />}      loading={bookingsQ.isLoading} />
                <MetricCard label="Completed"        value={num(b?.appointments_completed)}   icon={<FiCheck />}         loading={bookingsQ.isLoading} accent="#22863a" />
                <MetricCard label="Cancelled"        value={num(b?.appointments_cancelled)}   icon={<FiX />}             loading={bookingsQ.isLoading} accent="#cb2431" />
                <MetricCard label="No-shows"         value={num(b?.appointments_no_show)}     icon={<FiAlertTriangle />} loading={bookingsQ.isLoading} accent="#d97706" />
                <MetricCard label="Rescheduled"      value={num(b?.appointments_rescheduled)} icon={<FiRotateCw />}      loading={bookingsQ.isLoading} />
                <MetricCard label="Completion Rate"  value={pct(b?.completion_rate)}          icon={<FiBarChart2 />}     loading={bookingsQ.isLoading} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                <Panel title="Outcome Rates">
                  {bookingsQ.isLoading ? <Skeleton height={96} /> : (
                    <div className="space-y-3">
                      <RateRow label="Completion Rate"   val={b?.completion_rate}   />
                      <RateRow label="Cancellation Rate" val={b?.cancellation_rate} />
                      <RateRow label="No-show Rate"      val={b?.no_show_rate}      />
                    </div>
                  )}
                </Panel>
                <Panel title="Bookings by Service">
                  {bookingsQ.isLoading ? <Skeleton height={96} /> :
                   !b?.bookings_by_service?.length ? (
                    <p className="text-xs py-4 text-center" style={{ color: "#987554" }}>No service data.</p>
                  ) : (
                    <div className="divide-y" style={{ borderColor: "rgba(187,161,79,0.18)" }}>
                      {b.bookings_by_service.map((s) => (
                        <div key={s.service_id} className="flex justify-between py-2.5">
                          <span className="text-sm" style={{ color: "#272727" }}>
                            {s.service_name || serviceNameMap[String(s.service_id)] || `Service #${s.service_id}`}
                          </span>
                          <span className="text-sm font-semibold" style={{ color: "#BBA14F" }}>{s.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>
                <Panel title="Bookings by Staff">
                  {bookingsQ.isLoading ? <Skeleton height={96} /> :
                   !b?.bookings_by_staff?.length ? (
                    <p className="text-xs py-4 text-center" style={{ color: "#987554" }}>No staff data.</p>
                  ) : (
                    <div className="divide-y" style={{ borderColor: "rgba(187,161,79,0.18)" }}>
                      {b.bookings_by_staff.map((s) => (
                        <div key={s.staff_id} className="flex justify-between py-2.5">
                          <span className="text-sm" style={{ color: "#272727" }}>
                            {s.staff_name || staffNameMap[String(s.staff_id)] || `Staff #${s.staff_id}`}
                          </span>
                          <span className="text-sm font-semibold" style={{ color: "#BBA14F" }}>{s.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <MetricCard label="Booking Revenue"   value={fmt(b?.booking_revenue)}      icon={<FiDollarSign />} loading={bookingsQ.isLoading} />
                <MetricCard label="Waitlist Created"  value={num(b?.waitlist_created)}      icon={<FiUsers />}      loading={bookingsQ.isLoading} />
                <MetricCard label="Waitlist Promoted" value={num(b?.waitlist_promoted)}     icon={<FiArrowRight />} loading={bookingsQ.isLoading} accent="#22863a" />
                <MetricCard label="Hold Expired"      value={num(b?.waitlist_hold_expired)} icon={<FiZap />}        loading={bookingsQ.isLoading} accent="#d97706" />
              </div>
            </div>
          )}
        </section>

        {/* ────────────────────────────────────────
            § 3  Commerce Performance
        ──────────────────────────────────────── */}
        <section>
          <SectionHeader icon={<FiShoppingBag />} title="Commerce Performance" />

          {commerceQ.isError ? <SectionError onRetry={commerceQ.refetch} /> : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
                <MetricCard label="Checkout Started"  value={num(c?.checkout_started_count)}            icon={<FiShoppingCart />} loading={commerceQ.isLoading} />
                <MetricCard label="Orders Confirmed"  value={num(c?.order_confirmed_count)}             icon={<FiPackage />}      loading={commerceQ.isLoading} accent="#22863a" />
                <MetricCard label="Orders Dispatched" value={num(c?.order_dispatched_count)}            icon={<FiTruck />}        loading={commerceQ.isLoading} />
                <MetricCard label="Conversion Rate"   value={pct(c?.checkout_to_order_conversion_rate)} icon={<FiActivity />}     loading={commerceQ.isLoading} />
                <MetricCard label="Avg Order Value"   value={fmt(c?.average_order_value)}               icon={<FiTag />}          loading={commerceQ.isLoading} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <Panel title="Top Products by Quantity (Cart Adds)">
                  {commerceQ.isLoading ? <Skeleton height={180} /> :
                   !c?.top_products_by_quantity?.length ? (
                    <p className="text-xs py-10 text-center" style={{ color: "#987554" }}>No product data for this period.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart
                        data={c.top_products_by_quantity.map((item) => ({ name: `#${item.product_id}`, qty: item.quantity }))}
                        margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(187,161,79,0.1)" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#987554" }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: "#987554" }} tickLine={false} axisLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="qty" fill="#BBA14F" radius={[5, 5, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </Panel>

                <Panel title="Commerce Funnel">
                  {commerceQ.isLoading ? <Skeleton height={180} /> : (
                    <div className="space-y-4 pt-1">
                      {[
                        { label: "Cart Items Added",  val: c?.cart_item_added_count  },
                        { label: "Checkout Started",  val: c?.checkout_started_count },
                        { label: "Orders Confirmed",  val: c?.order_confirmed_count  },
                        { label: "Orders Dispatched", val: c?.order_dispatched_count },
                      ].map(({ label, val }) => {
                        const total = c?.cart_item_added_count || 0;
                        const w = total && val ? Math.min((val / total) * 100, 100) : 0;
                        return (
                          <div key={label}>
                            <div className="flex justify-between text-xs mb-1.5">
                              <span style={{ color: "#272727" }}>{label}</span>
                              <span className="font-semibold" style={{ color: "#BBA14F" }}>{num(val)}</span>
                            </div>
                            <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(187,161,79,0.13)" }}>
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${w}%`,
                                  background: "linear-gradient(90deg, #BBA14F, #987554)",
                                  transition: "width 0.8s ease",
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Panel>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <MetricCard label="Cart Items Added"   value={num(c?.cart_item_added_count)}   icon={<FiShoppingCart />} loading={commerceQ.isLoading} />
                <MetricCard label="Cart Items Removed" value={num(c?.cart_item_removed_count)} icon={<FiX />}            loading={commerceQ.isLoading} accent="#cb2431" />
                <MetricCard label="Checkout Expired"   value={num(c?.checkout_expired_count)}  icon={<FiZap />}          loading={commerceQ.isLoading} accent="#d97706" />
              </div>
            </div>
          )}
        </section>

        {/* ────────────────────────────────────────
            § 4  Payment Performance
        ──────────────────────────────────────── */}
        <section>
          <SectionHeader icon={<FiCreditCard />} title="Payment Performance" />

          {paymentsQ.isError ? <SectionError onRetry={paymentsQ.refetch} /> : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
                <MetricCard label="Payments Started" value={num(p?.payment_started_count)}    icon={<FiZap />}           loading={paymentsQ.isLoading} />
                <MetricCard label="Succeeded"        value={num(p?.payment_succeeded_count)}  icon={<FiCheck />}         loading={paymentsQ.isLoading} accent="#22863a" />
                <MetricCard label="Failed"           value={num(p?.payment_failed_count)}     icon={<FiX />}             loading={paymentsQ.isLoading} accent="#cb2431" />
                <MetricCard label="Success Rate"     value={pct(p?.payment_success_rate)}     icon={<FiActivity />}      loading={paymentsQ.isLoading} />
                <MetricCard label="Failed Value"     value={fmt(p?.failed_payment_value)}     icon={<FiAlertTriangle />} loading={paymentsQ.isLoading} accent="#cb2431" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                <Panel title="Failure Reasons">
                  {paymentsQ.isLoading ? <Skeleton height={80} /> :
                   !p?.failures_by_reason_bucket || !Object.keys(p.failures_by_reason_bucket).length ? (
                    <p className="text-xs py-4 text-center" style={{ color: "#987554" }}>No failures recorded.</p>
                  ) : <BreakdownList data={p.failures_by_reason_bucket} />}
                </Panel>
                <Panel title="By Provider">
                  {paymentsQ.isLoading ? <Skeleton height={80} /> : <BreakdownList data={p?.payments_by_provider} />}
                </Panel>
                <Panel title="By Channel">
                  {paymentsQ.isLoading ? <Skeleton height={80} /> : <BreakdownList data={p?.payments_by_channel} />}
                </Panel>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <MetricCard label="Webhooks Received"    value={num(p?.webhook_received_count)}          icon={<FiActivity />} loading={paymentsQ.isLoading} />
                <MetricCard label="Webhooks Processed"   value={num(p?.webhook_processed_count)}         icon={<FiCheck />}    loading={paymentsQ.isLoading} accent="#22863a" />
                <MetricCard label="Webhook Success Rate" value={pct(p?.webhook_processing_success_rate)} icon={<FiZap />}      loading={paymentsQ.isLoading} />
              </div>
            </div>
          )}
        </section>

        {/* ────────────────────────────────────────
            § 5  Engagement Snapshot
        ──────────────────────────────────────── */}
        <section className="pb-4">
          <SectionHeader icon={<FiBell />} title="Engagement Snapshot" />

          {overviewQ.isError ? <SectionError onRetry={overviewQ.refetch} /> : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <MetricCard label="Notifications Sent"    value={num(o?.notification_sent_count)}    icon={<FiBell />}       loading={overviewQ.isLoading} />
              <MetricCard label="Notifications Read"    value={num(o?.notification_read_count)}    icon={<FiEye />}        loading={overviewQ.isLoading} accent="#22863a" />
              <MetricCard label="Waitlist Promoted"     value={num(o?.waitlist_promoted_count)}    icon={<FiArrowRight />} loading={overviewQ.isLoading} />
              <MetricCard
                label="Waitlist Recovered Rev."
                value={o?.waitlist_recovered_revenue === null ? "N/A" : fmt(o?.waitlist_recovered_revenue)}
                sub={o?.waitlist_recovered_revenue === null ? "Not yet available" : undefined}
                icon={<FiDollarSign />}
                loading={overviewQ.isLoading}
                accent="#987554"
              />
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
