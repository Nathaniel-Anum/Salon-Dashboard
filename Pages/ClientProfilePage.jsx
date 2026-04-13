/**
 * ClientProfilePage.jsx
 * ──────────────────────
 * Full client profile — past appointments, total spend,
 * favourite services, loyalty points.
 *
 * Route:  /clients/:id
 * Opened from CustomersPage "View Profile" button.
 */

import React, { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  FiArrowLeft,
  FiMail,
  FiPhone,
  FiCalendar,
  FiScissors,
  FiStar,
  FiClock,
  FiTrendingUp,
  FiAward,
  FiCheckCircle,
  FiXCircle,
  FiAlertCircle,
  FiRefreshCw,
} from "react-icons/fi";
import { fetchCustomerDetail, fetchClientBookings, computeProfileStats } from "../src/api/clientProfile";

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */
const GOLD = "#BBA14F";
const DARK = "#272727";
const MID  = "#987554";
const CREAM = "#FDFAF5";
const BORDER = "rgba(187,161,79,0.18)";

const AVATAR_COLORS = [
  ["#BBA14F", "#987554"],
  ["#987554", "#6b4f30"],
  ["#4f7aa8", "#2d5a84"],
  ["#7a4fa8", "#5a2d84"],
  ["#4fa87a", "#2d845a"],
  ["#a84f7a", "#842d5a"],
];

const STATUS_CFG = {
  completed:  { label: "Completed",  bg: "rgba(34,160,80,0.12)",    color: "#1a8a40", border: "rgba(34,160,80,0.25)",    icon: <FiCheckCircle size={11} /> },
  pending:    { label: "Pending",    bg: "rgba(187,161,79,0.12)",   color: "#8a7030", border: "rgba(187,161,79,0.3)",    icon: <FiAlertCircle size={11} /> },
  confirmed:  { label: "Confirmed",  bg: "rgba(79,122,168,0.12)",   color: "#2d5a84", border: "rgba(79,122,168,0.3)",   icon: <FiCheckCircle size={11} /> },
  cancelled:  { label: "Cancelled",  bg: "rgba(200,50,50,0.1)",     color: "#c43232", border: "rgba(200,50,50,0.25)",   icon: <FiXCircle size={11} />    },
  "no-show":  { label: "No Show",    bg: "rgba(150,100,50,0.1)",    color: "#7a5020", border: "rgba(150,100,50,0.25)",  icon: <FiXCircle size={11} />    },
  in_progress:{ label: "In Progress",bg: "rgba(79,168,122,0.12)",   color: "#2d845a", border: "rgba(79,168,122,0.3)",  icon: <FiRefreshCw size={11} />  },
};

/* ─────────────────────────────────────────────
   AVATAR
───────────────────────────────────────────── */
function Avatar({ name, size = 64 }) {
  const initials = (name || "?")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  const idx = (name?.charCodeAt(0) || 0) % AVATAR_COLORS.length;
  const [from, to] = AVATAR_COLORS[idx];
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%",
        background: `linear-gradient(135deg, ${from}, ${to})`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.36, fontWeight: 700, color: "#fff",
        fontFamily: "'Poppins', sans-serif",
        boxShadow: "0 4px 16px rgba(0,0,0,0.14)",
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

/* ─────────────────────────────────────────────
   STAT CARD
───────────────────────────────────────────── */
function StatCard({ icon, label, value, sub, accent = GOLD }) {
  return (
    <div style={{
      background: CREAM, border: `1px solid ${BORDER}`,
      borderRadius: 16, padding: "18px 20px",
      boxShadow: "0 2px 12px rgba(39,39,39,0.05)",
      display: "flex", flexDirection: "column", gap: 6,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: `${accent}1a`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: accent, marginBottom: 2,
      }}>
        {icon}
      </div>
      <p style={{
        margin: 0, fontSize: 24, fontWeight: 700, color: DARK, lineHeight: 1,
        fontFamily: "'Poppins', sans-serif",
      }}>
        {value}
      </p>
      <p style={{ margin: 0, fontSize: 11, color: MID, fontFamily: "'Poppins', sans-serif" }}>
        {label}
      </p>
      {sub && (
        <p style={{ margin: 0, fontSize: 10, color: "rgba(152,117,84,0.6)", fontFamily: "'Poppins', sans-serif" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   SECTION HEADING
───────────────────────────────────────────── */
function SectionHeading({ icon, title }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8,
        background: "rgba(187,161,79,0.12)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: GOLD, flexShrink: 0,
      }}>
        {icon}
      </div>
      <h3 style={{
        margin: 0, fontSize: 14, fontWeight: 700, color: DARK,
        fontFamily: "'Playfair Display', serif",
      }}>
        {title}
      </h3>
    </div>
  );
}

/* ─────────────────────────────────────────────
   STATUS BADGE
───────────────────────────────────────────── */
function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.pending;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 20,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      fontFamily: "'Poppins', sans-serif", whiteSpace: "nowrap",
    }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

/* ─────────────────────────────────────────────
   APPOINTMENT ROW
───────────────────────────────────────────── */
function AppointmentRow({ booking, index }) {
  const dateLabel = booking.date
    ? dayjs(booking.date).format("ddd, D MMM YYYY")
    : "—";

  const timeLabel = booking.startTime
    ? dayjs(`2000-01-01 ${booking.startTime}`).format("h:mm A")
    : "—";

  const services = booking.serviceNames.length
    ? booking.serviceNames.join(", ")
    : "—";

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr auto auto",
      gap: 12,
      alignItems: "center",
      padding: "12px 16px",
      borderBottom: "1px solid rgba(187,161,79,0.1)",
      background: index % 2 === 0 ? CREAM : "rgba(187,161,79,0.03)",
      transition: "background 0.15s",
    }}
    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(187,161,79,0.07)"}
    onMouseLeave={(e) => e.currentTarget.style.background = index % 2 === 0 ? CREAM : "rgba(187,161,79,0.03)"}
    >
      {/* Date + time */}
      <div>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: DARK, fontFamily: "'Poppins', sans-serif" }}>
          {dateLabel}
        </p>
        <p style={{ margin: 0, fontSize: 11, color: MID, fontFamily: "'Poppins', sans-serif" }}>
          {timeLabel}
        </p>
      </div>

      {/* Services */}
      <p style={{
        margin: 0, fontSize: 12, color: DARK, fontFamily: "'Poppins', sans-serif",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {services}
      </p>

      {/* Staff */}
      <p style={{
        margin: 0, fontSize: 12, color: MID, fontFamily: "'Poppins', sans-serif",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {booking.staff || "—"}
      </p>

      {/* Status */}
      <StatusBadge status={booking.status} />

      {/* Total */}
      <p style={{
        margin: 0, fontSize: 12, fontWeight: 700, color: DARK,
        fontFamily: "'Poppins', sans-serif", whiteSpace: "nowrap", textAlign: "right",
      }}>
        {booking.total > 0 ? `GHS ${booking.total.toFixed(2)}` : "—"}
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────
   SKELETON LOADER
───────────────────────────────────────────── */
function Skeleton({ width = "100%", height = 16, radius = 8, style = {} }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: "linear-gradient(90deg, rgba(187,161,79,0.08) 25%, rgba(187,161,79,0.18) 50%, rgba(187,161,79,0.08) 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.5s infinite",
      ...style,
    }} />
  );
}

/* ─────────────────────────────────────────────
   LOYALTY RING
───────────────────────────────────────────── */
function LoyaltyRing({ points }) {
  const MAX = 500;
  const pct = Math.min(points / MAX, 1);
  const r = 46;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;
  const tier = points >= 400 ? { label: "Platinum", color: "#8ab4d4" }
    : points >= 200 ? { label: "Gold", color: GOLD }
    : points >= 100 ? { label: "Silver", color: "#aaaaaa" }
    : { label: "Bronze", color: "#c8986a" };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <div style={{ position: "relative", width: 110, height: 110 }}>
        <svg width="110" height="110" viewBox="0 0 110 110" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="55" cy="55" r={r} fill="none" stroke="rgba(187,161,79,0.12)" strokeWidth="9" />
          <circle
            cx="55" cy="55" r={r} fill="none"
            stroke={tier.color} strokeWidth="9"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
        }}>
          <FiAward size={18} color={tier.color} />
          <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: DARK, fontFamily: "'Poppins', sans-serif", lineHeight: 1.1 }}>
            {points}
          </p>
          <p style={{ margin: 0, fontSize: 9, color: MID, fontFamily: "'Poppins', sans-serif" }}>pts</p>
        </div>
      </div>
      <span style={{
        fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
        background: `${tier.color}22`, color: tier.color,
        border: `1px solid ${tier.color}55`,
        fontFamily: "'Poppins', sans-serif",
      }}>
        {tier.label} Member
      </span>
      <p style={{ margin: 0, fontSize: 10, color: MID, fontFamily: "'Poppins', sans-serif", textAlign: "center" }}>
        {points < MAX ? `${MAX - points} pts to next tier` : "Max tier reached!"}
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════ */
export default function ClientProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();

  /* ── Fetch customer detail ── */
  const { data: customer, isLoading: loadingCustomer } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => fetchCustomerDetail(id),
    staleTime: 2 * 60_000,
  });

  /* ── Fetch bookings ── */
  const { data: bookingsRaw = [], isLoading: loadingBookings } = useQuery({
    queryKey: ["client-bookings", id],
    queryFn: () => fetchClientBookings(id),
    staleTime: 60_000,
  });

  /* ── Derived stats ── */
  const stats = useMemo(() => computeProfileStats(bookingsRaw), [bookingsRaw]);

  /* ── Sorted history (newest first) ── */
  const history = useMemo(
    () => [...bookingsRaw].sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime)),
    [bookingsRaw]
  );

  const fullName =
    customer?.full_name ||
    [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") ||
    "Client";

  const isLoading = loadingCustomer || loadingBookings;

  /* ── Currency format helper ── */
  const fmt = (n) => `GHS ${n.toFixed(2)}`;

  return (
    <div style={{ fontFamily: "'Poppins', sans-serif", animation: "fadeInUp 0.3s ease both" }}>

      {/* ── Back button + header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 28 }}>
        <button
          onClick={() => navigate("/clients")}
          style={{
            width: 36, height: 36, borderRadius: 10, border: `1px solid ${BORDER}`,
            background: CREAM, color: MID, display: "flex", alignItems: "center",
            justifyContent: "center", cursor: "pointer", flexShrink: 0, marginTop: 2,
            boxShadow: "0 1px 4px rgba(39,39,39,0.06)",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = GOLD; e.currentTarget.style.color = GOLD; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = MID; }}
        >
          <FiArrowLeft size={16} />
        </button>

        {/* Profile header */}
        {isLoading ? (
          <div style={{ flex: 1, display: "flex", gap: 16, alignItems: "center" }}>
            <Skeleton width={64} height={64} radius={32} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
              <Skeleton width="40%" height={20} />
              <Skeleton width="60%" height={14} />
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <Avatar name={fullName} size={64} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <h1 style={{
                  margin: 0, fontSize: 22, fontWeight: 700, color: DARK,
                  fontFamily: "'Playfair Display', serif",
                }}>
                  {fullName}
                </h1>
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 20,
                  background: customer?.is_active ? "rgba(34,160,80,0.12)" : "rgba(200,50,50,0.1)",
                  color: customer?.is_active ? "#1a8a40" : "#c43232",
                  border: `1px solid ${customer?.is_active ? "rgba(34,160,80,0.25)" : "rgba(200,50,50,0.25)"}`,
                }}>
                  {customer?.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <div style={{ display: "flex", gap: 16, marginTop: 6, flexWrap: "wrap" }}>
                {customer?.email && (
                  <div style={{ display: "flex", alignItems: "center", gap: 5, color: MID, fontSize: 12 }}>
                    <FiMail size={12} color={GOLD} />
                    {customer.email}
                  </div>
                )}
                {customer?.phone && (
                  <div style={{ display: "flex", alignItems: "center", gap: 5, color: MID, fontSize: 12 }}>
                    <FiPhone size={12} color={GOLD} />
                    {customer.phone}
                  </div>
                )}
                {stats.lastVisit && (
                  <div style={{ display: "flex", alignItems: "center", gap: 5, color: MID, fontSize: 12 }}>
                    <FiCalendar size={12} color={GOLD} />
                    Last visit: {dayjs(stats.lastVisit).format("D MMM YYYY")}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Stat cards row ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: 14, marginBottom: 28,
      }}>
        {isLoading ? (
          [1,2,3,4].map((k) => (
            <div key={k} style={{ background: CREAM, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 20 }}>
              <Skeleton width={36} height={36} radius={10} style={{ marginBottom: 12 }} />
              <Skeleton width="60%" height={22} style={{ marginBottom: 6 }} />
              <Skeleton width="80%" height={12} />
            </div>
          ))
        ) : (
          <>
            <StatCard
              icon={<FiCheckCircle size={17} />}
              label="Completed Visits"
              value={stats.totalVisits}
              sub={`of ${bookingsRaw.length} total appts`}
            />
            <StatCard
              icon={<FiTrendingUp size={17} />}
              label="Total Spend"
              value={stats.totalSpend > 0 ? fmt(stats.totalSpend) : "GHS 0.00"}
              sub="on completed visits"
              accent="#1a8a40"
            />
            <StatCard
              icon={<FiScissors size={17} />}
              label="Favourite Service"
              value={stats.favouriteServices[0]?.name || "—"}
              sub={stats.favouriteServices[0] ? `booked ${stats.favouriteServices[0].count}×` : "No bookings yet"}
              accent={MID}
            />
            <StatCard
              icon={<FiCalendar size={17} />}
              label="Upcoming"
              value={stats.upcoming.length}
              sub={stats.upcoming[0] ? dayjs(stats.upcoming[0].date).format("D MMM YYYY") : "None scheduled"}
              accent="#4f7aa8"
            />
          </>
        )}
      </div>

      {/* ── Two column layout ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 260px",
        gap: 20,
        alignItems: "start",
      }}>

        {/* ── LEFT: Appointment history ── */}
        <div>
          <SectionHeading icon={<FiClock size={14} />} title="Appointment History" />

          <div style={{
            background: CREAM, border: `1px solid ${BORDER}`,
            borderRadius: 16, overflow: "hidden",
            boxShadow: "0 2px 12px rgba(39,39,39,0.05)",
          }}>
            {/* Table header */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr auto auto",
              gap: 12,
              padding: "10px 16px",
              background: "linear-gradient(90deg, rgba(187,161,79,0.1), rgba(152,117,84,0.06))",
              borderBottom: `1px solid rgba(187,161,79,0.2)`,
            }}>
              {["Date / Time", "Services", "Staff", "Status", "Total"].map((h) => (
                <span key={h} style={{
                  fontSize: 10, fontWeight: 700, color: MID, textTransform: "uppercase",
                  letterSpacing: "0.06em", fontFamily: "'Poppins', sans-serif",
                  textAlign: h === "Total" ? "right" : "left",
                }}>
                  {h}
                </span>
              ))}
            </div>

            {/* Rows */}
            {isLoading ? (
              [1,2,3].map((k) => (
                <div key={k} style={{ padding: "14px 16px", borderBottom: `1px solid rgba(187,161,79,0.1)` }}>
                  <Skeleton width="100%" height={14} />
                </div>
              ))
            ) : history.length === 0 ? (
              <div style={{
                padding: "40px 20px", textAlign: "center",
                color: MID, fontSize: 13,
              }}>
                <FiCalendar size={28} style={{ color: GOLD, opacity: 0.35, marginBottom: 8, display: "block", margin: "0 auto 10px" }} />
                No appointment history yet
              </div>
            ) : (
              history.map((b, idx) => <AppointmentRow key={b.id} booking={b} index={idx} />)
            )}

            {/* Footer */}
            {!isLoading && history.length > 0 && (
              <div style={{
                padding: "10px 16px",
                background: "rgba(187,161,79,0.04)",
                borderTop: `1px solid rgba(187,161,79,0.12)`,
              }}>
                <p style={{ margin: 0, fontSize: 11, color: "rgba(152,117,84,0.65)", fontFamily: "'Poppins', sans-serif" }}>
                  {history.length} appointment{history.length !== 1 ? "s" : ""} total
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Loyalty + Favourite services ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

          {/* Loyalty ring card */}
          <div style={{
            background: CREAM, border: `1px solid ${BORDER}`,
            borderRadius: 16, padding: 20,
            boxShadow: "0 2px 12px rgba(39,39,39,0.05)",
          }}>
            <SectionHeading icon={<FiAward size={14} />} title="Loyalty Points" />
            {isLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 20 }}>
                <Skeleton width={110} height={110} radius={55} />
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "center" }}>
                <LoyaltyRing points={stats.loyaltyPoints} />
              </div>
            )}
            <p style={{
              margin: "14px 0 0", fontSize: 10, color: "rgba(152,117,84,0.6)",
              textAlign: "center", fontFamily: "'Poppins', sans-serif", lineHeight: 1.6,
            }}>
              1 point earned per GHS 10 spent on completed visits
            </p>
          </div>

          {/* Favourite services card */}
          <div style={{
            background: CREAM, border: `1px solid ${BORDER}`,
            borderRadius: 16, padding: 20,
            boxShadow: "0 2px 12px rgba(39,39,39,0.05)",
          }}>
            <SectionHeading icon={<FiStar size={14} />} title="Favourite Services" />
            {isLoading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[1,2,3].map((k) => <Skeleton key={k} width="100%" height={38} radius={10} />)}
              </div>
            ) : stats.favouriteServices.length === 0 ? (
              <p style={{ margin: 0, fontSize: 12, color: MID, textAlign: "center" }}>
                No services booked yet
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {stats.favouriteServices.slice(0, 6).map((svc, idx) => {
                  const maxCount = stats.favouriteServices[0].count;
                  const pct = Math.round((svc.count / maxCount) * 100);
                  const colors = [GOLD, MID, "#4f7aa8", "#7a4fa8", "#4fa87a", "#a84f7a"];
                  const c = colors[idx % colors.length];
                  return (
                    <div key={svc.name}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: DARK, fontFamily: "'Poppins', sans-serif" }}>
                          {idx === 0 && <FiStar size={10} style={{ color: GOLD, marginRight: 4, verticalAlign: "middle" }} />}
                          {svc.name}
                        </span>
                        <span style={{ fontSize: 10, color: MID, fontFamily: "'Poppins', sans-serif" }}>
                          {svc.count}×
                        </span>
                      </div>
                      <div style={{
                        height: 5, borderRadius: 3,
                        background: "rgba(187,161,79,0.12)",
                        overflow: "hidden",
                      }}>
                        <div style={{
                          height: "100%", width: `${pct}%`,
                          background: `linear-gradient(90deg, ${c}, ${c}bb)`,
                          borderRadius: 3,
                          transition: "width 0.6s ease",
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Upcoming appointments card */}
          {!isLoading && stats.upcoming.length > 0 && (
            <div style={{
              background: CREAM, border: `1px solid ${BORDER}`,
              borderRadius: 16, padding: 20,
              boxShadow: "0 2px 12px rgba(39,39,39,0.05)",
            }}>
              <SectionHeading icon={<FiCalendar size={14} />} title="Upcoming" />
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {stats.upcoming.slice(0, 3).map((b) => (
                  <div key={b.id} style={{
                    padding: "10px 12px", borderRadius: 10,
                    background: "rgba(187,161,79,0.07)",
                    border: `1px solid rgba(187,161,79,0.15)`,
                  }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: DARK, fontFamily: "'Poppins', sans-serif" }}>
                      {dayjs(b.date).format("ddd, D MMM YYYY")}
                    </p>
                    <p style={{ margin: "3px 0 0", fontSize: 11, color: MID, fontFamily: "'Poppins', sans-serif" }}>
                      {b.serviceNames.join(", ") || "—"}
                    </p>
                    {b.startTime && (
                      <p style={{ margin: "2px 0 0", fontSize: 10, color: "rgba(152,117,84,0.7)", fontFamily: "'Poppins', sans-serif", display: "flex", alignItems: "center", gap: 4 }}>
                        <FiClock size={9} /> {dayjs(`2000-01-01 ${b.startTime}`).format("h:mm A")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* shimmer keyframe */}
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
