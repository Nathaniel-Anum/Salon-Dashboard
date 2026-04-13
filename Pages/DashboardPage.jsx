import React from "react";
import { GlassCard } from "./GlassCard";
import {
  FaCalendarAlt,
  FaDollarSign,
  FaUsers,
  FaStar,
  FaCheckCircle,
} from "react-icons/fa";
import { FiClock, FiArrowRight } from "react-icons/fi";

/* ── recent bookings mock data ── */
const recentBookings = [
  { name: "Amara Johnson",   service: "Hair Treatment",    time: "09:00 AM", status: "confirmed" },
  { name: "Sophia Williams", service: "Nail Art",          time: "10:30 AM", status: "in-progress" },
  { name: "Kezia Mensah",    service: "Facial & Massage",  time: "12:00 PM", status: "pending" },
  { name: "Temi Oluwaseun",  service: "Hair Coloring",     time: "02:00 PM", status: "confirmed" },
  { name: "Grace Adeola",    service: "Eyebrow Shaping",   time: "03:30 PM", status: "completed" },
];

const statusConfig = {
  confirmed:    { label: "Confirmed",    bg: "rgba(187,161,79,0.12)",  color: "#a08340" },
  "in-progress":{ label: "In Progress", bg: "rgba(82,130,255,0.12)",  color: "#3b6de8" },
  pending:      { label: "Pending",      bg: "rgba(245,180,60,0.12)",  color: "#c97d10" },
  completed:    { label: "Completed",    bg: "rgba(34,160,80,0.12)",   color: "#1a8a40" },
};

/* ── popular services with ratings ── */
const services = [
  { name: "Hair Treatment",  bookings: 124, rating: 4.9, pct: 82 },
  { name: "Nail Art",        bookings: 98,  rating: 4.7, pct: 67 },
  { name: "Facial & Massage",bookings: 76,  rating: 4.8, pct: 54 },
  { name: "Hair Coloring",   bookings: 65,  rating: 4.6, pct: 48 },
  { name: "Eyebrow Shaping", bookings: 52,  rating: 4.5, pct: 38 },
];

const DashboardPage = () => {
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
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
              className="text-2xl sm:text-3xl font-bold text-white leading-snug"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Welcome back, Admin
            </h1>
            <p className="text-white/55 text-sm mt-1" style={{ fontFamily: "'Poppins', sans-serif" }}>
              Here's what's happening at the salon today
            </p>
          </div>

          <div
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

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
        <GlassCard
          title="Today's Clients"
          value="24"
          icon={<FaUsers />}
          trend={12}
          trendLabel="vs yesterday"
        />
        <GlassCard
          title="Appointments"
          value="18"
          icon={<FaCalendarAlt />}
          trend={5}
          trendLabel="vs yesterday"
        />
        <GlassCard
          title="Revenue Today"
          value="$1,280"
          icon={<FaDollarSign />}
          accent="#987554"
          trend={8}
          trendLabel="vs yesterday"
        />
        <GlassCard
          title="Avg. Rating"
          value="4.9 ★"
          icon={<FaStar />}
          accent="#BBA14F"
          trend={2}
          trendLabel="this month"
        />
      </div>

      {/* ── Second stat row: Services ── */}
      {/* ── Bottom row ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Recent bookings — takes 2 cols */}
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
              Today's Bookings
            </h2>
            <button
              className="text-xs flex items-center gap-1 transition-opacity hover:opacity-70"
              style={{ color: "#BBA14F", fontFamily: "'Poppins', sans-serif" }}
            >
              View all <FiArrowRight size={12} />
            </button>
          </div>

          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(187,161,79,0.15)" }}>
                  {["Client", "Service", "Time", "Status"].map((h) => (
                    <th
                      key={h}
                      className="text-left pb-3 px-1 font-medium text-[#987554] text-xs tracking-wide"
                      style={{ fontFamily: "'Poppins', sans-serif" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentBookings.map((b, i) => {
                  const s = statusConfig[b.status];
                  return (
                    <tr
                      key={i}
                      className="transition-colors duration-150 hover:bg-[#F5EFE6]"
                      style={{ borderBottom: "1px solid rgba(187,161,79,0.08)" }}
                    >
                      <td className="py-3 px-1">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                            style={{ background: "linear-gradient(135deg,#BBA14F,#987554)" }}
                          >
                            {b.name.charAt(0)}
                          </div>
                          <span
                            className="font-medium text-[#272727] whitespace-nowrap"
                            style={{ fontFamily: "'Poppins', sans-serif" }}
                          >
                            {b.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-1 text-[#987554] whitespace-nowrap" style={{ fontFamily: "'Poppins', sans-serif" }}>
                        {b.service}
                      </td>
                      <td className="py-3 px-1 text-[#987554] whitespace-nowrap" style={{ fontFamily: "'Poppins', sans-serif" }}>
                        {b.time}
                      </td>
                      <td className="py-3 px-1 whitespace-nowrap">
                        <span
                          className="text-xs px-2.5 py-1 rounded-full font-medium"
                          style={{ background: s.bg, color: s.color, fontFamily: "'Poppins', sans-serif" }}
                        >
                          {s.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Popular services — 1 col */}
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
              Popular Services
            </h2>
            <span
              className="text-[10px] px-2.5 py-1 rounded-full font-medium"
              style={{
                background: "rgba(187,161,79,0.12)",
                color: "#987554",
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              This month
            </span>
          </div>

          <div className="space-y-4">
            {services.map((s, i) => {
              /* render filled stars */
              const stars = Array.from({ length: 5 }, (_, idx) => {
                const filled = idx < Math.floor(s.rating);
                const half   = !filled && idx < s.rating;
                return (
                  <span
                    key={idx}
                    style={{
                      color: filled || half ? "#BBA14F" : "rgba(187,161,79,0.25)",
                      fontSize: 11,
                    }}
                  >
                    ★
                  </span>
                );
              });

              return (
                <div key={i}>
                  {/* Service row */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      {/* rank badge */}
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
                        {s.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* star rating */}
                      <div className="flex items-center gap-0.5">
                        {stars}
                        <span
                          className="ml-1 text-[11px] font-semibold"
                          style={{ color: "#BBA14F", fontFamily: "'Poppins', sans-serif" }}
                        >
                          {s.rating}
                        </span>
                      </div>
                      {/* booking count */}
                      <span
                        className="text-[11px]"
                        style={{ color: "#b5a47a", fontFamily: "'Poppins', sans-serif" }}
                      >
                        {s.bookings} bk
                      </span>
                    </div>
                  </div>

                  {/* progress bar */}
                  <div
                    className="h-1.5 rounded-full overflow-hidden"
                    style={{ background: "rgba(187,161,79,0.13)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${s.pct}%`,
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
          </div>

          {/* Footer totals */}
          <div
            className="mt-5 pt-4 flex items-center justify-between"
            style={{ borderTop: "1px solid rgba(187,161,79,0.15)" }}
          >
            <div className="flex items-center gap-1.5">
              <FaCheckCircle size={11} style={{ color: "#1a8a40" }} />
              <span
                className="text-xs text-[#987554]"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                Completed today
              </span>
              <span
                className="text-xs font-semibold text-[#272727] ml-1"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                14
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <FiClock size={11} style={{ color: "#c97d10" }} />
              <span
                className="text-xs text-[#987554]"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                Pending
              </span>
              <span
                className="text-xs font-semibold text-[#272727] ml-1"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                4
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;






