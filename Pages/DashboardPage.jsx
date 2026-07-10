import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { GlassCard } from "./GlassCard";
import _axios from "../src/api/_axios";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  FaCalendarAlt,
  FaDollarSign,
  FaStar,
  FaCheckCircle,
} from "react-icons/fa";
import { FiClock, FiArrowRight, FiActivity } from "react-icons/fi";
import { getAnalyticsOverview, getAnalyticsRevenue, getAnalyticsBookings } from "../src/api/analytics";

/* ── analytics display helpers ── */
const fmtAmt = (val, prefix = "GH₵") => {
  if (val === null || val === undefined) return "—";
  const n = parseFloat(val);
  if (isNaN(n)) return "—";
  if (n >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${prefix}${(n / 1_000).toFixed(1)}K`;
  return `${prefix}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const fmtNum = (val) => (val === null || val === undefined ? "—" : Number(val).toLocaleString());
const fmtPct = (val) => (val === null || val === undefined ? "—" : `${val}%`);



const DashboardPage = () => {
  const navigate = useNavigate();
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const { data: staffData } = useQuery({
    queryKey: ["staff"],
    queryFn: () => _axios.get("/api/portal/v1/accounts/staff/").then((r) =>
      Array.isArray(r.data) ? r.data : (r.data?.results ?? [])
    ),
    staleTime: 5 * 60_000,
  });

  const { data: customersData } = useQuery({
    queryKey: ["customers"],
    queryFn: () => _axios.get("/api/portal/v1/accounts/customers/").then((r) =>
      Array.isArray(r.data) ? r.data : (r.data?.results ?? [])
    ),
    staleTime: 5 * 60_000,
  });

  const staffCount     = staffData?.length     ?? "—";   // eslint-disable-line
  const customersCount = customersData?.length  ?? "—";   // eslint-disable-line

  /* ── analytics data ── */
  const { data: overviewData, isLoading: overviewLoading } = useQuery({
    queryKey: ["dash-analytics-overview"],
    queryFn: () => getAnalyticsOverview({}),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const { data: revenueData, isLoading: revenueLoading } = useQuery({
    queryKey: ["dash-analytics-revenue"],
    queryFn: () => getAnalyticsRevenue({}),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const revenueChartData = (revenueData?.revenue_by_day ?? []).map((d) => ({
    date: d.date.slice(5),
    revenue: parseFloat(d.revenue) || 0,
  }));

  const { data: bookingsData, isLoading: bookingsLoading } = useQuery({
    queryKey: ["dash-analytics-bookings"],
    queryFn: () => getAnalyticsBookings({}),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  return (
    <div
      style={{ animation: "fadeInUp 0.5s ease both" }}
      className="space-y-8"
    >
      {/* ── Welcome banner ── */}
      <div
        className="relative overflow-hidden rounded-2xl px-7 py-7 sm:px-10 sm:py-8"
        style={{
          background: "linear-gradient(120deg, #272727 0%, #3a2e1e 60%, #4a3a22 100%)",
          boxShadow: "0 8px 32px rgba(39,39,39,0.18)",
        }}
      >
        {/* dot grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(187,161,79,0.15) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div
          className="absolute right-0 top-0 h-full w-1/3 pointer-events-none"
          style={{
            background: "radial-gradient(circle at 80% 50%, rgba(187,161,79,0.13), transparent 70%)",
          }}
        />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p
              className="text-xs tracking-[0.25em] uppercase mb-1"
              style={{ color: "#BBA14F", fontFamily: "'Poppins', sans-serif" }}
            >
              {today}
            </p>
            <h1
              className="leading-snug"
              style={{
                fontFamily: "'Dancing Script', cursive",
                fontSize: "clamp(2rem, 4vw, 2.8rem)",
                fontWeight: 700,
                background: "linear-gradient(90deg, #f9d4e8 0%, #f3a8cf 40%, #e8c96a 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                textShadow: "none",
                letterSpacing: "0.02em",
              }}
            >
              ✦ Welcome back, Admin
            </h1>
            <p className="text-white/55 text-sm mt-1" style={{ fontFamily: "'Poppins', sans-serif" }}>
              Here's what's happening at the salon today
            </p>
          </div>

          <div
            onClick={() => navigate("/schedules")}
            className="flex items-center gap-2 self-start sm:self-auto px-4 py-2.5 rounded-full text-sm font-medium cursor-pointer transition-all duration-200 hover:opacity-80"
            style={{
              background: "rgba(187,161,79,0.2)",
              border: "1px solid rgba(187,161,79,0.4)",
              color: "#e4ca80",
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            <FiClock size={14} />
            <span>View Schedule</span>
            <FiArrowRight size={14} />
          </div>
        </div>
      </div>

      {/* ── Analytics KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
        <GlassCard
          title="Gross Revenue"
          value={overviewLoading ? "..." : fmtAmt(overviewData?.gross_revenue)}
          icon={<FaDollarSign />}
          accent="#987554"
          trendLabel="last 30 days"
        />
        <GlassCard
          title="Bookings Created"
          value={overviewLoading ? "..." : fmtNum(overviewData?.booking_created_count)}
          icon={<FaCalendarAlt />}
          trendLabel="last 30 days"
        />
        <GlassCard
          title="Appts Completed"
          value={overviewLoading ? "..." : fmtNum(overviewData?.appointment_completed_count)}
          icon={<FaCheckCircle />}
          accent="#BBA14F"
          trendLabel="completed"
        />
        <GlassCard
          title="Payment Rate"
          value={overviewLoading ? "..." : fmtPct(overviewData?.payment_success_rate)}
          icon={<FaStar />}
          accent="#987554"
          trendLabel="success rate"
        />
      </div>

      {/* ── Revenue chart + Booking performance ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Revenue by Day — 2 cols */}
        <div
          className="xl:col-span-2 rounded-2xl p-6"
          style={{
            background: "#FDFAF5",
            border: "1px solid rgba(187,161,79,0.18)",
            boxShadow: "0 4px 20px rgba(39,39,39,0.05)",
          }}
        >
          <div className="flex items-center justify-between mb-5">
            <h2
              className="text-base font-semibold text-[#272727]"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Revenue Trend
            </h2>
            <span
              className="text-[10px] px-2.5 py-1 rounded-full font-medium"
              style={{
                background: "rgba(187,161,79,0.12)",
                color: "#987554",
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              Last 30 days
            </span>
          </div>
          {revenueLoading ? (
            <div className="h-48 rounded-xl animate-pulse" style={{ background: "rgba(187,161,79,0.1)" }} />
          ) : !revenueChartData.length ? (
            <p className="text-xs py-10 text-center" style={{ color: "#987554" }}>No revenue data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={192}>
              <AreaChart data={revenueChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#BBA14F" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#BBA14F" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(187,161,79,0.1)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#987554" }} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fontSize: 10, fill: "#987554" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `GH₵${(v / 1000).toFixed(0)}K`}
                />
                <Tooltip
                  contentStyle={{
                    background: "#272727",
                    border: "1px solid rgba(187,161,79,0.4)",
                    borderRadius: 12,
                    fontSize: 11,
                    fontFamily: "'Poppins', sans-serif",
                  }}
                  labelStyle={{ color: "#BBA14F", fontWeight: 600 }}
                  itemStyle={{ color: "#fff" }}
                  formatter={(v) => [fmtAmt(v), "Revenue"]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#BBA14F"
                  strokeWidth={2}
                  fill="url(#dashRevGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: "#BBA14F" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Booking Performance — 1 col */}
        <div
          className="rounded-2xl p-6"
          style={{
            background: "#FDFAF5",
            border: "1px solid rgba(187,161,79,0.18)",
            boxShadow: "0 4px 20px rgba(39,39,39,0.05)",
          }}
        >
          <div className="flex items-center justify-between mb-5">
            <h2
              className="text-base font-semibold text-[#272727]"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Booking Performance
            </h2>
            <FiActivity size={14} style={{ color: "#BBA14F" }} />
          </div>

          {overviewLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 rounded-xl animate-pulse" style={{ background: "rgba(187,161,79,0.1)" }} />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {[
                { label: "Created",   val: overviewData?.booking_created_count,          color: "#BBA14F" },
                { label: "Completed", val: overviewData?.appointment_completed_count,    color: "#1a8a40" },
                { label: "Cancelled", val: overviewData?.appointment_cancelled_count,    color: "#cb2431" },
                { label: "No-shows",  val: overviewData?.appointment_no_show_count,      color: "#d97706" },
              ].map(({ label, val, color }) => {
                const total = overviewData?.booking_created_count || 1;
                const w = val ? Math.min((val / total) * 100, 100) : 0;
                return (
                  <div key={label}>
                    <div className="flex justify-between items-center mb-1">
                      <span
                        className="text-xs font-medium"
                        style={{ color: "#272727", fontFamily: "'Poppins', sans-serif" }}
                      >
                        {label}
                      </span>
                      <span
                        className="text-sm font-bold"
                        style={{ color, fontFamily: "'Playfair Display', serif" }}
                      >
                        {fmtNum(val)}
                      </span>
                    </div>
                    <div
                      className="h-1.5 rounded-full overflow-hidden"
                      style={{ background: "rgba(187,161,79,0.13)" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${w}%`,
                          background: color,
                          opacity: 0.75,
                          transition: "width 0.8s ease",
                        }}
                      />
                    </div>
                  </div>
                );
              })}

              {/* Completion rate footer */}
              {overviewData?.booking_created_count ? (
                <div
                  className="pt-4 mt-1 flex items-center justify-between"
                  style={{ borderTop: "1px solid rgba(187,161,79,0.15)" }}
                >
                  <span className="text-xs" style={{ color: "#987554", fontFamily: "'Poppins', sans-serif" }}>
                    Completion Rate
                  </span>
                  <span
                    className="text-sm font-bold"
                    style={{ color: "#BBA14F", fontFamily: "'Playfair Display', serif" }}
                  >
                    {overviewData.appointment_completed_count != null
                      ? `${((overviewData.appointment_completed_count / overviewData.booking_created_count) * 100).toFixed(1)}%`
                      : "—"}
                  </span>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {/* ── Business Activity + Top Services ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Business Activity — 2 cols */}
        <div
          className="xl:col-span-2 rounded-2xl p-6"
          style={{
            background: "#FDFAF5",
            border: "1px solid rgba(187,161,79,0.18)",
            boxShadow: "0 4px 20px rgba(39,39,39,0.05)",
          }}
        >
          <div className="flex items-center justify-between mb-5">
            <h2
              className="text-base font-semibold text-[#272727]"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Business Activity
            </h2>
            <span
              className="text-[10px] px-2.5 py-1 rounded-full font-medium"
              style={{ background: "rgba(187,161,79,0.12)", color: "#987554", fontFamily: "'Poppins', sans-serif" }}
            >
              Last 30 days
            </span>
          </div>

          {overviewLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div key={i} className="h-11 rounded-xl animate-pulse" style={{ background: "rgba(187,161,79,0.1)" }} />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(187,161,79,0.15)" }}>
                    {["Metric", "Count", "Category"].map((h) => (
                      <th
                        key={h}
                        className="text-left pb-3 px-2 font-medium text-[#987554] text-xs tracking-wide"
                        style={{ fontFamily: "'Poppins', sans-serif" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "Bookings Created",     val: overviewData?.booking_created_count,          cat: "Appointments", color: "#BBA14F"  },
                    { label: "Appts Completed",       val: overviewData?.appointment_completed_count,    cat: "Appointments", color: "#1a8a40"  },
                    { label: "Appts Cancelled",       val: overviewData?.appointment_cancelled_count,    cat: "Appointments", color: "#cb2431"  },
                    { label: "Orders Confirmed",      val: overviewData?.order_confirmed_count,          cat: "Commerce",     color: "#3b6de8"  },
                    { label: "Orders Dispatched",     val: overviewData?.order_dispatched_count,         cat: "Commerce",     color: "#22863a"  },
                    { label: "Notifications Sent",    val: overviewData?.notification_sent_count,        cat: "Engagement",   color: "#987554"  },
                    { label: "Waitlist Promoted",     val: overviewData?.waitlist_promoted_count,        cat: "Waitlist",     color: "#d97706"  },
                  ].map((row, i) => (
                    <tr
                      key={i}
                      className="transition-colors duration-150 hover:bg-[#F5EFE6]"
                      style={{ borderBottom: "1px solid rgba(187,161,79,0.08)" }}
                    >
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-1.5 h-7 rounded-full shrink-0"
                            style={{ background: row.color, opacity: 0.75 }}
                          />
                          <span
                            className="font-medium text-[#272727] whitespace-nowrap"
                            style={{ fontFamily: "'Poppins', sans-serif" }}
                          >
                            {row.label}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <span
                          className="text-base font-bold"
                          style={{ color: "#272727", fontFamily: "'Playfair Display', serif" }}
                        >
                          {fmtNum(row.val)}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <span
                          className="text-xs px-2.5 py-1 rounded-full font-medium"
                          style={{
                            background: `${row.color}18`,
                            color: row.color,
                            fontFamily: "'Poppins', sans-serif",
                          }}
                        >
                          {row.cat}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Top Services — 1 col */}
        <div
          className="rounded-2xl p-6"
          style={{
            background: "#FDFAF5",
            border: "1px solid rgba(187,161,79,0.18)",
            boxShadow: "0 4px 20px rgba(39,39,39,0.05)",
          }}
        >
          <div className="flex items-center justify-between mb-5">
            <h2
              className="text-base font-semibold text-[#272727]"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Top Services
            </h2>
            <span
              className="text-[10px] px-2.5 py-1 rounded-full font-medium"
              style={{ background: "rgba(187,161,79,0.12)", color: "#987554", fontFamily: "'Poppins', sans-serif" }}
            >
              By bookings
            </span>
          </div>

          {bookingsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-8 rounded-xl animate-pulse" style={{ background: "rgba(187,161,79,0.1)" }} />
              ))}
            </div>
          ) : !bookingsData?.bookings_by_service?.length ? (
            <p className="text-xs py-8 text-center" style={{ color: "#987554", fontFamily: "'Poppins', sans-serif" }}>
              No service data for this period.
            </p>
          ) : (
            <div className="space-y-4">
              {bookingsData.bookings_by_service.map((s, i) => {
                const max = bookingsData.bookings_by_service[0]?.count || 1;
                const w = Math.min((s.count / max) * 100, 100);
                return (
                  <div key={s.service_id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                          style={{
                            background: i === 0
                              ? "linear-gradient(135deg,#BBA14F,#987554)"
                              : "rgba(187,161,79,0.12)",
                            color: i === 0 ? "#fff" : "#987554",
                            fontFamily: "'Poppins', sans-serif",
                          }}
                        >
                          {i + 1}
                        </span>
                        <span
                          className="text-sm text-[#272727] truncate"
                          style={{ fontFamily: "'Poppins', sans-serif" }}
                        >
                          Service #{s.service_id}
                        </span>
                      </div>
                      <span
                        className="text-[11px] font-semibold shrink-0"
                        style={{ color: "#BBA14F", fontFamily: "'Poppins', sans-serif" }}
                      >
                        {s.count} bk
                      </span>
                    </div>
                    <div
                      className="h-1.5 rounded-full overflow-hidden"
                      style={{ background: "rgba(187,161,79,0.13)" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${w}%`,
                          background: i === 0
                            ? "linear-gradient(90deg, #BBA14F, #c9ae5e)"
                            : "rgba(187,161,79,0.45)",
                          transition: "width 0.7s ease",
                        }}
                      />
                    </div>
                  </div>
                );
              })}

              {/* Footer: booking revenue */}
              {bookingsData?.booking_revenue != null && (
                <div
                  className="pt-4 mt-1 flex items-center justify-between"
                  style={{ borderTop: "1px solid rgba(187,161,79,0.15)" }}
                >
                  <div className="flex items-center gap-1.5">
                    <FaCheckCircle size={11} style={{ color: "#1a8a40" }} />
                    <span className="text-xs text-[#987554]" style={{ fontFamily: "'Poppins', sans-serif" }}>
                      Booking Revenue
                    </span>
                  </div>
                  <span
                    className="text-xs font-semibold text-[#272727]"
                    style={{ fontFamily: "'Poppins', sans-serif" }}
                  >
                    {fmtAmt(bookingsData.booking_revenue)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;






