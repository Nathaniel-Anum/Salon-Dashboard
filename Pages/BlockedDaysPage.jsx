/**
 * BlockedDaysPage
 * ───────────────
 * Admin page for managing blocked / closed days.
 * The admin can:
 *  - View all upcoming blocked dates in a list
 *  - Click any date on the inline calendar to block / unblock it
 *  - Add a reason label (Holiday / Staff Training / Personal / Custom)
 *  - Delete an existing blocked day
 *
 * Data is stored via blockedDays.js which tries the backend REST endpoint
 * and falls back to localStorage transparently.
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  FiCalendar,
  FiTrash2,
  FiSlash,
  FiAlertTriangle,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiInfo,
  FiX,
  FiTag,
} from "react-icons/fi";
import { message, Spin } from "antd";
import { useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  fetchBlockedDays,
  blockDate,
  unblockDate,
} from "../src/api/blockedDays";

/* ── Palette (matches the salon design system) ── */
const GOLD    = "#BBA14F";
const BROWN   = "#987554";
const CREAM   = "#FDFAF5";
const DARK    = "#0d0d0d";

/* ── Preset reason tags ── */
const REASON_PRESETS = [
  { label: "Public Holiday",  color: "#5282ff" },
  { label: "Staff Training",  color: "#22a050" },
  { label: "Personal Day",    color: "#f5b43c" },
  { label: "Deep Cleaning",   color: "#c07bdb" },
  { label: "Maintenance",     color: "#e05050" },
];

/* ── Helper: first day of month offset for the mini calendar ── */
function buildCalendarGrid(year, month) {
  // month is 0-indexed here
  const first     = new Date(year, month, 1);
  const lastDay   = new Date(year, month + 1, 0).getDate();
  const startDow  = first.getDay(); // 0=Sun
  const cells     = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= lastDay; d++) cells.push(d);
  return cells;
}

function pad2(n) { return String(n).padStart(2, "0"); }
function toDateStr(year, month, day) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
export default function BlockedDaysPage() {
  /* ── State ── */
  const [blockedDays, setBlockedDays]       = useState([]);  // [{ id, date, reason }]
  const [loading, setLoading]               = useState(true);
  const [saving, setSaving]                 = useState(false);

  // Invalidate the shared "blocked-days" query so CalendarPage updates instantly
  const queryClient = useQueryClient();

  // Calendar navigation
  const today = dayjs();
  const [calYear,  setCalYear]  = useState(today.year());
  const [calMonth, setCalMonth] = useState(today.month()); // 0-indexed

  // Selected date on the calendar (string "YYYY-MM-DD" or null)
  const [pickedDate,   setPickedDate]   = useState(null);

  // Reason form state
  const [reason,       setReason]       = useState("");
  const [customReason, setCustomReason] = useState("");

  /* ── Load blocked days on mount ── */
  useEffect(() => {
    setLoading(true);
    fetchBlockedDays()
      .then((days) => setBlockedDays(days.sort((a, b) => a.date.localeCompare(b.date))))
      .finally(() => setLoading(false));
  }, []);

  /* ── Blocked date lookup set for O(1) checks ── */
  const blockedSet = useMemo(
    () => new Set(blockedDays.map((d) => d.date)),
    [blockedDays]
  );

  /* ── Calendar grid for current month ── */
  const calGrid = useMemo(
    () => buildCalendarGrid(calYear, calMonth),
    [calYear, calMonth]
  );

  const calMonthLabel = new Date(calYear, calMonth, 1).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  /* ── Navigate calendar ── */
  const prevMonth = () => {
    if (calMonth === 0) { setCalYear((y) => y - 1); setCalMonth(11); }
    else setCalMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear((y) => y + 1); setCalMonth(0); }
    else setCalMonth((m) => m + 1);
  };

  /* ── Handle calendar cell click ── */
  const handleDayClick = useCallback((day) => {
    if (!day) return;
    const dateStr = toDateStr(calYear, calMonth, day);
    const todayStr = today.format("YYYY-MM-DD");
    // Prevent blocking dates in the past
    if (dateStr < todayStr) return;

    if (pickedDate === dateStr) {
      // Deselect
      setPickedDate(null);
      setReason("");
      setCustomReason("");
    } else {
      setPickedDate(dateStr);
      // Pre-fill reason if already blocked
      const existing = blockedDays.find((d) => d.date === dateStr);
      setReason(existing?.reason || "");
      setCustomReason(existing?.reason || "");
    }
  }, [calYear, calMonth, pickedDate, blockedDays, today]);

  /* ── Block / Unblock selected date ── */
  const handleBlock = async () => {
    if (!pickedDate) return;
    setSaving(true);
    const finalReason = reason === "custom" ? customReason.trim() : reason;

    try {
      const item = await blockDate(pickedDate, finalReason);
      setBlockedDays((prev) => {
        const without = prev.filter((d) => d.date !== pickedDate);
        return [...without, item].sort((a, b) => a.date.localeCompare(b.date));
      });
      // Invalidate the shared query so CalendarPage reflects the change immediately
      queryClient.invalidateQueries({ queryKey: ["blocked-days"] });
      message.success(`${dayjs(pickedDate).format("D MMM YYYY")} blocked`);
      setPickedDate(null);
      setReason("");
      setCustomReason("");
    } catch {
      message.error("Failed to block date");
    } finally {
      setSaving(false);
    }
  };

  const handleUnblock = async (dateStr, id) => {
    setSaving(true);
    try {
      await unblockDate(dateStr, id);
      setBlockedDays((prev) => prev.filter((d) => d.date !== dateStr));
      // Invalidate the shared query so CalendarPage reflects the change immediately
      queryClient.invalidateQueries({ queryKey: ["blocked-days"] });
      message.success(`${dayjs(dateStr).format("D MMM YYYY")} unblocked`);
      if (pickedDate === dateStr) {
        setPickedDate(null);
        setReason("");
        setCustomReason("");
      }
    } catch {
      message.error("Failed to unblock date");
    } finally {
      setSaving(false);
    }
  };

  /* ── Upcoming blocked days (today onwards) ── */
  const upcomingBlocked = useMemo(
    () => blockedDays.filter((d) => d.date >= today.format("YYYY-MM-DD")),
    [blockedDays, today]
  );

  /* ── Already blocked? ── */
  const pickedIsBlocked = pickedDate ? blockedSet.has(pickedDate) : false;

  /* ─────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────── */
  return (
    <div
      style={{
        animation: "fadeInUp 0.35s ease both",
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── Page header ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: "linear-gradient(135deg, rgba(187,161,79,0.15), rgba(152,117,84,0.1))",
            border: "1px solid rgba(187,161,79,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: GOLD, flexShrink: 0,
          }}>
            <FiSlash size={18} />
          </div>
          <div>
            <h1 style={{
              margin: 0, fontSize: 22, fontWeight: 700,
              fontFamily: "'Playfair Display', serif", color: "#1a1208",
              lineHeight: 1.2,
            }}>
              Blocked Days
            </h1>
            <p style={{
              margin: 0, fontSize: 12, color: "#987554",
              fontFamily: "'Poppins', sans-serif",
            }}>
              Mark days when the salon is closed or unavailable for bookings
            </p>
          </div>
        </div>
      </div>

      {/* ── Info banner ── */}
      <div style={{
        display: "flex", alignItems: "flex-start", gap: 10,
        padding: "12px 16px",
        background: "rgba(187,161,79,0.10)",
        border: "1px solid rgba(187,161,79,0.30)",
        borderRadius: 12, marginBottom: 24,
      }}>
        <FiInfo size={15} color="#7a6530" style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{
          margin: 0, fontSize: 12,
          color: "#4a3b28",
          fontFamily: "'Poppins', sans-serif",
          lineHeight: 1.6,
        }}>
          Blocked days will be <strong style={{ color: "#7a6530" }}>greyed out and unselectable</strong> in the booking wizard.
          Clients and staff will not be able to create appointments on these dates.
          Past dates cannot be blocked.
        </p>
      </div>

      {/* ── Two-column layout ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "minmax(0,1fr) 340px",
        gap: 24,
        flex: 1,
        minHeight: 0,
        alignItems: "start",
      }}>

        {/* ── LEFT: Calendar + form ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Mini calendar */}
          <div style={{
            background: "#111111",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 16,
            overflow: "hidden",
          }}>
            {/* Calendar header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 18px",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
              background: "#161616",
            }}>
              <button
                onClick={prevMonth}
                style={{
                  width: 30, height: 30, borderRadius: "50%", border: "none",
                  background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(187,161,79,0.15)"; e.currentTarget.style.color = GOLD; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
              >
                <FiChevronLeft size={14} />
              </button>
              <span style={{
                fontSize: 14, fontWeight: 700, color: "#FFFFFF",
                fontFamily: "'Poppins', sans-serif",
              }}>
                {calMonthLabel}
              </span>
              <button
                onClick={nextMonth}
                style={{
                  width: 30, height: 30, borderRadius: "50%", border: "none",
                  background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(187,161,79,0.15)"; e.currentTarget.style.color = GOLD; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
              >
                <FiChevronRight size={14} />
              </button>
            </div>

            {/* Day-of-week headers */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              padding: "10px 12px 4px",
            }}>
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                <div key={d} style={{
                  textAlign: "center", fontSize: 10, fontWeight: 700,
                  color: "rgba(255,255,255,0.3)", fontFamily: "'Poppins', sans-serif",
                  paddingBottom: 6,
                }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Date cells */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 2,
              padding: "0 12px 14px",
            }}>
              {calGrid.map((day, idx) => {
                if (!day) return <div key={`e-${idx}`} />;

                const dateStr     = toDateStr(calYear, calMonth, day);
                const todayStr    = today.format("YYYY-MM-DD");
                const isPast      = dateStr < todayStr;
                const isBlocked   = blockedSet.has(dateStr);
                const isPicked    = pickedDate === dateStr;
                const isCurrentDay = dateStr === todayStr;

                return (
                  <button
                    key={day}
                    onClick={() => handleDayClick(day)}
                    disabled={isPast}
                    title={isBlocked ? (blockedDays.find(d => d.date === dateStr)?.reason || "Blocked") : undefined}
                    style={{
                      width: "100%",
                      aspectRatio: "1",
                      borderRadius: 8,
                      border: isPicked
                        ? `2px solid ${GOLD}`
                        : isCurrentDay
                        ? `2px solid rgba(187,161,79,0.4)`
                        : "2px solid transparent",
                      background: isBlocked
                        ? isPicked
                          ? "rgba(224,80,80,0.25)"
                          : "rgba(224,80,80,0.14)"
                        : isPicked
                        ? `rgba(187,161,79,0.2)`
                        : "transparent",
                      color: isPast
                        ? "rgba(255,255,255,0.15)"
                        : isBlocked
                        ? "#e05050"
                        : isCurrentDay
                        ? GOLD
                        : "#FFFFFF",
                      fontFamily: "'Poppins', sans-serif",
                      fontSize: 12,
                      fontWeight: isCurrentDay || isPicked ? 700 : 400,
                      cursor: isPast ? "not-allowed" : "pointer",
                      transition: "all 0.15s",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      position: "relative",
                    }}
                  >
                    {day}
                    {/* Blocked indicator dot */}
                    {isBlocked && (
                      <span style={{
                        position: "absolute",
                        bottom: 2,
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: 4, height: 4,
                        borderRadius: "50%",
                        background: "#e05050",
                        display: "block",
                      }} />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Calendar legend */}
            <div style={{
              display: "flex", gap: 16, padding: "10px 16px 14px",
              borderTop: "1px solid rgba(255,255,255,0.06)",
            }}>
              {[
                { color: GOLD,     label: "Today / Selected" },
                { color: "#e05050", label: "Blocked" },
              ].map(({ color, label }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />
                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "'Poppins',sans-serif" }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Action panel — shown when a date is picked ── */}
          {pickedDate && (
            <div style={{
              background: "#111111",
              border: `1px solid ${pickedIsBlocked ? "rgba(224,80,80,0.35)" : "rgba(187,161,79,0.3)"}`,
              borderRadius: 16,
              overflow: "hidden",
            }}>
              {/* Panel header */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 18px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                background: pickedIsBlocked
                  ? "rgba(224,80,80,0.08)"
                  : "rgba(187,161,79,0.07)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {pickedIsBlocked
                    ? <FiSlash size={15} color="#e05050" />
                    : <FiCalendar size={15} color={GOLD} />
                  }
                  <div>
                    <p style={{
                      margin: 0, fontSize: 14, fontWeight: 700,
                      color: "#FFFFFF", fontFamily: "'Poppins', sans-serif",
                    }}>
                      {dayjs(pickedDate).format("dddd, D MMMM YYYY")}
                    </p>
                    <p style={{
                      margin: 0, fontSize: 11,
                      color: pickedIsBlocked ? "#e05050" : "rgba(187,161,79,0.75)",
                      fontFamily: "'Poppins', sans-serif",
                    }}>
                      {pickedIsBlocked ? "This day is currently blocked" : "This day is available"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setPickedDate(null); setReason(""); setCustomReason(""); }}
                  style={{
                    width: 28, height: 28, borderRadius: "50%", border: "none",
                    background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <FiX size={13} />
                </button>
              </div>

              <div style={{ padding: "18px 18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Reason presets */}
                <div>
                  <p style={{
                    margin: "0 0 10px",
                    fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                    letterSpacing: "0.1em", color: "rgba(187,161,79,0.6)",
                    fontFamily: "'Poppins', sans-serif",
                  }}>
                    <FiTag size={9} style={{ marginRight: 5 }} />Reason
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                    {REASON_PRESETS.map(({ label, color }) => {
                      const active = reason === label;
                      return (
                        <button
                          key={label}
                          onClick={() => setReason(active ? "" : label)}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 5,
                            padding: "6px 12px", borderRadius: 100,
                            border: `1.5px solid ${active ? color : "rgba(255,255,255,0.1)"}`,
                            background: active ? `${color}20` : "transparent",
                            color: active ? color : "rgba(255,255,255,0.5)",
                            fontFamily: "'Poppins', sans-serif", fontSize: 11, fontWeight: active ? 700 : 400,
                            cursor: "pointer", transition: "all 0.15s",
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                    {/* Custom option */}
                    <button
                      onClick={() => setReason(reason === "custom" ? "" : "custom")}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 5,
                        padding: "6px 12px", borderRadius: 100,
                        border: `1.5px solid ${reason === "custom" ? GOLD : "rgba(255,255,255,0.1)"}`,
                        background: reason === "custom" ? "rgba(187,161,79,0.12)" : "transparent",
                        color: reason === "custom" ? GOLD : "rgba(255,255,255,0.5)",
                        fontFamily: "'Poppins', sans-serif", fontSize: 11, fontWeight: reason === "custom" ? 700 : 400,
                        cursor: "pointer", transition: "all 0.15s",
                      }}
                    >
                      Custom…
                    </button>
                  </div>
                </div>

                {/* Custom reason input */}
                {reason === "custom" && (
                  <input
                    type="text"
                    placeholder="e.g. Owner's wedding"
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    autoFocus
                    style={{
                      background: "#1a1a1a",
                      border: "1.5px solid rgba(187,161,79,0.35)",
                      borderRadius: 10,
                      padding: "10px 14px",
                      fontSize: 13,
                      fontFamily: "'Poppins', sans-serif",
                      color: "#FFFFFF",
                      outline: "none",
                      width: "100%",
                      boxSizing: "border-box",
                      caretColor: GOLD,
                      transition: "border-color 0.18s",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = GOLD)}
                    onBlur={(e) => (e.target.style.borderColor = "rgba(187,161,79,0.35)")}
                  />
                )}

                {/* Action buttons */}
                <div style={{ display: "flex", gap: 10 }}>
                  {pickedIsBlocked ? (
                    <>
                      {/* Unblock */}
                      <button
                        onClick={() => {
                          const item = blockedDays.find((d) => d.date === pickedDate);
                          if (item) handleUnblock(item.date, item.id);
                        }}
                        disabled={saving}
                        style={{
                          flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                          padding: "10px 16px", borderRadius: 10,
                          border: "1.5px solid rgba(34,160,80,0.4)",
                          background: "rgba(34,160,80,0.1)",
                          color: "#22a050",
                          fontFamily: "'Poppins', sans-serif", fontSize: 12, fontWeight: 700,
                          cursor: saving ? "not-allowed" : "pointer", transition: "all 0.15s",
                        }}
                      >
                        {saving ? <Spin size="small" /> : <><FiCheckCircle size={14} /> Unblock this day</>}
                      </button>
                      {/* Update reason */}
                      <button
                        onClick={handleBlock}
                        disabled={saving}
                        style={{
                          flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                          padding: "10px 16px", borderRadius: 10, border: "none",
                          background: saving ? "rgba(187,161,79,0.4)" : `linear-gradient(135deg, ${GOLD}, ${BROWN})`,
                          color: "#fff",
                          fontFamily: "'Poppins', sans-serif", fontSize: 12, fontWeight: 700,
                          cursor: saving ? "not-allowed" : "pointer",
                          boxShadow: saving ? "none" : "0 3px 12px rgba(187,161,79,0.35)",
                          transition: "all 0.15s",
                        }}
                      >
                        Update Reason
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleBlock}
                      disabled={saving || (reason === "custom" && !customReason.trim())}
                      style={{
                        flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                        padding: "11px 16px", borderRadius: 10, border: "none",
                        background:
                          saving || (reason === "custom" && !customReason.trim())
                            ? "rgba(224,80,80,0.3)"
                            : "linear-gradient(135deg, #e05050, #c03030)",
                        color: "#fff",
                        fontFamily: "'Poppins', sans-serif", fontSize: 13, fontWeight: 700,
                        cursor: saving ? "not-allowed" : "pointer",
                        boxShadow: "0 4px 14px rgba(224,80,80,0.3)",
                        transition: "all 0.15s",
                      }}
                    >
                      {saving ? <Spin size="small" /> : <><FiSlash size={14} /> Block this day</>}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Prompt to pick a date */}
          {!pickedDate && (
            <div style={{
              padding: "20px",
              background: "rgba(255,255,255,0.025)",
              border: "1px dashed rgba(255,255,255,0.08)",
              borderRadius: 14,
              textAlign: "center",
              color: "rgba(255,255,255,0.25)",
              fontFamily: "'Poppins', sans-serif",
              fontSize: 12,
            }}>
              Click any upcoming date on the calendar to block or unblock it
            </div>
          )}
        </div>

        {/* ── RIGHT: Blocked days list ── */}
        <div style={{
          background: "#111111",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 16,
          overflow: "hidden",
          alignSelf: "start",
        }}>
          {/* List header */}
          <div style={{
            padding: "14px 18px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            background: "#161616",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <FiAlertTriangle size={14} color="#e05050" />
              <span style={{
                fontSize: 13, fontWeight: 700, color: "#FFFFFF",
                fontFamily: "'Poppins', sans-serif",
              }}>
                Blocked Days
              </span>
            </div>
            <span style={{
              fontSize: 10, fontWeight: 700,
              color: upcomingBlocked.length > 0 ? "#e05050" : "rgba(255,255,255,0.2)",
              fontFamily: "'Poppins', sans-serif",
              background: upcomingBlocked.length > 0 ? "rgba(224,80,80,0.12)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${upcomingBlocked.length > 0 ? "rgba(224,80,80,0.3)" : "rgba(255,255,255,0.06)"}`,
              borderRadius: 100,
              padding: "3px 10px",
            }}>
              {upcomingBlocked.length} upcoming
            </span>
          </div>

          {/* Loading */}
          {loading && (
            <div style={{ padding: "32px", display: "flex", justifyContent: "center" }}>
              <Spin />
            </div>
          )}

          {/* Empty state */}
          {!loading && upcomingBlocked.length === 0 && (
            <div style={{
              padding: "40px 24px",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
              color: "rgba(255,255,255,0.2)",
            }}>
              <FiCheckCircle size={36} style={{ opacity: 0.3 }} />
              <p style={{ margin: 0, fontSize: 12, fontFamily: "'Poppins', sans-serif", textAlign: "center" }}>
                No upcoming blocked days.<br />The salon is open every day.
              </p>
            </div>
          )}

          {/* Blocked days list */}
          {!loading && upcomingBlocked.length > 0 && (
            <div style={{ maxHeight: 540, overflowY: "auto", scrollbarWidth: "none" }}>
              {upcomingBlocked.map((item, idx) => {
                const d = dayjs(item.date);
                const isThisMonth = d.month() === today.month() && d.year() === today.year();
                const daysAway = d.diff(today.startOf("day"), "day");
                const preset = REASON_PRESETS.find((p) => p.label === item.reason);

                return (
                  <div
                    key={item.date}
                    style={{
                      display: "flex", alignItems: "center", gap: 14,
                      padding: "13px 18px",
                      borderBottom: idx < upcomingBlocked.length - 1
                        ? "1px solid rgba(255,255,255,0.05)"
                        : "none",
                      transition: "background 0.15s",
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      setCalYear(d.year());
                      setCalMonth(d.month());
                      setPickedDate(item.date);
                      setReason(item.reason || "");
                      setCustomReason(item.reason || "");
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    {/* Date badge */}
                    <div style={{
                      width: 42, height: 42, borderRadius: 10, flexShrink: 0,
                      background: "rgba(224,80,80,0.12)",
                      border: "1px solid rgba(224,80,80,0.25)",
                      display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center",
                    }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: "#e05050", fontFamily: "'Poppins', sans-serif", lineHeight: 1 }}>
                        {d.format("D")}
                      </span>
                      <span style={{ fontSize: 8, fontWeight: 600, color: "rgba(224,80,80,0.65)", fontFamily: "'Poppins', sans-serif", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {d.format("MMM")}
                      </span>
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        margin: 0, fontSize: 13, fontWeight: 700,
                        color: "#FFFFFF", fontFamily: "'Poppins', sans-serif",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>
                        {d.format("dddd")}
                        {isThisMonth && <span style={{ color: GOLD, fontSize: 10, marginLeft: 6 }}>this month</span>}
                      </p>
                      <p style={{
                        margin: 0, fontSize: 11, fontFamily: "'Poppins', sans-serif",
                        display: "flex", alignItems: "center", gap: 5,
                        color: preset ? preset.color : "rgba(255,255,255,0.4)",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>
                        {item.reason || <span style={{ color: "rgba(255,255,255,0.25)" }}>No reason given</span>}
                      </p>
                      <p style={{
                        margin: "2px 0 0", fontSize: 10,
                        color: daysAway === 0 ? GOLD : "rgba(255,255,255,0.2)",
                        fontFamily: "'Poppins', sans-serif",
                      }}>
                        {daysAway === 0 ? "Today" : `in ${daysAway} day${daysAway !== 1 ? "s" : ""}`}
                      </p>
                    </div>

                    {/* Unblock button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleUnblock(item.date, item.id); }}
                      disabled={saving}
                      title="Unblock this day"
                      style={{
                        width: 30, height: 30, borderRadius: 8, border: "none",
                        background: "rgba(224,80,80,0.1)",
                        color: "#e05050",
                        cursor: saving ? "not-allowed" : "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0, transition: "all 0.15s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(224,80,80,0.22)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(224,80,80,0.1)"; }}
                    >
                      <FiTrash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
