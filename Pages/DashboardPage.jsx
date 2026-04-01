import React from "react";
import { GlassCard } from "./GlassCard";
import {
  FaCalendarAlt,
  FaDollarSign,
  FaUsers,
  FaStar,
  FaCut,
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

/* ── popular services ── */
const services = [
  { name: "Hair Treatment", pct: 82 },
  { name: "Nail Art",       pct: 67 },
  { name: "Facials",        pct: 54 },
  { name: "Hair Coloring",  pct: 48 },
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
          <h2
            className="text-base font-semibold text-[#272727] mb-5"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Popular Services
          </h2>

          <div className="space-y-5">
            {services.map((s, i) => (
              <div key={i}>
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center gap-2">
                    <FaCut size={12} style={{ color: "#BBA14F" }} />
                    <span
                      className="text-sm text-[#272727]"
                      style={{ fontFamily: "'Poppins', sans-serif" }}
                    >
                      {s.name}
                    </span>
                  </div>
                  <span
                    className="text-xs font-semibold"
                    style={{ color: "#BBA14F", fontFamily: "'Poppins', sans-serif" }}
                  >
                    {s.pct}%
                  </span>
                </div>
                <div
                  className="h-2 rounded-full overflow-hidden"
                  style={{ background: "rgba(187,161,79,0.15)" }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${s.pct}%`,
                      background: "linear-gradient(90deg, #BBA14F, #c9ae5e)",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* quick summary */}
          <div
            className="mt-6 pt-5 border-t space-y-3"
            style={{ borderColor: "rgba(187,161,79,0.15)" }}
          >
            {[
              { icon: <FaCheckCircle />, label: "Completed today", val: "14" },
              { icon: <FiClock />,       label: "Pending",         val: "4"  },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#987554] text-sm" style={{ fontFamily: "'Poppins', sans-serif" }}>
                  <span style={{ color: "#BBA14F" }}>{item.icon}</span>
                  {item.label}
                </div>
                <span
                  className="font-semibold text-[#272727] text-sm"
                  style={{ fontFamily: "'Poppins', sans-serif" }}
                >
                  {item.val}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;






