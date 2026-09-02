import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal, Form, Input, Select, DatePicker, message, Tooltip, Spin } from "antd";
import dayjs from "dayjs";
import {
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiUser,
  FiScissors,
  FiCalendar,
  FiGrid,
  FiList,
  FiPlus,
  FiX,
  FiSearch,
  FiCheck,
  FiUserPlus,
  FiUsers,
  FiTag,
  FiPhone,
  FiMail,
  FiArrowRight,
  FiArrowLeft,
  FiStar,
  FiAlertCircle,
  FiDollarSign,
  FiCheckCircle,
  FiSlash,
  FiCreditCard,
  FiActivity,
} from "react-icons/fi";
import _axios from "../src/api/_axios";
import { fetchBlockedDays } from "../src/api/blockedDays";
import { createWaitlistEntry } from "../src/api/waitlist";
import { firstApiErrorMessage } from "../src/api/apiErrors";
import {
  buildWalkInAppointmentPayload,
  getBookingStaffOptions,
  normalizeBookingStaffOptions,
  normalizeStaffRecommendation,
  recommendWalkInStaff,
} from "../src/api/walkIn";
import AppointmentCheckoutDrawer from "../Components/AppointmentCheckoutDrawer";
import PortalSelect from "../Components/PortalSelect";

/* ─────────────────────────────────────────────
   CONSTANTS & HELPERS
───────────────────────────────────────────── */
const CALENDAR_START_HOUR = 0;  // 12:00 AM
const CALENDAR_END_HOUR   = 24; // midnight boundary after 11:45 PM
const BOOKING_START_HOUR  = 8;  // booking wizard availability starts at 08:00
const BOOKING_END_HOUR    = 20; // booking wizard availability ends at 20:00
const SLOT_MINS = 15;
const TOTAL_SLOTS = ((CALENDAR_END_HOUR - CALENDAR_START_HOUR) * 60) / SLOT_MINS; // 96
const SLOT_HEIGHT_PX = 18;      // four compact quarter-hour rows = 72px per hour
const COLUMN_W = 220;           // px width per person column

// Warm stone surfaces keep the dense calendar comfortable during long shifts.
const CALENDAR_SURFACE = {
  shell: "#E7E1D8",
  raised: "#F0ECE5",
  muted: "#E3DDD3",
  grid: "#ECE7DF",
  cardTop: "#F4F0EA",
  cardBottom: "#EAE4DC",
};

const AVATAR_COLORS = [
  ["#BBA14F", "#987554"],
  ["#987554", "#6b4f30"],
  ["#4f7aa8", "#2d5a84"],
  ["#7a4fa8", "#5a2d84"],
  ["#4fa87a", "#2d845a"],
  ["#a84f4f", "#843232"],
  ["#4fa8a8", "#2d8484"],
];

function avatarGradient(name = "") {
  const idx = (name.charCodeAt(0) || 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function initials(name = "") {
  return (name || "?")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/** Convert "HH:MM" → minutes from the start of the calendar day */
function timeToMins(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  return (h - CALENDAR_START_HOUR) * 60 + m;
}

/** Minutes from the start of the calendar day → "HH:MM" */
function minsToTime(mins) {
  const total = mins + CALENDAR_START_HOUR * 60;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Pixel Y offset from top of grid */
function minsToY(mins) {
  const slot = mins / SLOT_MINS;
  return slot * SLOT_HEIGHT_PX;
}

/** Exact current position in the GMT+0 day, including seconds. */
function getGmtMinutes(date = new Date()) {
  return (
    (date.getUTCHours() - CALENDAR_START_HOUR) * 60 +
    date.getUTCMinutes() +
    date.getUTCSeconds() / 60 +
    date.getUTCMilliseconds() / 60_000
  );
}

/** Slot index from raw pixel y */
function yToSlot(y) {
  return Math.max(0, Math.min(TOTAL_SLOTS - 1, Math.round(y / SLOT_HEIGHT_PX)));
}

function formatDisplayTime(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatCurrentTime(minutesFromMidnight) {
  const totalMinutes = Math.floor(Math.max(0, minutesFromMidnight));
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** Convert a schedule API time ("HH:MM" or "HH:MM:SS") to minutes after midnight. */
function scheduleTimeToMins(timeStr) {
  const [hours, minutes] = String(timeStr ?? "").split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

/** The schedule API uses Monday=0 through Sunday=6. */
function scheduleWeekday(date) {
  return (date.getUTCDay() + 6) % 7;
}

/** A complete 15-minute cell must be inside an active schedule window. */
function isSlotInsideSchedule(scheduleEntries, slotStartMins) {
  const slotEndMins = slotStartMins + SLOT_MINS;
  const parsedEntries = scheduleEntries
    .map((entry) => ({
      ...entry,
      startMins: scheduleTimeToMins(entry.start_time),
      endMins: scheduleTimeToMins(entry.end_time),
    }))
    .filter((entry) => entry.startMins !== null && entry.endMins !== null);

  const insideActiveWindow = parsedEntries.some(
    (entry) =>
      entry.is_available !== false &&
      slotStartMins >= entry.startMins &&
      slotEndMins <= entry.endMins
  );
  const overlapsInactiveWindow = parsedEntries.some(
    (entry) =>
      entry.is_available === false &&
      slotStartMins < entry.endMins &&
      slotEndMins > entry.startMins
  );

  return insideActiveWindow && !overlapsInactiveWindow;
}

/**
 * Split a staff member's appointments into independent overlap clusters, then
 * assign lanes inside each cluster. A busy hour no longer narrows every card
 * in the rest of that staff member's day.
 */
function layoutBookingLanes(bookings) {
  const sorted = [...bookings].sort((a, b) => {
    const startDiff = timeToMins(a.startTime) - timeToMins(b.startTime);
    if (startDiff !== 0) return startDiff;
    return b.durationMins - a.durationMins;
  });
  const clusters = [];
  let currentCluster = [];
  let clusterEnd = -Infinity;

  sorted.forEach((booking) => {
    const start = timeToMins(booking.startTime);
    const end = start + booking.durationMins;
    if (currentCluster.length > 0 && start >= clusterEnd) {
      clusters.push(currentCluster);
      currentCluster = [];
      clusterEnd = -Infinity;
    }
    currentCluster.push(booking);
    clusterEnd = Math.max(clusterEnd, end);
  });
  if (currentCluster.length > 0) clusters.push(currentCluster);

  return clusters.flatMap((cluster) => {
    const laneEnds = [];
    const positioned = cluster.map((booking) => {
      const start = timeToMins(booking.startTime);
      const end = start + booking.durationMins;
      let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(end);
      } else {
        laneEnds[lane] = end;
      }
      return { booking, lane };
    });
    const laneCount = Math.max(1, laneEnds.length);
    return positioned.map((item) => ({ ...item, laneCount }));
  });
}

function normalizeServiceOptions(service = {}) {
  const rawOptions =
    service.service_options ??
    service.options ??
    service.service_option_details ??
    [];

  return rawOptions
    .map((option) => ({
      id: option?.id,
      name: option?.name ?? "",
      description: option?.description ?? "",
      duration: Number(option?.duration ?? service.duration ?? 0) || null,
      price: parseFloat(option?.price ?? option?.amount ?? service.price ?? service.amount ?? 0) || 0,
      priceType:
        option?.price_type ??
        (parseFloat(option?.price ?? option?.amount ?? service.price ?? service.amount ?? 0) <= 0
          ? "free"
          : service.price_type ?? "fixed"),
      isActive: option?.is_active !== false,
    }))
    .filter((option) => option.id != null && option.isActive);
}

function getSelectedServiceOption(service, selectedServiceOptions = {}) {
  const optionId = selectedServiceOptions?.[service?.id];
  if (!optionId) return null;
  return normalizeServiceOptions(service).find((option) => String(option.id) === String(optionId)) ?? null;
}

function getServiceDisplayAmount(service, selectedServiceOptions = {}) {
  const selectedOption = getSelectedServiceOption(service, selectedServiceOptions);
  const rawAmount = selectedOption?.price ?? service?.price ?? service?.amount ?? 0;
  const amount = parseFloat(rawAmount);
  return Number.isFinite(amount) ? amount : 0;
}

function getServiceDisplayPrice(service, selectedServiceOptions = {}) {
  const selectedOption = getSelectedServiceOption(service, selectedServiceOptions);
  const amount = getServiceDisplayAmount(service, selectedServiceOptions);
  const priceType = selectedOption?.priceType ?? service?.price_type ?? (amount <= 0 ? "free" : "fixed");

  if (priceType === "free" || amount <= 0) return "Free";

  const formatted = `GH₵ ${amount.toFixed(2)}`;
  return priceType === "from" ? `From ${formatted}` : formatted;
}

/* ─────────────────────────────────────────────
   STATUS CONFIG
───────────────────────────────────────────── */
const STATUS_CFG = {
  confirmed:       { label: "Confirmed",       border: "#D4A847", dot: "#BBA14F"  },
  "in-progress":   { label: "In Progress",    border: "#5282FF", dot: "#5282ff"  },
  in_progress:     { label: "In Progress",    border: "#5282FF", dot: "#5282ff"  },
  pending:         { label: "Pending",         border: "#F0A830", dot: "#f5b43c"  },
  completed:       { label: "Completed",       border: "#2EAA60", dot: "#22a050"  },
  arrived:         { label: "Arrived",         border: "#22a050", dot: "#22a050"  },
  "No-Show":       { label: "No Show",         border: "#e05050", dot: "#e05050"  },
  "no-show":       { label: "No Show",         border: "#e05050", dot: "#e05050"  },
  no_show:         { label: "No Show",         border: "#e05050", dot: "#e05050"  },
  pending_deposit: { label: "Deposit Pending", border: "#D4A847", dot: "#f5b43c" },
  "pending-deposit":{ label: "Deposit Pending",border: "#D4A847", dot: "#f5b43c" },
  cancelled:       { label: "Cancelled",       border: "#e05050", dot: "#e05050"  },
  expired:         { label: "Expired",         border: "#a87050", dot: "#a87050" },
};

/** Robust STATUS_CFG lookup that handles both hyphen and underscore status formats */
function getStatusCfg(status) {
  return (
    STATUS_CFG[status] ||
    STATUS_CFG[status?.replace(/-/g, "_")] ||
    STATUS_CFG[status?.replace(/_/g, "-")] ||
    STATUS_CFG.pending
  );
}

/* ─────────────────────────────────────────────
   BOOKING WIZARD — SHARED STYLES / HELPERS
───────────────────────────────────────────── */
const WZ = {
  inputBase: {
    background: "#fff",
    border: "1.5px solid #e8e0d0",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 13,
    fontFamily: "'Poppins', sans-serif",
    color: "#272727",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    transition: "border-color 0.18s",
  },
  label: {
    fontSize: 11,
    fontWeight: 700,
    color: "#3d2e1e",
    fontFamily: "'Poppins', sans-serif",
    marginBottom: 5,
    display: "block",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  pill: (active) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "6px 14px",
    borderRadius: 100,
    border: `1.5px solid ${active ? "#BBA14F" : "#e0d5c5"}`,
    background: active ? "linear-gradient(135deg,#BBA14F22,#98755422)" : "#fff",
    color: active ? "#BBA14F" : "#987554",
    fontSize: 12,
    fontWeight: active ? 700 : 500,
    fontFamily: "'Poppins', sans-serif",
    cursor: "pointer",
    transition: "all 0.18s",
  }),
  sectionLabel: {
    fontSize: 9,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "rgba(187,161,79,0.7)",
    fontFamily: "'Poppins', sans-serif",
    margin: "0 0 8px",
  },
};

/* ── Step indicator ── */
function WizardSteps({ current }) {
  const steps = ["Client", "Services", "Options", "Date & Time", "Staff", "Confirm"];
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, padding: "16px 24px 14px" }}>
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <React.Fragment key={i}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 56 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: done ? "#BBA14F" : active ? "linear-gradient(135deg,#BBA14F,#987554)" : "rgba(187,161,79,0.12)",
                border: active ? "2px solid #BBA14F" : done ? "2px solid #BBA14F" : "2px solid rgba(187,161,79,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.25s",
                boxShadow: active ? "0 0 0 3px rgba(187,161,79,0.2)" : "none",
              }}>
                {done
                  ? <FiCheck size={13} color="#fff" />
                  : <span style={{ fontSize: 11, fontWeight: 700, color: active ? "#fff" : "rgba(187,161,79,0.6)", fontFamily: "'Poppins',sans-serif" }}>{i + 1}</span>
                }
              </div>
              <span style={{
                fontSize: 9, fontWeight: active ? 700 : 500,
                color: active ? "#BBA14F" : done ? "#987554" : "rgba(152,117,84,0.5)",
                fontFamily: "'Poppins',sans-serif", whiteSpace: "nowrap",
              }}>{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                flex: 1, height: 2, marginBottom: 18,
                background: done ? "linear-gradient(90deg,#BBA14F,#987554)" : "rgba(187,161,79,0.15)",
                transition: "background 0.3s",
              }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ── Step 1: Client ── */
function StepClient({ clientMode, setClientMode, selectedClient, setSelectedClient, walkIn, setWalkIn }) {
  const [search, setSearch] = useState("");

  const { data: customersRaw, isFetching } = useQuery({
    queryKey: ["customers-list"],
    queryFn: () =>
      _axios
        .get("/api/portal/v1/accounts/customers/")
        .then((r) => r.data),
    staleTime: 30_000,
    enabled: clientMode === "existing",
  });
  const customers = useMemo(() => {
    if (!customersRaw) return [];
    return Array.isArray(customersRaw) ? customersRaw : customersRaw.results ?? [];
  }, [customersRaw]);

  const nameOf = (c) =>
    [c.first_name, c.last_name].filter(Boolean).join(" ") ||
    c.full_name || c.name || `Client #${c.id}`;

  const filteredCustomers = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.trim().toLowerCase();
    return customers.filter((customer) => {
      const name = nameOf(customer).toLowerCase();
      const phone = String(customer.phone || customer.phone_number || "").toLowerCase();
      const email = String(customer.email || "").toLowerCase();
      return name.includes(q) || phone.includes(q) || email.includes(q);
    });
  }, [customers, search]);

  const inputFocus = (e) => (e.target.style.borderColor = "#BBA14F");
  const inputBlur = (e) => (e.target.style.borderColor = "#e8e0d0");

  return (
    <div style={{ padding: "0 28px 24px" }}>
      {/* Mode tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[
          { key: "existing", label: "Existing Client", icon: <FiUser size={13} /> },
          { key: "walkin",   label: "Walk-in / New",   icon: <FiUserPlus size={13} /> },
        ].map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => { setClientMode(key); setSelectedClient(null); }}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              padding: "10px 14px", borderRadius: 10, cursor: "pointer",
              border: `1.5px solid ${clientMode === key ? "#BBA14F" : "#e0d5c5"}`,
              background: clientMode === key ? "linear-gradient(135deg,rgba(187,161,79,0.12),rgba(152,117,84,0.08))" : "#fff",
              color: clientMode === key ? "#BBA14F" : "#987554",
              fontFamily: "'Poppins',sans-serif", fontSize: 12, fontWeight: clientMode === key ? 700 : 500,
              transition: "all 0.18s",
            }}
          >
            {icon}{label}
          </button>
        ))}
      </div>

      {clientMode === "existing" ? (
        <div>
          {/* Search */}
          <div style={{ position: "relative", marginBottom: 14 }}>
            <FiSearch size={13} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#BBA14F", pointerEvents: "none" }} />
            <input
              type="text"
              placeholder="Search by name or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...WZ.inputBase, paddingLeft: 36, paddingRight: search ? 36 : 14 }}
              onFocus={inputFocus}
              onBlur={inputBlur}
            />
            {search && (
              <button onClick={() => setSearch("")} style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#aaa", fontSize: 13 }}>✕</button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: 280, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, paddingRight: 2 }}>
            {isFetching && !customers.length ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "28px 0" }}>
                <Spin size="small" />
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div style={{ textAlign: "center", padding: "28px 0", color: "#aaa", fontSize: 13, fontFamily: "'Poppins',sans-serif" }}>
                {search ? `No clients found for "${search}"` : "No clients yet"}
              </div>
            ) : (
              filteredCustomers.map((c) => {
                const name = nameOf(c);
                const [from, to] = avatarGradient(name);
                const isSelected = selectedClient?.id === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedClient(isSelected ? null : c)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 14px", borderRadius: 12, cursor: "pointer",
                      border: `1.5px solid ${isSelected ? "#BBA14F" : "#ede8de"}`,
                      background: isSelected ? "linear-gradient(135deg,rgba(187,161,79,0.1),rgba(152,117,84,0.07))" : "#faf8f4",
                      transition: "all 0.15s", textAlign: "left",
                    }}
                  >
                    <div style={{
                      width: 38, height: 38, borderRadius: "50%",
                      background: `linear-gradient(135deg,${from},${to})`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0,
                      fontFamily: "'Poppins',sans-serif",
                      boxShadow: isSelected ? `0 0 0 2.5px #BBA14F` : "none",
                    }}>
                      {initials(name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#272727", fontFamily: "'Poppins',sans-serif", lineHeight: 1.25 }}>{name}</p>
                      {c.phone && <p style={{ margin: 0, fontSize: 11, color: "#987554", fontFamily: "'Poppins',sans-serif" }}>{c.phone}</p>}
                    </div>
                    {isSelected && (
                      <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#BBA14F", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <FiCheck size={12} color="#fff" />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* Walk-in form */
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={WZ.label}>Full Name <span style={{ color: "#e05050" }}>*</span></label>
            <input
              type="text"
              placeholder="e.g. Nadia Osei"
              value={walkIn.name}
              onChange={(e) => setWalkIn((p) => ({ ...p, name: e.target.value }))}
              style={{ ...WZ.inputBase, paddingLeft: 16 }}
              onFocus={inputFocus}
              onBlur={inputBlur}
            />
          </div>
          <div>
            <label style={WZ.label}>Phone Number <span style={{ color: "#e05050" }}>*</span></label>
            <input
              type="tel"
              placeholder="e.g. 0244 123 456"
              value={walkIn.phone}
              onChange={(e) => setWalkIn((p) => ({ ...p, phone: e.target.value }))}
              style={{ ...WZ.inputBase, paddingLeft: 16 }}
              onFocus={inputFocus}
              onBlur={inputBlur}
            />
          </div>
          <div>
            <label style={WZ.label}>Email <span style={{ color: "#aaa", fontSize: 10, textTransform: "none", fontWeight: 400, letterSpacing: 0 }}>optional</span></label>
            <input
              type="email"
              placeholder="e.g. nadia@example.com"
              value={walkIn.email}
              onChange={(e) => setWalkIn((p) => ({ ...p, email: e.target.value }))}
              style={{ ...WZ.inputBase, paddingLeft: 16 }}
              onFocus={inputFocus}
              onBlur={inputBlur}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Step 2: Services ── */
function StepServices({ servicesData, categoriesData, selectedServices, setSelectedServices }) {
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState(null);

  const priceOf = (s) => {
    if (s.price_type === "free") return "Free";
    const amt = parseFloat(s.price || s.amount || 0);
    if (amt <= 0) return "Free";
    const formatted = `GH₵ ${amt.toFixed(2)}`;
    return s.price_type === "from" ? `From ${formatted}` : formatted;
  };

  const filtered = useMemo(() => {
    let list = servicesData || [];
    if (activeCat) list = list.filter((s) => s.category === activeCat || s.category?.id === activeCat);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) => s.name?.toLowerCase().includes(q));
    }
    return list;
  }, [servicesData, activeCat, search]);

  // Group by category
  const byCategory = useMemo(() => {
    const map = {};
    filtered.forEach((s) => {
      const catId = s.category?.id ?? s.category ?? "uncategorized";
      const catName = s.category?.name ?? categoriesData?.find((c) => c.id === catId)?.name ?? "Other";
      if (!map[catId]) map[catId] = { name: catName, services: [] };
      map[catId].services.push(s);
    });
    return Object.values(map);
  }, [filtered, categoriesData]);

  const isSelected = (id) => selectedServices.some((s) => s.id === id);
  const toggle = (svc) => {
    setSelectedServices((prev) => {
      if (prev.some((service) => service.id === svc.id)) {
        return prev.filter((service) => service.id !== svc.id);
      }
      return [...prev, {
        ...svc,
        _price: priceOf(svc),
        _amount: parseFloat(svc.price || svc.amount || 0),
        _isFrom: svc.price_type === "from",
      }];
    });
  };

  const moveService = (index, direction) => {
    setSelectedServices((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const inputFocus = (e) => (e.target.style.borderColor = "#BBA14F");
  const inputBlur = (e) => (e.target.style.borderColor = "#e8e0d0");

  return (
    <div style={{ padding: "0 28px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Search */}
      <div style={{ position: "relative" }}>
        <FiSearch size={13} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "#BBA14F", pointerEvents: "none" }} />
        <input
          type="text"
          placeholder="Search services…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...WZ.inputBase, paddingLeft: 36 }}
          onFocus={inputFocus}
          onBlur={inputBlur}
        />
      </div>

      {/* Category chips */}
      {categoriesData && categoriesData.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={() => setActiveCat(null)} style={WZ.pill(!activeCat)}>All</button>
          {categoriesData.map((c) => (
            <button key={c.id} onClick={() => setActiveCat(activeCat === c.id ? null : c.id)} style={WZ.pill(activeCat === c.id)}>{c.name}</button>
          ))}
        </div>
      )}

      {/* Service list */}
      <div style={{ maxHeight: 310, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, paddingRight: 2 }}>
        {byCategory.length === 0 ? (
          <div style={{ textAlign: "center", padding: "28px 0", color: "#aaa", fontSize: 13, fontFamily: "'Poppins',sans-serif" }}>No services found</div>
        ) : byCategory.map((group) => (
          <div key={group.name}>
            <p style={WZ.sectionLabel}>{group.name}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {group.services.map((svc) => {
                const sel = isSelected(svc.id);
                const optionCount = normalizeServiceOptions(svc).length;
                return (
                  <button
                    key={svc.id}
                    onClick={() => toggle(svc)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "11px 14px", borderRadius: 12, cursor: "pointer",
                      border: `1.5px solid ${sel ? "#BBA14F" : "#ede8de"}`,
                      background: sel ? "linear-gradient(135deg,rgba(187,161,79,0.1),rgba(152,117,84,0.07))" : "#faf8f4",
                      transition: "all 0.15s", textAlign: "left",
                    }}
                  >
                    <div style={{
                      width: 34, height: 34, borderRadius: 9,
                      background: sel ? "linear-gradient(135deg,#BBA14F,#987554)" : "rgba(187,161,79,0.12)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, transition: "all 0.15s",
                    }}>
                      <FiScissors size={14} color={sel ? "#fff" : "#BBA14F"} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#272727", fontFamily: "'Poppins',sans-serif", lineHeight: 1.25 }}>{svc.name}</p>
                      <p style={{ margin: 0, fontSize: 11, color: "#987554", fontFamily: "'Poppins',sans-serif" }}>
                        {svc.duration ? `${svc.duration} min` : "Duration varies"}
                        {optionCount > 0 ? ` · ${optionCount} option${optionCount !== 1 ? "s" : ""}` : " · No extra options"}
                      </p>
                    </div>
                    <span style={{
                      fontSize: 12, fontWeight: 700,
                      color: sel ? "#BBA14F" : "#987554",
                      fontFamily: "'Poppins',sans-serif", flexShrink: 0,
                    }}>{priceOf(svc)}</span>
                    <div style={{
                      width: 22, height: 22, borderRadius: "50%",
                      background: sel ? "#BBA14F" : "rgba(187,161,79,0.12)",
                      border: `1.5px solid ${sel ? "#BBA14F" : "rgba(187,161,79,0.3)"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, transition: "all 0.15s",
                    }}>
                      {sel && <FiCheck size={11} color="#fff" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Ordered service journey */}
      {selectedServices.length > 0 && (
        <div style={{ padding: "12px 14px", background: "rgba(187,161,79,0.08)", borderRadius: 12, border: "1px solid rgba(187,161,79,0.25)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 9 }}>
            <p style={{ ...WZ.sectionLabel, margin: 0 }}>Service order</p>
            <strong style={{ color: "#BBA14F", fontSize: 11, fontFamily: "'Poppins',sans-serif" }}>
              {selectedServices.every((s) => s._amount === 0)
                ? "Free"
                : `${selectedServices.some((s) => s._isFrom) ? "From " : ""}GH₵ ${selectedServices.reduce((a, s) => a + s._amount, 0).toFixed(2)}`}
            </strong>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {selectedServices.map((service, index) => (
              <div key={service.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 9px", borderRadius: 9, background: "#fff", border: "1px solid rgba(187,161,79,0.16)" }}>
                <span style={{ width: 23, height: 23, borderRadius: "50%", display: "grid", placeItems: "center", flexShrink: 0, background: "#272727", color: "#e4ca80", fontSize: 10, fontWeight: 800, fontFamily: "'Poppins',sans-serif" }}>{index + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, color: "#272727", fontSize: 11, fontWeight: 700, fontFamily: "'Poppins',sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{service.name}</p>
                  <p style={{ margin: 0, color: "#987554", fontSize: 9, fontFamily: "'Poppins',sans-serif" }}>{service.duration ? `${service.duration} min` : "Duration set by option"}</p>
                </div>
                <div style={{ display: "flex", gap: 3 }}>
                  <button aria-label={`Move ${service.name} earlier`} disabled={index === 0} onClick={() => moveService(index, -1)} style={{ border: 0, background: "transparent", color: index === 0 ? "#d7cdbf" : "#987554", cursor: index === 0 ? "not-allowed" : "pointer", padding: 4 }}>↑</button>
                  <button aria-label={`Move ${service.name} later`} disabled={index === selectedServices.length - 1} onClick={() => moveService(index, 1)} style={{ border: 0, background: "transparent", color: index === selectedServices.length - 1 ? "#d7cdbf" : "#987554", cursor: index === selectedServices.length - 1 ? "not-allowed" : "pointer", padding: 4 }}>↓</button>
                  <button aria-label={`Remove ${service.name}`} onClick={() => toggle(service)} style={{ border: 0, background: "transparent", color: "#c45b54", cursor: "pointer", padding: 4 }}><FiX size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Step 3: Service options ── */
function StepServiceOptions({ selectedServices, selectedServiceOptions, setSelectedServiceOptions }) {
  const setOption = (serviceId, optionId) => {
    setSelectedServiceOptions((prev) => ({ ...prev, [serviceId]: optionId }));
  };

  return (
    <div style={{ padding: "0 28px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
      {selectedServices.map((svc) => {
        const options = normalizeServiceOptions(svc);
        const currentOptionId = selectedServiceOptions[svc.id];

        return (
          <div key={svc.id}>
            <p style={{ ...WZ.sectionLabel, marginBottom: 8 }}>
              <FiScissors size={10} style={{ marginRight: 5 }} />{svc.name}
            </p>

            {options.length === 0 ? (
              <div style={{
                padding: "12px 14px",
                borderRadius: 12,
                background: "rgba(187,161,79,0.08)",
                border: "1px solid rgba(187,161,79,0.18)",
              }}>
                <p style={{ margin: 0, fontSize: 12, color: "#987554", fontFamily: "'Poppins',sans-serif" }}>
                  This service has no extra options. You can continue to date and time.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {options.map((option) => {
                  const selected = String(currentOptionId) === String(option.id);
                  return (
                    <button
                      key={option.id}
                      onClick={() => setOption(svc.id, option.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "11px 14px", borderRadius: 12, cursor: "pointer",
                        border: `1.5px solid ${selected ? "#BBA14F" : "#ede8de"}`,
                        background: selected ? "linear-gradient(135deg,rgba(187,161,79,0.1),rgba(152,117,84,0.07))" : "#faf8f4",
                        transition: "all 0.15s", textAlign: "left",
                      }}
                    >
                      <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: selected ? "linear-gradient(135deg,#BBA14F,#987554)" : "rgba(187,161,79,0.12)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}>
                        <FiTag size={14} color={selected ? "#fff" : "#BBA14F"} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#272727", fontFamily: "'Poppins',sans-serif", lineHeight: 1.25 }}>{option.name}</p>
                        <p style={{ margin: 0, fontSize: 11, color: "#987554", fontFamily: "'Poppins',sans-serif" }}>
                          {option.duration ? `${option.duration} min` : "Duration varies"}
                          {option.description ? ` · ${option.description}` : ""}
                        </p>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: selected ? "#BBA14F" : "#987554", fontFamily: "'Poppins',sans-serif", flexShrink: 0 }}>
                        {getServiceDisplayPrice(svc, { [svc.id]: option.id })}
                      </span>
                      {selected && (
                        <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#BBA14F", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <FiCheck size={12} color="#fff" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Step 4: Staff ── */
function StepStaff({
  selectedServices,
  selectedServiceOptions,
  staffPerService,
  setStaffPerService,
  serviceAvailabilityMap,
  isLoadingAvailability,
  availabilityError,
  onRetryAvailability,
  recommendations,
  recommendingServiceId,
  onRecommend,
}) {
  const setStaff = (svcId, staffId) => {
    setStaffPerService((prev) => ({ ...prev, [svcId]: staffId }));
  };

  const windowTime = (value) => {
    if (!value) return "—";
    const parsed = dayjs(value);
    return parsed.isValid() ? parsed.format("h:mm A") : "—";
  };

  return (
    <div style={{ padding: "0 28px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ padding: "11px 14px", borderRadius: 12, background: "#272727", color: "#FDFAF5", display: "flex", alignItems: "flex-start", gap: 10 }}>
        <FiActivity size={14} color="#e4ca80" style={{ marginTop: 2, flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: 11, lineHeight: 1.55, fontFamily: "'Poppins',sans-serif" }}>
          Each service starts when the previous one ends. Choose a provider for every window, or ask for one recommendation.
        </p>
      </div>

      {isLoadingAvailability && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "12px 14px", borderRadius: 12,
          background: "rgba(187,161,79,0.08)", border: "1px solid rgba(187,161,79,0.18)",
        }}>
          <Spin size="small" />
          <p style={{ margin: 0, fontSize: 12, color: "#987554", fontFamily: "'Poppins',sans-serif" }}>
            Calculating service windows and eligible providers…
          </p>
        </div>
      )}

      {availabilityError && !isLoadingAvailability && (
        <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(196,91,84,0.08)", border: "1px solid rgba(196,91,84,0.25)", display: "flex", alignItems: "center", gap: 10 }}>
          <FiAlertCircle size={14} color="#c45b54" />
          <p style={{ margin: 0, flex: 1, fontSize: 11, color: "#7f342f", fontFamily: "'Poppins',sans-serif" }}>{firstApiErrorMessage(availabilityError, "Staff options could not be loaded.")}</p>
          <button onClick={onRetryAvailability} style={{ border: "1px solid rgba(196,91,84,0.35)", background: "#fff", color: "#7f342f", borderRadius: 8, padding: "6px 10px", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Retry</button>
        </div>
      )}

      {!availabilityError && selectedServices.map((svc, index) => {
        const cur = staffPerService[svc.id];
        const option = getSelectedServiceOption(svc, selectedServiceOptions);
        const availability = serviceAvailabilityMap[String(svc.id)];
        const recommendation = recommendations[String(svc.id)];
        const eligibleStaff = [...(availability?.staff ?? [])];
        if (recommendation?.available && recommendation.staff && !eligibleStaff.some((person) => String(person.id) === String(recommendation.staff.id))) {
          eligibleStaff.push(recommendation.staff);
        }
        const selectedStaff = eligibleStaff.find((person) => String(person.id) === String(cur));
        const isRecommending = String(recommendingServiceId) === String(svc.id);

        return (
          <div key={svc.id} style={{ borderRadius: 15, border: `1.5px solid ${cur ? "rgba(187,161,79,0.42)" : "rgba(187,161,79,0.2)"}`, background: "#fff", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 14px", background: cur ? "linear-gradient(135deg,rgba(187,161,79,0.12),rgba(152,117,84,0.06))" : "#faf8f4", borderBottom: "1px solid rgba(187,161,79,0.14)" }}>
              <span style={{ width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center", background: "#272727", color: "#e4ca80", fontSize: 11, fontWeight: 800, fontFamily: "'Poppins',sans-serif", flexShrink: 0 }}>{index + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#272727", fontFamily: "'Poppins',sans-serif" }}>{svc.name}</p>
                <p style={{ margin: 0, fontSize: 10, color: "#987554", fontFamily: "'Poppins',sans-serif" }}>
                  {option?.name || "Standard service"} · {windowTime(availability?.scheduled_start)}–{windowTime(availability?.scheduled_end)}
                </p>
              </div>
              <button
                onClick={() => onRecommend(svc, availability)}
                disabled={!availability?.scheduled_start || isRecommending}
                style={{ display: "inline-flex", alignItems: "center", gap: 5, border: "1px solid rgba(187,161,79,0.38)", background: "#fff", color: "#7d6428", borderRadius: 9, padding: "7px 10px", fontSize: 10, fontWeight: 800, fontFamily: "'Poppins',sans-serif", cursor: !availability?.scheduled_start || isRecommending ? "not-allowed" : "pointer", opacity: !availability?.scheduled_start ? 0.45 : 1 }}
              >
                {isRecommending ? <Spin size="small" /> : <FiStar size={11} />}
                Recommend
              </button>
            </div>

            <div style={{ padding: "11px 12px 12px", display: "flex", flexDirection: "column", gap: 7 }}>
              <p style={{ margin: "0 2px 2px", color: "#987554", fontSize: 10, fontFamily: "'Poppins',sans-serif" }}>
                {eligibleStaff.length} eligible provider{eligibleStaff.length !== 1 ? "s" : ""} for this exact window
              </p>

              {recommendation && !recommendation.available && (
                <div style={{ padding: "8px 10px", borderRadius: 9, background: "rgba(196,91,84,0.07)", border: "1px solid rgba(196,91,84,0.2)", color: "#7f342f", fontSize: 10, fontFamily: "'Poppins',sans-serif" }}>
                  {recommendation.reason || "No recommendation is available for this window."}
                  {recommendation.retry_after_seconds ? ` Try again in ${recommendation.retry_after_seconds} seconds.` : ""}
                </div>
              )}

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {eligibleStaff.map((s) => {
                const [from, to] = avatarGradient(s.full_name);
                const sel = String(cur) === String(s.id);
                const recommended = recommendation?.available && String(recommendation.staff?.id) === String(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => setStaff(svc.id, s.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 14px", borderRadius: 12, cursor: "pointer",
                      border: `1.5px solid ${sel ? "#BBA14F" : "#ede8de"}`,
                      background: sel ? "linear-gradient(135deg,rgba(187,161,79,0.1),rgba(152,117,84,0.07))" : "#faf8f4",
                      transition: "all 0.15s", textAlign: "left",
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: "50%",
                      background: `linear-gradient(135deg,${from},${to})`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 700, color: "#fff",
                      fontFamily: "'Poppins',sans-serif", flexShrink: 0,
                      boxShadow: sel ? `0 0 0 2.5px #BBA14F` : "none",
                    }}>
                      {initials(s.full_name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#272727", fontFamily: "'Poppins',sans-serif", lineHeight: 1.25 }}>
                        {s.full_name}{recommended ? <span style={{ marginLeft: 7, color: "#7d6428", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.06em" }}>Recommended</span> : null}
                      </p>
                      <p style={{ margin: 0, fontSize: 11, color: "#987554", fontFamily: "'Poppins',sans-serif" }}>{s.role}</p>
                    </div>
                    {sel && (
                      <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#BBA14F", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <FiCheck size={12} color="#fff" />
                      </div>
                    )}
                  </button>
                );
              })}

              {eligibleStaff.length === 0 && (
                <div style={{
                  padding: "10px 14px", borderRadius: 12,
                  background: "rgba(224,80,80,0.06)", border: "1px solid rgba(224,80,80,0.2)",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <FiAlertCircle size={13} color="#e05050" style={{ flexShrink: 0 }} />
                  <p style={{ margin: 0, fontSize: 12, color: "#e05050", fontFamily: "'Poppins',sans-serif" }}>
                    {availability?.reason || "No eligible providers are available for this service window."}
                  </p>
                </div>
              )}
            </div>
              {selectedStaff?.assigned_to_service === false && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 7, padding: "8px 10px", borderRadius: 9, background: "rgba(212,168,71,0.1)", border: "1px solid rgba(212,168,71,0.28)" }}>
                  <FiAlertCircle size={12} color="#9b7626" style={{ marginTop: 1, flexShrink: 0 }} />
                  <p style={{ margin: 0, fontSize: 10, lineHeight: 1.5, color: "#74591f", fontFamily: "'Poppins',sans-serif" }}>This provider is not normally assigned to this service. Portal override will be used.</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Step 4: Date & Time ── */
function StepDateTime({
  selectedDate,
  setSelectedDate,
  selectedTime,
  setSelectedTime,
  blockedDateSet = new Set(),
  checkingAvailability = false,
  availabilityError = null,
  hasAvailableStaff = null,
}) {
  const today = dayjs().startOf("day");

  // Build bookable business-hour slots every 15 min.
  const slots = [];
  for (let h = BOOKING_START_HOUR; h < BOOKING_END_HOUR; h++) {
    for (let m = 0; m < 60; m += SLOT_MINS) {
      const hh = String(h).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      slots.push(`${hh}:${mm}`);
    }
  }

  // Determine if the selected date is today
  const isToday = selectedDate && selectedDate.isSame(today, "day");

  // Is the selected date blocked?
  const selectedIsBlocked = selectedDate && blockedDateSet.has(selectedDate.format("YYYY-MM-DD"));

  // Current time in minutes from midnight, rounded up to next slot
  const now = dayjs();
  const nowTotalMins = now.hour() * 60 + now.minute();

  // A slot string "HH:MM" is in the past if today is selected and the slot <= now
  const isSlotPast = (slot) => {
    if (!isToday) return false;
    const [h, m] = slot.split(":").map(Number);
    const slotMins = h * 60 + m;
    // Block the slot if its start time is at or before current time
    return slotMins <= nowTotalMins;
  };

  // When date changes, clear any selected time that is now in the past
  const handleDateChange = (d) => {
    setSelectedDate(d);
    if (selectedTime) {
      const [h, m] = selectedTime.split(":").map(Number);
      const slotMins = h * 60 + m;
      const isNewToday = d && d.isSame(today, "day");
      if (isNewToday && slotMins <= nowTotalMins) {
        setSelectedTime(null);
      }
    }
  };

  return (
    <div style={{ padding: "0 28px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Date picker */}
      <div>
        <label style={WZ.label}>Pick a Date</label>
        <DatePicker
          value={selectedDate}
          onChange={handleDateChange}
          /* Disable past dates AND blocked dates */
          disabledDate={(d) => {
            if (!d) return false;
            if (d.isBefore(today)) return true;
            return blockedDateSet.has(d.format("YYYY-MM-DD"));
          }}
          format="dddd, D MMMM YYYY"
          style={{
            width: "100%",
            background: "#fff",
            borderColor: "#e8e0d0",
            borderRadius: 10,
            fontSize: 13,
            fontFamily: "'Poppins',sans-serif",
          }}
          popupStyle={{ fontFamily: "'Poppins',sans-serif" }}
          /* Custom cell renderer to visually mark blocked dates */
          cellRender={(current) => {
            const isBlocked = blockedDateSet.has(current.format("YYYY-MM-DD"));
            return (
              <div
                className="ant-picker-cell-inner"
                title={isBlocked ? "Salon closed / blocked" : undefined}
                style={isBlocked ? {
                  background: "rgba(224,80,80,0.12)",
                  color: "#e05050",
                  borderRadius: 4,
                  textDecoration: "line-through",
                } : undefined}
              >
                {current.date()}
              </div>
            );
          }}
        />
      </div>

      {/* Blocked day warning */}
      {selectedIsBlocked && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "11px 14px",
          background: "rgba(224,80,80,0.08)",
          border: "1.5px solid rgba(224,80,80,0.3)",
          borderRadius: 10,
        }}>
          <FiSlash size={14} color="#e05050" style={{ flexShrink: 0 }} />
          <p style={{
            margin: 0, fontSize: 12,
            color: "#e05050",
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 600,
          }}>
            This date is blocked — the salon is closed.
            {" "}Please pick a different date.
          </p>
        </div>
      )}

      {/* Time slots */}
      <div>
        <label style={WZ.label}>
          Available Times
          {isToday && (
            <span style={{
              marginLeft: 8,
              fontSize: 9,
              fontWeight: 600,
              color: "#987554",
              textTransform: "none",
              letterSpacing: 0,
              fontFamily: "'Poppins',sans-serif",
            }}>
              · past times are unavailable
            </span>
          )}
        </label>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 8,
          paddingRight: 2,
          opacity: selectedIsBlocked ? 0.35 : 1,
          pointerEvents: selectedIsBlocked ? "none" : "auto",
          transition: "opacity 0.2s",
        }}>
          {slots.map((slot) => {
            const [h, m] = slot.split(":").map(Number);
            const ampm = h >= 12 ? "PM" : "AM";
            const h12 = h % 12 || 12;
            const label = `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
            const isSel = selectedTime === slot;
            const isPast = isSlotPast(slot);
            return (
              <button
                key={slot}
                onClick={() => !isPast && setSelectedTime(isSel ? null : slot)}
                disabled={isPast || selectedIsBlocked}
                style={{
                  padding: "8px 4px",
                  borderRadius: 9,
                  border: `1.5px solid ${
                    isPast ? "#ede8de" :
                    isSel ? "#BBA14F" : "#e0d5c5"
                  }`,
                  background: isPast
                    ? "#f5f2ed"
                    : isSel
                    ? "linear-gradient(135deg,#BBA14F,#987554)"
                    : "#faf8f4",
                  color: isPast ? "#c9bfaf" : isSel ? "#fff" : "#3d2e1e",
                  fontFamily: "'Poppins',sans-serif",
                  fontSize: 11,
                  fontWeight: isSel ? 700 : 500,
                  cursor: isPast ? "not-allowed" : "pointer",
                  transition: "all 0.15s",
                  boxShadow: isSel ? "0 2px 10px rgba(187,161,79,0.35)" : "none",
                  textDecoration: isPast ? "line-through" : "none",
                  opacity: isPast ? 0.45 : 1,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {selectedTime && !selectedIsBlocked && (
          <div
            role="status"
            style={{
              marginTop: 10,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "9px 11px",
              borderRadius: 9,
              border: availabilityError
                ? "1px solid rgba(126,77,62,0.28)"
                : hasAvailableStaff === false
                ? "1px solid rgba(126,77,62,0.25)"
                : "1px solid rgba(187,161,79,0.22)",
              background: availabilityError || hasAvailableStaff === false
                ? "rgba(126,77,62,0.08)"
                : "rgba(187,161,79,0.07)",
              color: availabilityError || hasAvailableStaff === false ? "#7e4d3e" : "#765f28",
              fontFamily: "'Poppins',sans-serif",
              fontSize: 11,
              fontWeight: 600,
              lineHeight: 1.45,
            }}
          >
            {checkingAvailability ? (
              <><Spin size="small" /> Checking staff availability…</>
            ) : availabilityError ? (
              "Staff availability could not be verified. Please try this time again."
            ) : hasAvailableStaff === false ? (
              "No staff member can cover the complete service time. Please choose another time."
            ) : hasAvailableStaff === true ? (
              <><FiCheck size={13} /> Staff are available for this time.</>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Step 6: Confirm ── */
function StepConfirm({ clientMode, selectedClient, walkIn, selectedServices, selectedServiceOptions, staffPerService, serviceAvailabilityMap, recommendations, bookingDate, bookingTime }) {
  const selectedStaff = (svcId) => {
    const id = staffPerService[svcId];
    const availability = serviceAvailabilityMap[String(svcId)];
    const recommended = recommendations[String(svcId)]?.staff;
    return (availability?.staff ?? []).find((person) => String(person.id) === String(id))
      ?? (String(recommended?.id) === String(id) ? recommended : null);
  };

  const windowLabel = (svcId) => {
    const window = serviceAvailabilityMap[String(svcId)];
    const start = window?.scheduled_start ? dayjs(window.scheduled_start).format("h:mm A") : "—";
    const end = window?.scheduled_end ? dayjs(window.scheduled_end).format("h:mm A") : "—";
    return `${start}–${end}`;
  };

  const clientDisplay = clientMode === "existing"
    ? [selectedClient?.first_name, selectedClient?.last_name].filter(Boolean).join(" ") ||
      selectedClient?.full_name || "Client"
    : walkIn.name;

  const total = selectedServices.reduce((sum, service) => sum + getServiceDisplayAmount(service, selectedServiceOptions), 0);
  const allFree = selectedServices.every((service) => getServiceDisplayAmount(service, selectedServiceOptions) === 0);
  const hasFromPrice = selectedServices.some((service) => {
    const selectedOption = getSelectedServiceOption(service, selectedServiceOptions);
    return (selectedOption?.priceType ?? service.price_type) === "from";
  });

  const timeDisplay = (() => {
    if (!bookingTime) return "—";
    const [h, m] = bookingTime.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
  })();

  const staffGroups = (() => {
    const groups = new Map();
    selectedServices.forEach((service, serviceIndex) => {
      const provider = selectedStaff(service.id);
      const staffId = provider?.id ?? staffPerService[service.id] ?? "unassigned";
      const key = String(staffId);
      if (!groups.has(key)) {
        groups.set(key, {
          staffId,
          provider,
          services: [],
        });
      }
      groups.get(key).services.push({ service, serviceIndex });
    });
    return [...groups.values()];
  })();

  const row = (label, value, gold) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, padding: "9px 0", borderBottom: "1px solid rgba(187,161,79,0.1)" }}>
      <span style={{ fontSize: 11, color: "#987554", fontFamily: "'Poppins',sans-serif", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: gold ? "#BBA14F" : "#272727", fontFamily: "'Poppins',sans-serif", fontWeight: gold ? 800 : 600, textAlign: "right" }}>{value}</span>
    </div>
  );

  return (
    <div style={{ padding: "0 28px 24px" }}>
      <div style={{ background: "linear-gradient(145deg,#fdfaf5,#faf5ea)", border: "1px solid rgba(187,161,79,0.2)", borderRadius: 14, padding: "4px 16px 4px", marginBottom: 16 }}>
        {row("Client", clientDisplay)}
        {row("Date", bookingDate ? bookingDate.format("dddd, D MMMM YYYY") : "—")}
        {row("Time", timeDisplay)}
      </div>

      <p style={WZ.sectionLabel}>Staff assignments</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {staffGroups.map((group) => {
          const providerName = group.provider?.full_name || "Provider not selected";
          const [from, to] = avatarGradient(providerName);
          return (
            <div
              key={String(group.staffId)}
              style={{
                overflow: "hidden",
                borderRadius: 13,
                background: "#faf8f4",
                border: "1px solid rgba(187,161,79,0.2)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 13px", background: "rgba(187,161,79,0.07)", borderBottom: "1px solid rgba(187,161,79,0.14)" }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: `linear-gradient(135deg,${from},${to})`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 10, fontWeight: 800, fontFamily: "'Poppins',sans-serif" }}>
                  {initials(providerName)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "#272727", fontFamily: "'Poppins',sans-serif" }}>{providerName}</p>
                  <p style={{ margin: 0, fontSize: 10, color: "#987554", fontFamily: "'Poppins',sans-serif" }}>
                    {group.services.length} service{group.services.length !== 1 ? "s" : ""} assigned
                  </p>
                </div>
              </div>

              <div style={{ padding: "4px 13px 7px" }}>
                {group.services.map(({ service, serviceIndex }) => {
                  const selectedOption = getSelectedServiceOption(service, selectedServiceOptions);
                  return (
                    <div key={service.id} style={{ display: "grid", gridTemplateColumns: "24px minmax(0,1fr) auto", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid rgba(187,161,79,0.1)" }}>
                      <span style={{ width: 22, height: 22, borderRadius: 7, background: "#272727", color: "#e4ca80", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, fontFamily: "'Poppins',sans-serif" }}>
                        {serviceIndex + 1}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#3d2e1e", fontFamily: "'Poppins',sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {service.name}{selectedOption?.name ? ` · ${selectedOption.name}` : ""}
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: 10, color: "#987554", fontFamily: "'Poppins',sans-serif" }}>
                          <FiClock size={9} style={{ marginRight: 4 }} />{windowLabel(service.id)}
                        </p>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#BBA14F", fontFamily: "'Poppins',sans-serif", whiteSpace: "nowrap" }}>
                        {getServiceDisplayPrice(service, selectedServiceOptions)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Total */}
      <div style={{ padding: "12px 16px", borderRadius: 12, background: "linear-gradient(135deg,rgba(187,161,79,0.15),rgba(152,117,84,0.1))", border: "1px solid rgba(187,161,79,0.3)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#987554", fontFamily: "'Poppins',sans-serif", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Total Amount{hasFromPrice ? " From" : ""}
        </span>
        <span style={{ fontSize: 20, fontWeight: 800, color: "#BBA14F", fontFamily: "'Playfair Display',serif" }}>
          {allFree ? "Free" : `GH₵ ${total.toFixed(2)}`}
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   AVATAR CIRCLE (top header)
───────────────────────────────────────────── */
function StaffCircle({ staff, isActive, onClick }) {
  const [from, to] = avatarGradient(staff.full_name);
  return (
    <Tooltip title={`${staff.full_name} · ${staff.role}`} placement="bottom">
      <button
        onClick={onClick}
        className="flex flex-col items-center gap-1.5 shrink-0 transition-all duration-200 hover:scale-105"
        style={{ fontFamily: "'Poppins', sans-serif" }}
      >
        <div
          className="relative rounded-full flex items-center justify-center font-semibold text-white transition-all duration-200"
          style={{
            width: 46,
            height: 46,
            background: `linear-gradient(135deg, ${from}, ${to})`,
            fontSize: 15,
            boxShadow: isActive
              ? `0 0 0 3px #BBA14F, 0 4px 12px rgba(187,161,79,0.45)`
              : "0 2px 8px rgba(0,0,0,0.12)",
            border: isActive ? "2px solid #fff" : "2px solid transparent",
          }}
        >
          {initials(staff.full_name)}
          {/* Online dot */}
          <span
            className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white"
            style={{ background: "#22a050" }}
          />
        </div>
        <span
          className="text-[10px] font-medium text-center leading-tight"
          style={{
            color: isActive ? "#BBA14F" : "#987554",
            maxWidth: 52,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {staff.full_name.split(" ")[0]}
        </span>
      </button>
    </Tooltip>
  );
}

/* ─────────────────────────────────────────────
   BOOKING CARD (draggable)
───────────────────────────────────────────── */
/* ─────────────────────────────────────────────
   BOOKING CARD — draggable appointment block rendered inside the calendar grid.
   Each card is absolutely positioned by start time and sized by duration.
   On hover it opens a separate, compact preview without changing card geometry.
───────────────────────────────────────────── */
function BookingCard({ booking, isPast, colOffset, colCount, onDragStart, onDragEnd, onClick }) {
  /* ── Geometry ── */
  const startMins = timeToMins(booking.startTime);
  const topPx     = minsToY(startMins);
  const heightPx = Math.max(
    (booking.durationMins / SLOT_MINS) * SLOT_HEIGHT_PX - 2,
    SLOT_HEIGHT_PX - 2
  );
  const isMicroCard = heightPx < 34;

  /* ── Status colour config ── */
  const cfg = getStatusCfg(booking.status);

  /* ── Column splitting (for overlapping bookings on same staff column) ── */
  const slotW    = 100 / colCount;
  const leftPct  = colOffset * slotW;
  const rightPct = 100 - (colOffset + 1) * slotW;

  /* ── Hover state is visual only; the floating preview lives outside the card. ── */
  const [hovered, setHovered] = useState(false);

  /* ── Derive enriched data from booking.raw (full API response) ── */
  const raw = booking.raw || {};

  // Collect all services from raw — supports both single and multi-service bookings
  const rawServices = Array.isArray(booking.services) && booking.services.length > 0
    ? booking.services                          // staff-specific calendar segment
    : Array.isArray(raw.services) && raw.services.length > 0
      ? raw.services                            // legacy full appointment shape
    : raw.service_name                          // legacy single-service fallback
      ? [{ service_name: raw.service_name, staff_name: raw.staff_name }]
      : [];

  // Calculate end time from start + duration
  const endMins   = startMins + booking.durationMins;
  const endTime   = `${String(Math.floor((endMins + CALENDAR_START_HOUR * 60) / 60) % 24).padStart(2, "0")}:${String(endMins % 60).padStart(2, "0")}`;

  // Format duration as "1h 30m" or "45m"
  const durLabel  = booking.durationMins >= 60
    ? `${Math.floor(booking.durationMins / 60)}h${booking.durationMins % 60 ? ` ${booking.durationMins % 60}m` : ""}`
    : `${booking.durationMins}m`;

  const serviceSummary = rawServices
    .map((service) => service.service_name || service.name)
    .filter(Boolean)
    .join(" · ") || booking.service || "Service not specified";

  const hoverPreview = (
    <div
      style={{
        width: 230,
        padding: "5px 4px 4px",
        fontFamily: "'Poppins',sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 9,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            background: "rgba(187,161,79,0.16)",
            color: "#e4ca80",
          }}
        >
          <FiUser size={13} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              color: "#fffdf7",
              fontSize: 12,
              fontWeight: 800,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {booking.client}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.dot }} />
            <span style={{ color: cfg.dot, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {cfg.label}
            </span>
            {booking.segmentCount > 1 && (
              <span style={{ color: "rgba(255,253,247,0.5)", fontSize: 9 }}>
                · assignment {booking.segmentIndex + 1} of {booking.segmentCount}
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{ height: 1, background: "rgba(187,161,79,0.18)", marginBottom: 8 }} />

      <div style={{ display: "flex", alignItems: "flex-start", gap: 7, marginBottom: 8 }}>
        <FiScissors size={11} color="#c9ae5e" style={{ flexShrink: 0, marginTop: 2 }} />
        <span
          style={{
            color: "rgba(255,253,247,0.88)",
            fontSize: 11,
            fontWeight: 600,
            lineHeight: 1.4,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {serviceSummary}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <FiClock size={11} color="#c9ae5e" style={{ flexShrink: 0 }} />
        <span style={{ color: "#fffdf7", fontSize: 11, fontWeight: 700 }}>
          {formatDisplayTime(booking.startTime)}–{formatDisplayTime(endTime)}
        </span>
        <span style={{ marginLeft: "auto", color: "rgba(255,253,247,0.55)", fontSize: 10 }}>
          {durLabel}
        </span>
      </div>
    </div>
  );

  return (
    <Tooltip
      title={hoverPreview}
      placement="rightTop"
      mouseEnterDelay={0.2}
      color="#17130d"
      overlayStyle={{ maxWidth: 260 }}
    >
    <div
      draggable={!isPast && !booking.isServiceSegment}
      onDragStart={(e) => !isPast && !booking.isServiceSegment && onDragStart(e, booking)}
      onDragEnd={onDragEnd}
      onClick={() => onClick(booking)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "absolute",
        top:    topPx + 1,
        left:   `calc(${leftPct}% + 4px)`,
        right:  `calc(${rightPct}% + 4px)`,
        height: heightPx,
        zIndex: 10,
        borderRadius: isMicroCard ? 5 : 8,
        overflow: "hidden",
        cursor: isPast ? "not-allowed" : booking.isServiceSegment ? "pointer" : "grab",
        /* Pure black card */
        background: isPast
          ? "#1c1c1c"
          : "linear-gradient(170deg, #1e1e1e 0%, #141414 60%, #0d0d0d 100%)",
        boxShadow: "none",
        border: isPast
          ? "1px solid rgba(255,255,255,0.07)"
          : hovered
            ? "1px solid rgba(187,161,79,0.8)"
            : "1px solid rgba(187,161,79,0.45)",
        userSelect: "none",
        opacity: isPast ? 0.6 : 1,
        transition: "border-color 0.18s ease, opacity 0.18s ease",
      }}
    >
      {/* Gold top accent bar */}
      <div style={{
        position: "absolute",
        top: 0, left: 0, right: 0,
        height: 3,
        borderRadius: "10px 10px 0 0",
        background: isPast
          ? "#5a4a30"
          : "linear-gradient(90deg, #BBA14F, #e4ca80)",
      }} />

      {/* ── Compact card content (always visible) ── */}
      <div style={{
        display: "flex",
        justifyContent: "center",
        height: "100%",
        flexDirection: isMicroCard ? "row" : "column",
        alignItems: isMicroCard ? "center" : "stretch",
        padding: isMicroCard ? "1px 6px" : "5px 8px 4px",
        gap: isMicroCard ? 5 : 2,
      }}>

        {/* Status badge row */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
          <span style={{
            width: 6, height: 6,
            borderRadius: "50%",
            background: isPast ? "#aaa" : cfg.dot,
            display: "inline-block",
            flexShrink: 0,
          }} />
          {!isMicroCard && <span style={{
            fontSize: 10,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "#FFFFFF",
            fontFamily: "'Poppins', sans-serif",
            textShadow: "0 1px 4px rgba(0,0,0,0.8)",
          }}>
            {cfg.label}
          </span>}
        </div>

        {/* Client name */}
        <p style={{
          margin: 0,
          fontSize: isMicroCard ? 10 : 12,
          fontWeight: 800,
          color: "#FFFFFF",
          fontFamily: "'Poppins', sans-serif",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          lineHeight: 1.1,
          flex: isMicroCard ? 1 : "unset",
          textShadow: "0 1px 6px rgba(0,0,0,0.9)",
        }}>
          {booking.client}
        </p>

        {/* Service name — only when card is tall enough */}
        {heightPx > 70 && (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <FiScissors size={10} color="#FFFFFF" style={{ flexShrink: 0 }} />
            <span style={{
              fontSize: 11,
              color: "#FFFFFF",
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 600,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              textShadow: "0 1px 4px rgba(0,0,0,0.8)",
            }}>
              {booking.service}
            </span>
          </div>
        )}

        {/* Time range — only when card is tall enough */}
        {heightPx > 96 && (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <FiClock size={9} color="#FFFFFF" style={{ flexShrink: 0 }} />
            <span style={{
              fontSize: 11,
              color: "#FFFFFF",
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 500,
              textShadow: "0 1px 4px rgba(0,0,0,0.8)",
            }}>
              {formatDisplayTime(booking.startTime)}
              {" · "}
              {durLabel}
            </span>
          </div>
        )}
      </div>

    </div>
    </Tooltip>
  );
}

/* ─────────────────────────────────────────────
   BOOKING DETAIL MODAL
───────────────────────────────────────────── */
function BookingModal({ booking, staff, onClose, onOpenStatusDrawer }) {
  if (!booking) return null;

  const raw = booking.raw || {};
  const cfg = getStatusCfg(booking.status);
  const [from, to] = avatarGradient(staff?.full_name || "");
  const startMins = timeToMins(booking.startTime);
  const endMins = startMins + booking.durationMins;
  const endTimeStr = `${String(Math.floor((endMins + CALENDAR_START_HOUR * 60) / 60) % 24).padStart(2, "0")}:${String(endMins % 60).padStart(2, "0")}`;
  const durLabel = booking.durationMins >= 60
    ? `${Math.floor(booking.durationMins / 60)}h${booking.durationMins % 60 ? ` ${booking.durationMins % 60}m` : ""}`
    : `${booking.durationMins}m`;
  const formatMoney = (value) => {
    const amount = parseFloat(value ?? 0);
    if (Number.isNaN(amount)) return "GHS 0.00";
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency: "GHS",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };
  const hasBillingSummary =
    raw.subtotal_amount != null ||
    raw.deposit_amount != null ||
    raw.remaining_balance_amount != null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(30,24,14,0.55)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="relative rounded-2xl w-full max-w-sm mx-4 shadow-2xl"
        style={{
          background: "#FDFAF5",
          border: "1px solid rgba(187,161,79,0.25)",
          animation: "fadeInUp 0.2s ease both",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1" style={{ background: "linear-gradient(90deg, #BBA14F, #c9ae5e)" }} />
        <div style={{ padding: "20px 24px 24px" }}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center text-sm transition hover:bg-black/5"
            style={{ color: "#987554" }}
          >
            ✕
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-white shrink-0"
              style={{ background: `linear-gradient(135deg, ${from}, ${to})`, fontSize: 15, fontFamily: "'Poppins', sans-serif" }}
            >
              {initials(staff?.full_name)}
            </div>
            <div>
              <p className="text-sm font-semibold text-[#272727]" style={{ fontFamily: "'Poppins', sans-serif", margin: 0 }}>
                {staff?.full_name || "Staff"}
              </p>
              <p className="text-xs text-[#987554]" style={{ fontFamily: "'Poppins', sans-serif", margin: 0 }}>
                {staff?.role}
              </p>
            </div>
          </div>

          <h3 className="text-lg font-bold text-[#272727] mb-4" style={{ fontFamily: "'Playfair Display', serif", margin: "0 0 16px" }}>
            {booking.appointmentServiceSummary || booking.service}
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
            <DetailRow icon={<FiUser size={13} />} label="Client" value={booking.client} />
            <DetailRow
              icon={<FiClock size={13} />}
              label="Time"
              value={`${formatDisplayTime(booking.startTime)} → ${formatDisplayTime(endTimeStr)}  (${durLabel})`}
            />
            {(raw.booking_source || booking.booking_source) && (
              <DetailRow
                icon={<FiActivity size={13} />}
                label="Source"
                value={
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(82,130,255,0.12)", color: "#5282ff", border: "1px solid rgba(82,130,255,0.25)" }}>
                    {(() => {
                      const source = raw.booking_source || booking.booking_source;
                      return source.toLowerCase() === 'online' 
                        ? 'Mobile App' 
                        : source.charAt(0).toUpperCase() + source.slice(1);
                    })()}
                  </span>
                }
              />
            )}
            <DetailRow
              icon={<span style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.dot, display: "inline-block" }} />}
              label="Status"
              value={
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: `${cfg.dot}18`, color: cfg.dot, border: `1px solid ${cfg.dot}44` }}>
                  {cfg.label}
                </span>
              }
            />
          </div>

          {hasBillingSummary && (
            <div
              style={{
                marginBottom: 18,
                padding: "14px 14px 12px",
                borderRadius: 14,
                background: "linear-gradient(135deg, rgba(187,161,79,0.12), rgba(152,117,84,0.08))",
                border: "1px solid rgba(187,161,79,0.22)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.45)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 10,
                    background: "rgba(187,161,79,0.16)",
                    color: "#8a6f2e",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <FiDollarSign size={14} />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "#987554", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'Poppins', sans-serif" }}>
                    Payment Summary
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: "#6f5a42", fontFamily: "'Poppins', sans-serif" }}>
                    All amounts shown in GHS
                  </p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                {[
                  { label: "Subtotal", value: raw.subtotal_amount },
                  { label: "Deposit", value: raw.deposit_amount },
                  { label: "Balance", value: raw.remaining_balance_amount },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      padding: "10px 10px 9px",
                      borderRadius: 12,
                      background: "rgba(255,255,255,0.72)",
                      border: "1px solid rgba(187,161,79,0.16)",
                    }}
                  >
                    <p style={{ margin: "0 0 4px", fontSize: 10, fontWeight: 700, color: "#987554", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'Poppins', sans-serif" }}>
                      {item.label}
                    </p>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#272727", fontFamily: "'Poppins', sans-serif", lineHeight: 1.25 }}>
                      {formatMoney(item.value)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ height: 1, background: "rgba(187,161,79,0.15)", marginBottom: 14 }} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                padding: "10px 0",
                borderRadius: 12,
                background: "#fff",
                border: "1px solid rgba(187,161,79,0.35)",
                color: "#987554",
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "'Poppins', sans-serif",
                cursor: "pointer",
              }}
            >
              Close
            </button>
            <button
              onClick={() => onOpenStatusDrawer(booking)}
              style={{
                padding: "10px 0",
                borderRadius: 12,
                background: "linear-gradient(135deg, #BBA14F, #987554)",
                border: "none",
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "'Poppins', sans-serif",
                cursor: "pointer",
              }}
            >
              Update Status
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


function DetailRow({ icon, label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-[#987554]">
        {icon}
        <span className="text-xs" style={{ fontFamily: "'Poppins', sans-serif" }}>
          {label}
        </span>
      </div>
      <span
        className="text-xs font-medium text-[#272727]"
        style={{ fontFamily: "'Poppins', sans-serif", textAlign: "right" }}
      >
        {value}
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────
   APPOINTMENTS CARD VIEW
───────────────────────────────────────────── */
function AppointmentsCardView({ dayBookings, staff, onCardClick, isMobile }) {
  const [search, setSearch] = useState("");
  const [activeStaff, setActiveStaff] = useState(null); // null = show all

  const grouped = staff.map((s) => ({
    staff: s,
    bookings: dayBookings
      .filter((b) => b.staffId === s.id)
      .sort((a, b) => a.startTime.localeCompare(b.startTime)),
  }));

  // Filter by search — matches staff name or client name
  const q = search.toLowerCase().trim();
  const filtered = grouped
    .filter(({ staff: s }) => activeStaff === null || s.id === activeStaff)
    .map(({ staff: s, bookings }) => ({
      staff: s,
      bookings: q
        ? bookings.filter(
            (b) =>
              b.client.toLowerCase().includes(q) ||
              s.full_name.toLowerCase().includes(q) ||
              b.service.toLowerCase().includes(q)
          )
        : bookings,
    }))
    .filter(({ bookings }) => bookings.length > 0);

  const totalVisible = filtered.reduce((acc, g) => acc + g.bookings.length, 0);

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* ── Mobile: Search bar + horizontal staff chips ── */}
      {isMobile ? (
        <div style={{ flexShrink: 0, borderBottom: "1px solid rgba(187,161,79,0.15)", background: CALENDAR_SURFACE.muted }}>
          {/* Search */}
          <div style={{ padding: "12px 14px 10px" }}>
            <div
              style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "rgba(187,161,79,0.08)",
                border: "1px solid rgba(187,161,79,0.2)",
                borderRadius: 10, padding: "8px 12px",
              }}
              onFocusCapture={(e) => (e.currentTarget.style.borderColor = "rgba(187,161,79,0.5)")}
              onBlurCapture={(e) => (e.currentTarget.style.borderColor = "rgba(187,161,79,0.2)")}
            >
              <FiUser size={12} style={{ color: "rgba(187,161,79,0.6)", flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Search staff, client or service..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 12, color: "#272727", fontFamily: "'Poppins', sans-serif", caretColor: "#BBA14F" }}
              />
              {search && (
                <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#987554", padding: 0, fontSize: 13 }}>✕</button>
              )}
            </div>
          </div>
          {/* Horizontal staff chips */}
          <div style={{ display: "flex", gap: 8, padding: "0 14px 12px", overflowX: "auto", scrollbarWidth: "none" }}>
            {/* All chip */}
            <button
              onClick={() => setActiveStaff(null)}
              style={{
                flexShrink: 0, display: "flex", alignItems: "center", gap: 6,
                padding: "6px 14px", borderRadius: 100, border: "none", cursor: "pointer",
                background: activeStaff === null ? "linear-gradient(135deg, #BBA14F, #987554)" : "rgba(187,161,79,0.12)",
                color: activeStaff === null ? "#FFFFFF" : "#987554",
                fontSize: 11, fontWeight: 600, fontFamily: "'Poppins', sans-serif",
                boxShadow: activeStaff === null ? "0 2px 10px rgba(187,161,79,0.4)" : "none",
                whiteSpace: "nowrap",
              }}
            >
              All · {dayBookings.length}
            </button>
            {staff.map((s) => {
              const count = dayBookings.filter((b) => b.staffId === s.id).length;
              const isActive = activeStaff === s.id;
              const [from] = avatarGradient(s.full_name);
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveStaff(isActive ? null : s.id)}
                  style={{
                    flexShrink: 0, display: "flex", alignItems: "center", gap: 6,
                    padding: "6px 12px 6px 8px", borderRadius: 100, border: "none", cursor: "pointer",
                    background: isActive ? "linear-gradient(135deg, #BBA14F, #987554)" : "rgba(187,161,79,0.12)",
                    color: isActive ? "#FFFFFF" : "#987554",
                    fontSize: 11, fontWeight: isActive ? 700 : 500, fontFamily: "'Poppins', sans-serif",
                    boxShadow: isActive ? "0 2px 10px rgba(187,161,79,0.4)" : "none",
                    whiteSpace: "nowrap",
                    opacity: count === 0 && !isActive ? 0.45 : 1,
                  }}
                >
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: `linear-gradient(135deg, ${from}, #987554)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                    {initials(s.full_name)}
                  </div>
                  {s.full_name.split(" ")[0]}
                  {count > 0 && <span style={{ opacity: 0.75 }}>· {count}</span>}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
      /* ── Desktop/Tablet: Left sidebar ── */
      null
      )}

      <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>

      {/* ── Desktop/Tablet sidebar (not mobile) ── */}
      {!isMobile && (
      <div
        style={{
          width: 220,
          flexShrink: 0,
          borderRight: "1px solid rgba(187,161,79,0.15)",
          background: CALENDAR_SURFACE.muted,
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          overflowX: "hidden",
          scrollbarWidth: "none",
        }}
      >
        {/* Search input */}
        <div
          style={{
            padding: "16px 14px 12px",
            borderBottom: "1px solid rgba(187,161,79,0.15)",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(187,161,79,0.08)",
              border: "1px solid rgba(187,161,79,0.2)",
              borderRadius: 10,
              padding: "8px 12px",
              transition: "border-color 0.2s",
            }}
            onFocusCapture={(e) => (e.currentTarget.style.borderColor = "rgba(187,161,79,0.5)")}
            onBlurCapture={(e) => (e.currentTarget.style.borderColor = "rgba(187,161,79,0.2)")}
          >
            <FiUser size={12} style={{ color: "rgba(187,161,79,0.6)", flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                fontSize: 11,
                color: "#272727",
                fontFamily: "'Poppins', sans-serif",
                caretColor: "#BBA14F",
              }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#987554",
                  padding: 0,
                  fontSize: 13,
                  lineHeight: 1,
                  display: "flex",
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* "All" pill */}
        <div style={{ padding: "10px 14px 6px", flexShrink: 0 }}>
          <button
            onClick={() => setActiveStaff(null)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 12px",
              borderRadius: 10,
              border: "none",
              cursor: "pointer",
              background: activeStaff === null
                ? "linear-gradient(135deg, rgba(187,161,79,0.18), rgba(152,117,84,0.12))"
                : "transparent",
              borderLeft: activeStaff === null ? "3px solid #BBA14F" : "3px solid transparent",
              transition: "all 0.15s",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "rgba(187,161,79,0.15)",
                border: "1px solid rgba(187,161,79,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#BBA14F",
                flexShrink: 0,
                fontSize: 12,
              }}
            >
              <FiGrid size={13} />
            </div>
            <div style={{ minWidth: 0, textAlign: "left" }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: activeStaff === null ? "#272727" : "#987554", fontFamily: "'Poppins', sans-serif" }}>
                All Staff
              </p>
              <p style={{ margin: 0, fontSize: 9, color: "rgba(187,161,79,0.65)", fontFamily: "'Poppins', sans-serif" }}>
                {dayBookings.length} appointments
              </p>
            </div>
          </button>
        </div>

        {/* Divider label */}
        <p style={{ margin: "4px 14px 6px", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: "#987554", fontFamily: "'Poppins', sans-serif" }}>
          Staff
        </p>

        {/* Staff list */}
        <div style={{ padding: "0 14px 16px", display: "flex", flexDirection: "column", gap: 4 }}>
          {staff.map((s) => {
            const [from, to] = avatarGradient(s.full_name);
            const count = dayBookings.filter((b) => b.staffId === s.id).length;
            const isActive = activeStaff === s.id;
            const nameMatch = q ? s.full_name.toLowerCase().includes(q) : true;
            const hasBookings = count > 0;
            if (!nameMatch) return null;
            return (
              <button
                key={s.id}
                onClick={() => setActiveStaff(isActive ? null : s.id)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "none",
                  cursor: "pointer",
                  background: isActive
                    ? "linear-gradient(135deg, rgba(187,161,79,0.18), rgba(152,117,84,0.12))"
                    : "transparent",
                  borderLeft: isActive ? "3px solid #BBA14F" : "3px solid transparent",
                  transition: "all 0.15s",
                  opacity: (!hasBookings && !isActive) ? 0.4 : 1,
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: `linear-gradient(135deg, ${from}, ${to})`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#fff",
                    fontFamily: "'Poppins', sans-serif",
                    flexShrink: 0,
                    boxShadow: isActive ? `0 0 0 2px #BBA14F` : "none",
                    transition: "box-shadow 0.15s",
                  }}
                >
                  {initials(s.full_name)}
                </div>
                <div style={{ minWidth: 0, textAlign: "left", flex: 1 }}>
                  <p style={{
                    margin: 0, fontSize: 11, fontWeight: isActive ? 700 : 500,
                    color: isActive ? "#272727" : "#987554",
                    fontFamily: "'Poppins', sans-serif",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {s.full_name}
                  </p>
                  <p style={{ margin: 0, fontSize: 9, color: "rgba(187,161,79,0.6)", fontFamily: "'Poppins', sans-serif" }}>
                    {s.role}
                  </p>
                </div>
                {count > 0 && (
                  <span
                    style={{
                      fontSize: 9, fontWeight: 700,
                      color: isActive ? "#BBA14F" : "#987554",
                      background: isActive ? "rgba(187,161,79,0.15)" : "rgba(187,161,79,0.08)",
                      border: `1px solid ${isActive ? "rgba(187,161,79,0.3)" : "rgba(187,161,79,0.2)"}`,
                      borderRadius: 100, padding: "2px 7px",
                      fontFamily: "'Poppins', sans-serif",
                      flexShrink: 0, transition: "all 0.15s",
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      )}

      {/* ── Right: Cards content ── */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          overflowY: "auto",
          overflowX: "hidden",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {filtered.length === 0 ? (
          <div
            style={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              color: "#987554",
            }}
          >
            <FiCalendar size={44} style={{ opacity: 0.25 }} />
            <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, margin: 0 }}>
              {search ? `No results for "${search}"` : "No appointments for this day"}
            </p>
          </div>
        ) : (
          <div style={{ padding: isMobile ? "16px 14px 20px" : "24px 28px 28px", display: "flex", flexDirection: "column", gap: 28 }}>
            {/* Result count */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <p style={{ margin: 0, fontSize: 11, color: "rgba(187,161,79,0.7)", fontFamily: "'Poppins', sans-serif" }}>
                Showing <strong style={{ color: "#BBA14F" }}>{totalVisible}</strong> appointment{totalVisible !== 1 ? "s" : ""}
                {activeStaff && ` · ${staff.find(s => s.id === activeStaff)?.full_name}`}
                {search && ` · "${search}"`}
              </p>
            </div>

            {filtered.map(({ staff: s, bookings }) => {
              const [from, to] = avatarGradient(s.full_name);
              return (
                <div key={s.id}>
                  {/* Staff section header */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: "50%",
                        background: `linear-gradient(135deg, ${from}, ${to})`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#fff",
                        fontFamily: "'Poppins', sans-serif",
                        boxShadow: `0 2px 8px rgba(187,161,79,0.3)`,
                        flexShrink: 0,
                      }}
                    >
                      {initials(s.full_name)}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#272727", fontFamily: "'Poppins', sans-serif", lineHeight: 1.2 }}>
                        {s.full_name}
                      </p>
                      <p style={{ margin: 0, fontSize: 10, color: "rgba(187,161,79,0.7)", fontFamily: "'Poppins', sans-serif" }}>
                        {s.role} · {bookings.length} appointment{bookings.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, rgba(187,161,79,0.3), transparent)", marginLeft: 8 }} />
                  </div>

                  {/* Cards grid */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: isMobile
                        ? "1fr"
                        : "repeat(auto-fill, minmax(260px, 1fr))",
                      gap: 14,
                    }}
                  >
                    {bookings.map((booking) => {
                      const cfg = getStatusCfg(booking.status);
                      const durationLabel =
                        booking.durationMins >= 60
                          ? `${Math.floor(booking.durationMins / 60)}h${booking.durationMins % 60 ? ` ${booking.durationMins % 60}m` : ""}`
                          : `${booking.durationMins}m`;
                      return (
                        <div
                          key={booking.calendarId ?? booking.id}
                          onClick={() => onCardClick(booking)}
                          style={{
                            background: `linear-gradient(145deg, ${CALENDAR_SURFACE.cardTop} 0%, ${CALENDAR_SURFACE.cardBottom} 100%)`,
                            border: "1px solid rgba(187,161,79,0.22)",
                            borderRadius: 16,
                            overflow: "hidden",
                            cursor: "pointer",
                            transition: "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
                            boxShadow: "0 4px 20px rgba(39,39,39,0.1)",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "translateY(-3px)";
                            e.currentTarget.style.boxShadow = "0 10px 32px rgba(39,39,39,0.15)";
                            e.currentTarget.style.borderColor = "rgba(187,161,79,0.55)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = "0 4px 20px rgba(39,39,39,0.1)";
                            e.currentTarget.style.borderColor = "rgba(187,161,79,0.22)";
                          }}
                        >
                          <div style={{ height: 3, background: `linear-gradient(90deg, ${cfg.dot}, ${cfg.dot}55, transparent)` }} />
                          <div style={{ padding: "16px 18px 18px" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                              <span style={{
                                fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em",
                                color: cfg.dot, fontFamily: "'Poppins', sans-serif",
                                background: `${cfg.dot}18`, border: `1px solid ${cfg.dot}44`,
                                padding: "3px 9px", borderRadius: 100,
                              }}>
                                {cfg.label}
                              </span>
                              <span style={{ fontSize: 11, fontWeight: 600, color: "#987554", fontFamily: "'Poppins', sans-serif", display: "flex", alignItems: "center", gap: 5 }}>
                                <FiClock size={10} style={{ color: "rgba(187,161,79,0.6)" }} />
                                {formatDisplayTime(booking.startTime)}
                              </span>
                            </div>
                            <p style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "#272727", fontFamily: "'Playfair Display', serif", lineHeight: 1.25 }}>
                              {booking.client}
                            </p>
                            <p style={{ margin: "0 0 16px", fontSize: 12, color: "rgba(187,161,79,0.75)", fontFamily: "'Poppins', sans-serif", display: "flex", alignItems: "center", gap: 6 }}>
                              <FiScissors size={10} />{booking.service}
                            </p>
                            <div style={{ height: 1, background: "rgba(187,161,79,0.15)", marginBottom: 14 }} />
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <span style={{ fontSize: 11, color: "#987554", fontFamily: "'Poppins', sans-serif", display: "flex", alignItems: "center", gap: 5 }}>
                                <FiClock size={10} />{durationLabel}
                              </span>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(187,161,79,0.08)", border: "1px solid rgba(187,161,79,0.2)", borderRadius: 100, padding: "3px 10px 3px 5px" }}>
                                <div style={{ width: 18, height: 18, borderRadius: "50%", background: `linear-gradient(135deg, ${from}, ${to})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 800, color: "#fff", fontFamily: "'Poppins', sans-serif" }}>
                                  {initials(s.full_name)}
                                </div>
                                <span style={{ fontSize: 10, color: "#987554", fontFamily: "'Poppins', sans-serif", fontWeight: 500 }}>
                                  {s.full_name.split(" ")[0]}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
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

/* ─────────────────────────────────────────────
   MAIN CALENDAR PAGE
───────────────────────────────────────────── */
export default function CalendarPage() {
  /* ── Responsive breakpoints ── */
  const [windowW, setWindowW] = useState(() => window.innerWidth);
  useEffect(() => {
    const onResize = () => setWindowW(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const isMobile = windowW < 640;
  const isTablet = windowW >= 640 && windowW < 1024;

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState("calendar"); // "calendar" | "cards"
  const [staffFilter, setStaffFilter] = useState("scheduled");
  const [dragging, setDragging] = useState(null); // { booking, offsetSlots }
  const [dragOverCol, setDragOverCol] = useState(null);  // staffId
  const [dragOverSlot, setDragOverSlot] = useState(null); // slot index
  const [hoveredTimeSlot, setHoveredTimeSlot] = useState(null); // { staffId, slot }
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [statusDrawerBooking, setStatusDrawerBooking] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm] = Form.useForm();
  const [nowMins, setNowMins] = useState(() => getGmtMinutes());

  /* ── Wizard state ── */
  const [wizStep, setWizStep] = useState(0);
  const [clientMode, setClientMode] = useState("existing");   // "existing" | "walkin"
  const [selectedClient, setSelectedClient] = useState(null); // customer object
  const [walkIn, setWalkIn] = useState({ name: "", phone: "", email: "" });
  const [selectedServices, setSelectedServices] = useState([]); // [{ id, name, _price, _amount, ... }]
  const [selectedServiceOptions, setSelectedServiceOptions] = useState({}); // { [serviceId]: serviceOptionId }
  const [staffPerService, setStaffPerService] = useState({});   // { [serviceId]: explicitly selected staffId }
  const [staffRecommendations, setStaffRecommendations] = useState({});
  const [recommendingServiceId, setRecommendingServiceId] = useState(null);
  const [wizDate, setWizDate] = useState(() => dayjs());
  const [wizTime, setWizTime] = useState(null);

  /* ── Waitlist fallback state ── */
  const [waitlistPrompt, setWaitlistPrompt] = useState(null); // { payload, errorMsg } — set when booking fails with waitlist_eligible
  const [waitlistDate, setWaitlistDate] = useState(null);     // DatePicker value for the waitlist modal
  const [waitlistStaffPerService, setWaitlistStaffPerService] = useState({}); // { [service_id]: staffId } — required per service

  const headerScrollRef = useRef(null); // staff header horizontal scroller
  const gridRef = useRef(null);      // time gutter
  const bodyRef = useRef(null);      // main scroll body
  const horizontalSyncLockRef = useRef(false);
  const queryClient = useQueryClient();

  /* ── date string ── */
  const dateStr = selectedDate.toISOString().slice(0, 10);
  const isToday = dateStr === new Date().toISOString().slice(0, 10);

  /* ── Fetch staff ── */
  const { data: staffRaw } = useQuery({
    queryKey: ["staff"],
    queryFn: () => _axios.get("/api/portal/v1/accounts/staff/").then((r) => r.data),
    staleTime: 5 * 60_000,
  });
  const visibleStaff = useMemo(() => {
    if (!staffRaw) return [];
    return Array.isArray(staffRaw) ? staffRaw : staffRaw.results ?? [];
  }, [staffRaw]);

  /* ── Fetch weekly staff schedules ── */
  const {
    data: schedulesRaw,
    isLoading: schedulesLoading,
    isError: schedulesError,
  } = useQuery({
    queryKey: ["schedules-all"],
    queryFn: () =>
      _axios.get("/api/portal/v1/booking/schedules/").then((r) => r.data),
    staleTime: 60_000,
  });
  const schedulesData = useMemo(() => {
    if (!schedulesRaw) return [];
    return Array.isArray(schedulesRaw) ? schedulesRaw : schedulesRaw.results ?? [];
  }, [schedulesRaw]);
  const schedulesByStaff = useMemo(() => {
    const weekday = scheduleWeekday(selectedDate);
    const map = new Map(visibleStaff.map((staff) => [String(staff.id), []]));

    schedulesData.forEach((entry) => {
      if (Number(entry.day_of_week) !== weekday) return;
      const staffId = typeof entry.staff === "object" ? entry.staff?.id : entry.staff;
      const key = String(staffId);
      if (map.has(key)) map.get(key).push(entry);
    });

    return map;
  }, [schedulesData, selectedDate, visibleStaff]);
  const scheduleDataReady = !schedulesLoading && !schedulesError;
  const scheduledStaff = useMemo(() => {
    if (!scheduleDataReady) return [];

    return visibleStaff.filter((staff) => {
      const entries = schedulesByStaff.get(String(staff.id)) ?? [];
      return entries.some((entry) => {
        const startMins = scheduleTimeToMins(entry.start_time);
        const endMins = scheduleTimeToMins(entry.end_time);
        return (
          entry.is_available !== false &&
          startMins !== null &&
          endMins !== null &&
          endMins > startMins
        );
      });
    });
  }, [scheduleDataReady, schedulesByStaff, visibleStaff]);
  const calendarStaff = useMemo(() => {
    if (staffFilter === "all") return visibleStaff;
    if (staffFilter.startsWith("staff:")) {
      const selectedStaffId = staffFilter.slice("staff:".length);
      return visibleStaff.filter((staff) => String(staff.id) === selectedStaffId);
    }
    return scheduledStaff;
  }, [scheduledStaff, staffFilter, visibleStaff]);
  const staffFilterOptions = useMemo(() => [
    {
      label: "Roster views",
      options: [
        { value: "scheduled", label: `Scheduled staff (${scheduledStaff.length})` },
        { value: "all", label: `All staff (${visibleStaff.length})` },
      ],
    },
    {
      label: "Individual staff",
      options: visibleStaff.map((staff) => ({
        value: `staff:${staff.id}`,
        label: staff.full_name,
      })),
    },
  ], [scheduledStaff.length, visibleStaff]);

  /* ── Fetch services (for Add form dropdown) ── */
  const { data: servicesRaw } = useQuery({
    queryKey: ["services"],
    queryFn: () => _axios.get("/api/portal/v1/booking/services/").then((r) => r.data),
    staleTime: 5 * 60_000,
  });
  const servicesData = useMemo(() => {
    if (!servicesRaw) return [];
    return Array.isArray(servicesRaw) ? servicesRaw : servicesRaw.results ?? [];
  }, [servicesRaw]);

  /* ── Fetch service categories ── */
  const { data: categoriesRaw } = useQuery({
    queryKey: ["service-categories"],
    queryFn: () => _axios.get("/api/portal/v1/booking/service-categories/").then((r) => r.data),
    staleTime: 10 * 60_000,
  });
  const categoriesData = useMemo(() => {
    if (!categoriesRaw) return [];
    return Array.isArray(categoriesRaw) ? categoriesRaw : categoriesRaw.results ?? [];
  }, [categoriesRaw]);

  /* ── Service lookup map (id → service object) ── */
  const serviceLookup = useMemo(() => {
    const map = {};
    servicesData.forEach((s) => { map[s.id] = s; });
    return map;
  }, [servicesData]);

  /* ── Fetch appointments for selected date ── */
  const { data: aptsRaw, refetch: refetchApts } = useQuery({
    queryKey: ["appointments", dateStr],
    queryFn: () =>
      _axios
        .get("/api/portal/v1/booking/appointments/", {
          params: { appointment_date: dateStr, date: dateStr },  // send both; backend uses whichever it supports
        })
        .then((r) => r.data),
    staleTime: 60_000,
  });

  /* ── Fetch blocked days (for calendar banner + wizard DatePicker) ── */
  const { data: blockedDaysData = [] } = useQuery({
    queryKey: ["blocked-days"],
    queryFn: fetchBlockedDays,
    staleTime: 5 * 60_000,   // cache for 5 minutes
  });

  // Set of blocked date strings "YYYY-MM-DD" for O(1) lookup — expands ranges
  const blockedDateSet = useMemo(() => {
    const set = new Set();
    blockedDaysData.forEach((p) => {
      let cur = dayjs(p.start_date);
      const end = dayjs(p.end_date);
      while (!cur.isAfter(end)) {
        set.add(cur.format("YYYY-MM-DD"));
        cur = cur.add(1, "day");
      }
    });
    return set;
  }, [blockedDaysData]);

  // Is the currently viewed date blocked?
  const selectedDateIsBlocked = blockedDateSet.has(dateStr);
  const selectedDateBlockReason =
    blockedDaysData.find((p) => dateStr >= p.start_date && dateStr <= p.end_date)?.reason || "";

  const serviceOptionsReady = useMemo(
    () => selectedServices.every((service) => {
      const options = normalizeServiceOptions(service);
      return options.length === 0 || !!selectedServiceOptions[service.id];
    }),
    [selectedServices, selectedServiceOptions]
  );

  const shouldFetchServiceAvailability =
    selectedServices.length > 0 &&
    !!wizDate &&
    !!wizTime &&
    serviceOptionsReady;

  const {
    data: serviceAvailabilityMap = {},
    isFetching: isFetchingServiceAvailability,
    error: serviceAvailabilityError,
    refetch: refetchServiceAvailability,
  } = useQuery({
    queryKey: [
      "booking-service-availability",
      wizDate?.format("YYYY-MM-DD"),
      wizTime,
      selectedServices.map((service) => service.id),
      selectedServices.map((service) => [service.id, selectedServiceOptions[service.id] ?? null]),
    ],
    enabled: shouldFetchServiceAvailability,
    queryFn: async () => {
      const requestedServices = selectedServices.map((service) => ({
        service_id: service.id,
        ...(selectedServiceOptions[service.id]
          ? { service_option_id: Number(selectedServiceOptions[service.id]) }
          : {}),
      }));
      const response = await getBookingStaffOptions({
        appointment_date: wizDate.format("YYYY-MM-DD"),
        start_time: `${wizTime}:00`,
        services: requestedServices,
      });
      const rows = normalizeBookingStaffOptions(response, requestedServices, visibleStaff);
      return Object.fromEntries(rows.map((row) => [String(row.service_id), row]));
    },
    staleTime: 60_000,
    retry: 1,
  });

  /* ── Normalise API → internal booking shape ── */
  const dayBookings = useMemo(() => {
    const raw = Array.isArray(aptsRaw) ? aptsRaw : aptsRaw?.results ?? [];
    return raw.flatMap((apt) => {
      const services = apt.services ?? apt.booking_services ?? [];
      const firstService = services[0];
      const client =
        apt.customer_name ||
        apt.customer_full_name ||
        apt.guest_name ||
        apt.guest?.full_name ||
        (apt.customer_details
          ? `${apt.customer_details.first_name ?? ""} ${apt.customer_details.last_name ?? ""}`.trim()
          : null) ||
        (apt.customer ? `Client #${apt.customer}` : "Walk-in");
      const phone =
        apt.guest_customer?.phone_number ||
        apt.phone_number ||
        apt.guest?.phone_number ||
        apt.customer_details?.phone ||
        apt.customer_details?.phone_number ||
        apt.guest_phone ||
        null;

      const orderedServiceLines = services
        .map((service, originalIndex) => {
          const rawStaff = service.staff_id ?? service.staff;
          const staffId = typeof rawStaff === "object" ? rawStaff?.id : rawStaff;
          const startMs = Date.parse(service.scheduled_start);
          const endMs = Date.parse(service.scheduled_end);
          const sequence = Number(service.sequence);
          return {
            service,
            originalIndex,
            staffId: staffId != null ? Number(staffId) : null,
            startMs,
            endMs,
            sequence: Number.isFinite(sequence) ? sequence : originalIndex + 1,
          };
        })
        .sort((a, b) => a.sequence - b.sequence || a.originalIndex - b.originalIndex);

      const canSplitByService =
        orderedServiceLines.length > 0 &&
        orderedServiceLines.every(
          (line) =>
            Number.isFinite(line.staffId) &&
            Number.isFinite(line.startMs) &&
            Number.isFinite(line.endMs) &&
            line.endMs > line.startMs
        );

      if (canSplitByService) {
        const groups = [];
        orderedServiceLines.forEach((line) => {
          const previous = groups.at(-1);
          if (
            previous &&
            previous.staffId === line.staffId &&
            previous.endMs === line.startMs
          ) {
            previous.lines.push(line);
            previous.endMs = line.endMs;
            return;
          }
          groups.push({
            staffId: line.staffId,
            startMs: line.startMs,
            endMs: line.endMs,
            lines: [line],
          });
        });

        return groups.map((group, groupIndex) => {
          const groupServices = group.lines.map((line) => line.service);
          const startIso = group.lines[0].service.scheduled_start;
          const segmentServiceIds = groupServices.map(
            (service, index) => service.id ?? service.service_id ?? index
          );
          return {
            id: apt.id,
            appointmentId: apt.id,
            calendarId: `${apt.id}:${segmentServiceIds.join("-")}`,
            staffId: group.staffId,
            client,
            service: groupServices
              .map((service) => service.service_name || service.name || "Service")
              .join(" · "),
            appointmentServiceSummary: apt.service_summary || apt.service_name || "Service",
            services: groupServices,
            startTime: startIso.slice(11, 16),
            durationMins: Math.max(1, Math.round((group.endMs - group.startMs) / 60_000)),
            status: (apt.status || "pending").replace("_", "-"),
            date: startIso.slice(0, 10),
            phone,
            isServiceSegment: groups.length > 1,
            segmentIndex: groupIndex,
            segmentCount: groups.length,
            raw: apt,
          };
        });
      }

      const aptDate = apt.scheduled_start
        ? apt.scheduled_start.slice(0, 10)
        : apt.appointment_date ?? dateStr;
      const startTime = apt.scheduled_start?.length >= 16
        ? apt.scheduled_start.slice(11, 16)
        : apt.start_time?.slice(0, 5) || "09:00";
      let staffId =
        (typeof apt.staff === "object" && apt.staff !== null
          ? apt.staff.id
          : apt.staff_details?.id ?? (apt.staff != null ? apt.staff : undefined)) ??
        firstService?.staff_id ??
        (typeof firstService?.staff === "object" ? firstService.staff?.id : firstService?.staff) ??
        null;

      if (staffId == null) {
        const svcName = apt.service_name || apt.service_summary || "";
        const svcById = serviceLookup[apt.service];
        const svcByName = svcName
          ? Object.values(serviceLookup).find(
              (service) => service.name?.toLowerCase() === svcName.toLowerCase()
            )
          : null;
        const svcObj = svcById || svcByName;
        const assignedIds = svcObj?.assigned_staff_ids ?? svcObj?.staff_ids ?? [];
        const match = visibleStaff.find((staff) =>
          assignedIds.includes(staff.id) || assignedIds.includes(String(staff.id))
        );
        staffId = match?.id ?? visibleStaff[0]?.id ?? null;
      }

      const service =
        apt.service_name ||
        apt.service_details?.name ||
        firstService?.service_name ||
        firstService?.name ||
        serviceLookup[apt.service]?.name ||
        "Service";
      const durationMins =
        apt.total_duration_minutes ??
        apt.duration_mins ??
        apt.service_details?.duration_mins ??
        apt.service_details?.duration ??
        firstService?.duration_minutes ??
        firstService?.duration_mins ??
        serviceLookup[apt.service]?.duration_mins ??
        serviceLookup[apt.service]?.duration ??
        60;

      return [{
        id: apt.id,
        appointmentId: apt.id,
        calendarId: String(apt.id),
        staffId: staffId != null ? Number(staffId) : null,
        client,
        service,
        appointmentServiceSummary: apt.service_summary || apt.service_name || service,
        services,
        startTime,
        durationMins,
        status: (apt.status || "pending").replace("_", "-"),
        date: aptDate,
        phone,
        isServiceSegment: false,
        segmentIndex: 0,
        segmentCount: 1,
        raw: apt,
      }];
    });
  }, [aptsRaw, serviceLookup, dateStr, visibleStaff]);

  /* Keep every selected day anchored at its finite midnight start. */
  useEffect(() => {
    const el = bodyRef.current;
    if (!el || view !== "calendar") return;
    el.scrollTop = 0;
    if (gridRef.current) gridRef.current.scrollTop = 0;
  }, [dateStr, view]);

  /* Track the exact GMT+0 position; each tick reads the clock to avoid drift. */
  useEffect(() => {
    const tick = () => setNowMins(getGmtMinutes());
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, []);

  /* date helpers */
  function prevDay() {
    setSelectedDate((d) => {
      const n = new Date(d);
      n.setDate(n.getDate() - 1);
      return n;
    });
  }
  function nextDay() {
    setSelectedDate((d) => {
      const n = new Date(d);
      n.setDate(n.getDate() + 1);
      return n;
    });
  }

  /* responsive column sizes */
  const colW     = isMobile ? 150 : isTablet ? 180 : COLUMN_W;
  const gutterW  = isMobile ? 52  : 72;

  const syncHorizontalScroll = (fromEl, toEl) => {
    if (!fromEl || !toEl) return;
    if (horizontalSyncLockRef.current) return;
    horizontalSyncLockRef.current = true;
    toEl.scrollLeft = fromEl.scrollLeft;
    requestAnimationFrame(() => {
      horizontalSyncLockRef.current = false;
    });
  };

  /* ── Wizard helpers ── */
  const resetWizard = useCallback(() => {
    setWizStep(0);
    setClientMode("existing");
    setSelectedClient(null);
    setWalkIn({ name: "", phone: "", email: "" });
    setSelectedServices([]);
    setSelectedServiceOptions({});
    setStaffPerService({});
    setStaffRecommendations({});
    setRecommendingServiceId(null);
    setWizDate(dayjs());
    setWizTime(null);
  }, []);

  const openWizard = useCallback(() => {
    resetWizard();
    createAppointment.reset();
    setWizDate(dayjs(selectedDate));
    setAddOpen(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetWizard, selectedDate]);

  useEffect(() => {
    const selectedIds = new Set(selectedServices.map((service) => String(service.id)));

    setSelectedServiceOptions((prev) => {
      const next = Object.fromEntries(
        Object.entries(prev).filter(([serviceId]) => selectedIds.has(String(serviceId)))
      );
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });

    setStaffPerService((prev) => {
      const next = Object.fromEntries(
        Object.entries(prev).filter(([serviceId]) => selectedIds.has(String(serviceId)))
      );
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });

    setStaffRecommendations((prev) => {
      const next = Object.fromEntries(
        Object.entries(prev).filter(([serviceId]) => selectedIds.has(String(serviceId)))
      );
      return Object.keys(next).length === Object.keys(prev).length ? prev : next;
    });
  }, [selectedServices]);

  useEffect(() => {
    setStaffRecommendations({});
  }, [wizDate, wizTime, selectedServiceOptions, selectedServices]);

  useEffect(() => {
    setStaffPerService((prev) => {
      let changed = false;
      const next = {};

      Object.entries(prev).forEach(([serviceId, staffId]) => {
        const availability = serviceAvailabilityMap[String(serviceId)];
        if (!availability) {
          next[serviceId] = staffId;
          return;
        }

        const stillAvailable = (availability.staff || []).some((person) => String(person.id) === String(staffId));
        const recommendation = staffRecommendations[String(serviceId)];
        const stillRecommended = recommendation?.available
          && String(recommendation.staff?.id) === String(staffId)
          && (!recommendation.expires_at || Date.parse(recommendation.expires_at) > Date.now());
        if (stillAvailable || stillRecommended) {
          next[serviceId] = staffId;
          return;
        }

        changed = true;
      });

      return changed ? next : prev;
    });
  }, [serviceAvailabilityMap, staffRecommendations]);

  const recommendStaffForService = useCallback(async (service, availability) => {
    if (!availability?.scheduled_start) return;
    setRecommendingServiceId(service.id);
    try {
      const selectedOptionId = selectedServiceOptions[service.id];
      const response = await recommendWalkInStaff({
        service_id: service.id,
        ...(selectedOptionId ? { service_option_id: Number(selectedOptionId) } : {}),
        scheduled_start: availability.scheduled_start,
      });
      const recommendation = normalizeStaffRecommendation(response, visibleStaff);
      setStaffRecommendations((prev) => ({ ...prev, [String(service.id)]: recommendation }));
      if (recommendation.available && recommendation.staff?.id != null) {
        setStaffPerService((prev) => ({ ...prev, [service.id]: recommendation.staff.id }));
      }
    } catch (error) {
      message.error(firstApiErrorMessage(error, "A provider could not be recommended for this service."));
    } finally {
      setRecommendingServiceId(null);
    }
  }, [selectedServiceOptions, visibleStaff]);

  const staffSelectionsValid = useMemo(() => {
    if (!shouldFetchServiceAvailability || isFetchingServiceAvailability || serviceAvailabilityError) return false;
    return selectedServices.every((service) => {
      const selectedStaffId = staffPerService[service.id];
      if (!selectedStaffId) return false;
      const availability = serviceAvailabilityMap[String(service.id)];
      const manuallyEligible = (availability?.staff ?? []).some(
        (person) => String(person.id) === String(selectedStaffId)
      );
      const recommendation = staffRecommendations[String(service.id)];
      const recommendationEligible = recommendation?.available
        && String(recommendation.staff?.id) === String(selectedStaffId)
        && (!recommendation.expires_at || Date.parse(recommendation.expires_at) > Date.now());
      return manuallyEligible || recommendationEligible;
    });
  }, [
    shouldFetchServiceAvailability,
    isFetchingServiceAvailability,
    serviceAvailabilityError,
    selectedServices,
    staffPerService,
    serviceAvailabilityMap,
    staffRecommendations,
  ]);

  const serviceWindowsAvailable = useMemo(() => {
    if (!shouldFetchServiceAvailability || isFetchingServiceAvailability || serviceAvailabilityError) {
      return false;
    }
    return selectedServices.every((service) => {
      const availability = serviceAvailabilityMap[String(service.id)];
      return availability?.available === true && (availability.staff ?? []).length > 0;
    });
  }, [
    shouldFetchServiceAvailability,
    isFetchingServiceAvailability,
    serviceAvailabilityError,
    selectedServices,
    serviceAvailabilityMap,
  ]);

  /* ── Wizard validation per step ── */
  const wizStepValid = useMemo(() => {
    switch (wizStep) {
      case 0: // Client
        if (clientMode === "existing") return !!selectedClient;
        return walkIn.name.trim() !== "" && walkIn.phone.trim() !== "";
      case 1: // Services
        return selectedServices.length > 0;
      case 2: // Service options
        return serviceOptionsReady;
      case 3: // Date & Time — also blocked if selected date is a blocked day
        if (!wizDate || !wizTime) return false;
        if (blockedDateSet.has(wizDate.format("YYYY-MM-DD"))) return false;
        return serviceWindowsAvailable;
      case 4: // Staff
        return staffSelectionsValid;
      case 5: // Confirm
        return staffSelectionsValid;
      default:
        return false;
    }
  }, [
    wizStep,
    clientMode,
    selectedClient,
    walkIn,
    selectedServices,
    serviceOptionsReady,
    wizDate,
    wizTime,
    blockedDateSet,
    serviceWindowsAvailable,
    staffSelectionsValid,
  ]);

  /* ── POST mutation — create appointment ── */
  const createAppointment = useMutation({
    mutationFn: (data) =>
      _axios.post("/api/portal/v1/booking/appointments/", data),
    onSuccess: (_, sentPayload) => {
      // Invalidate the specific date that was booked (may differ from today)
      const bookedDate = sentPayload?.appointment_date ?? dateStr;
      queryClient.invalidateQueries({ queryKey: ["appointments", bookedDate] });
      // Also invalidate the currently viewed date if it's different
      if (bookedDate !== dateStr) {
        queryClient.invalidateQueries({ queryKey: ["appointments", dateStr] });
      }
      refetchApts();
      setAddOpen(false);
      resetWizard();
      addForm.resetFields();
    },
    onError: (err, sentPayload) => {
      const data = err?.response?.data ?? {};
      const msg = firstApiErrorMessage(err, "Failed to create appointment");

      // ── Waitlist eligible? Offer fallback ──
      const isWaitlistEligible =
        data.waitlist_eligible === true ||
        ["waitlist_eligible", "slot_unavailable", "fully_booked", "outside_business_hours"]
          .includes(data.code);

      if (isWaitlistEligible) {
        // Pre-fill staff from whatever was resolved in the failed payload
        const preStaff = {};
        (sentPayload?.services || []).forEach((s) => {
          if (s.staff_id) preStaff[s.service_id] = s.staff_id;
        });
        setWaitlistStaffPerService(preStaff);
        setWaitlistPrompt({ payload: sentPayload, errorMsg: msg });
      } else {
        message.error(msg);
        if (err?.response?.status === 409 || data.code === "conflict") {
          setWizStep(4);
          refetchServiceAvailability();
        }
      }
      createAppointment.reset();
    },
  });

  /* ── POST mutation — create waitlist entry (fallback) ── */
  const createWaitlist = useMutation({
    mutationFn: (data) => createWaitlistEntry(data),
    onSuccess: () => {
      setWaitlistPrompt(null);
      setWaitlistDate(null);
      setWaitlistStaffPerService({});
      setAddOpen(false);
      resetWizard();
      addForm.resetFields();
    },
    onError: (err) => {
      message.error(firstApiErrorMessage(err, "Failed to add to waitlist"));
    },
  });

  /* ── PATCH mutation — reschedule (drag & drop) ── */
  const reschedule = useMutation({
    mutationFn: ({ id, startTime, staffId }) => {
      // Reconstruct full ISO string from dateStr + new time
      const iso = `${dateStr}T${startTime}:00`;
      return _axios.patch(`/api/portal/v1/booking/appointments/${id}/`, {
        scheduled_start: iso,
        staff: staffId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["appointments", dateStr]);
      refetchApts();
    },
    onError: () => {
      message.error("Failed to reschedule");
      // Refetch to revert optimistic state
      refetchApts();
    },
  });

  /* ── POST mutation — update status from modal ── */
  const updateStatus = useMutation({
    mutationFn: ({ id, status }) =>
      _axios.post(`/api/portal/v1/booking/appointments/${id}/status/`, { status }),
    onSuccess: (_, { status }) => {
      setSelectedBooking((prev) => prev ? { ...prev, status } : prev);
      setStatusDrawerBooking((prev) => prev ? { ...prev, status } : prev);
      queryClient.invalidateQueries(["appointments", dateStr]);
      refetchApts();
    },
    onError: (error) => {
      const errorMsg = error?.response?.data?.detail || 
                       error?.response?.data?.outstanding_balance || 
                       "Failed to update status";
      message.error(errorMsg);
    },
  });

  /* ── POST mutation — reschedule from modal ── */
  const rescheduleFromModal = useMutation({
    mutationFn: ({ id, date, time, staffId, reason }) =>
      _axios.post(`/api/portal/v1/booking/appointments/${id}/schedule/`, {
        date,
        start_time: `${time}:00`,
        staff_id:   staffId,
        reason:     reason || "",
      }),
    onSuccess: () => {
      setSelectedBooking(null);
      setStatusDrawerBooking(null);
      queryClient.invalidateQueries(["appointments", dateStr]);
      refetchApts();
    },
    onError: () => {
      message.error("Failed to reschedule appointment");
    },
  });

  /* ── POST mutation — cancel appointment ── */
  const cancelAppointment = useMutation({
    mutationFn: (id) =>
      _axios.post(`/api/portal/v1/booking/appointments/${id}/cancel/`),
    onSuccess: () => {
      setSelectedBooking(null);
      setStatusDrawerBooking(null);
      queryClient.invalidateQueries(["appointments", dateStr]);
      refetchApts();
    },
    onError: () => {
      message.error("Failed to cancel appointment");
    },
  });

  /* ── DELETE mutation — permanently delete appointment ── */
  const deleteAppointment = useMutation({
    mutationFn: (id) =>
      _axios.delete(`/api/portal/v1/booking/appointments/${id}/`),
    onSuccess: () => {
      setSelectedBooking(null);
      setStatusDrawerBooking(null);
      queryClient.invalidateQueries(["appointments", dateStr]);
      refetchApts();
    },
    onError: () => {
      message.error("Failed to delete appointment");
    },
  });

  /* ── Drag & Drop ── */
  function handleDragStart(e, booking) {
    e.dataTransfer.effectAllowed = "move";
    setDragging({ booking });
  }

  function handleDragOver(e, staffId) {
    e.preventDefault();
    if (!bodyRef.current) return;

    const gridRect = bodyRef.current.getBoundingClientRect();
    const y = e.clientY - gridRect.top + bodyRef.current.scrollTop;
    const slot = yToSlot(y);
    const staffSchedule = schedulesByStaff.get(String(staffId)) ?? [];
    const isAvailable =
      scheduleDataReady && isSlotInsideSchedule(staffSchedule, slot * SLOT_MINS);
    e.dataTransfer.dropEffect = isAvailable ? "move" : "none";
    if (!isAvailable) {
      setDragOverCol(null);
      setDragOverSlot(null);
      return;
    }
    setDragOverCol(staffId);
    setDragOverSlot(slot);
  }

  function handleDrop(e, staffId) {
    e.preventDefault();
    if (!dragging) return;

    const gridRect = bodyRef.current.getBoundingClientRect();
    const y = e.clientY - gridRect.top + bodyRef.current.scrollTop;
    const slot = yToSlot(y);
    const staffSchedule = schedulesByStaff.get(String(staffId)) ?? [];
    const isAvailable =
      scheduleDataReady && isSlotInsideSchedule(staffSchedule, slot * SLOT_MINS);
    if (!isAvailable) {
      setDragOverCol(null);
      setDragOverSlot(null);
      return;
    }
    const newMins = slot * SLOT_MINS;
    const nowFloor = Math.floor(nowMins / SLOT_MINS) * SLOT_MINS;

    // block drop on past if today
    if (isToday && newMins < nowFloor) {
      message.warning("Cannot move a booking to a past time");
      setDragging(null);
      setDragOverCol(null);
      setDragOverSlot(null);
      return;
    }

    const newTime = minsToTime(newMins);

    // PATCH to backend (refetch on success/error handles state update)
    reschedule.mutate({
      id: dragging.booking.id,
      startTime: newTime,
      staffId,
    });

    setDragging(null);
    setDragOverCol(null);
    setDragOverSlot(null);
  }

  function handleDragEnd() {
    setDragging(null);
    setDragOverCol(null);
    setDragOverSlot(null);
  }

  /* is a booking in the past (only for today) */
  function bookingIsPast(booking) {
    if (!isToday) return false;
    const startMins = timeToMins(booking.startTime);
    return startMins + booking.durationMins <= nowMins;
  }

  /* ── time labels ── */
  const timeLabels = [];
  for (let s = 0; s < TOTAL_SLOTS; s++) {
    const mins = s * SLOT_MINS;
    const totalMin = mins + CALENDAR_START_HOUR * 60;
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    const isHour = m === 0;
    const isHalfHour = m === 30;
    timeLabels.push({ s, h, m, isHour, isHalfHour, mins });
  }

  /* current-time line Y */
  const nowY = minsToY(nowMins);

  const displayDate = selectedDate.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const totalDayBookings = new Set(dayBookings.map((booking) => booking.appointmentId ?? booking.id)).size;

  return (
    <div
      style={{
        animation: "fadeInUp 0.4s ease both",
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        /* bleed to edges — cancel the layout padding */
        margin: isMobile ? "-20px -20px -20px -20px" : "-20px -32px -32px -32px",
      }}
    >
      {/* ── Calendar Shell (full height, black) ── */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          background: CALENDAR_SURFACE.shell,
          overflow: "hidden",
          /* no border-radius when filling the whole frame */
        }}
      >
        {/* ── Top bar: title + stats + date nav ── */}
        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "stretch" : "center",
            justifyContent: "space-between",
            padding: isMobile ? "12px 16px" : "16px 28px",
            borderBottom: "1px solid rgba(187,161,79,0.15)",
            background: CALENDAR_SURFACE.raised,
            gap: isMobile ? 10 : 16,
            flexShrink: 0,
          }}
        >
          {/* Row 1 (always): icon + title + count */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "linear-gradient(135deg, #BBA14F22, #BBA14F11)",
                border: "1px solid rgba(187,161,79,0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#BBA14F",
                flexShrink: 0,
              }}
            >
              <FiCalendar size={16} />
            </div>
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: isMobile ? 14 : 15,
                  fontWeight: 700,
                  color: "#272727",
                  fontFamily: "'Playfair Display', serif",
                  lineHeight: 1.2,
                }}
              >
                Booking Calendar
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  color: "rgba(187,161,79,0.85)",
                  fontFamily: "'Poppins', sans-serif",
                  lineHeight: 1.3,
                }}
              >
                {totalDayBookings} appointment{totalDayBookings !== 1 ? "s" : ""}{" "}
                · {isToday ? "Today" : displayDate}
              </p>
            </div>

            {/* On mobile: push view toggle to the right of title row */}
            {isMobile && (
              <div style={{ marginLeft: "auto" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    background: "rgba(187,161,79,0.08)",
                    border: "1px solid rgba(187,161,79,0.2)",
                    borderRadius: 100,
                    padding: 3,
                    gap: 2,
                  }}
                >
                  {[
                    { key: "calendar", icon: <FiCalendar size={13} /> },
                    { key: "cards",    icon: <FiGrid    size={13} /> },
                  ].map(({ key, icon }) => {
                    const active = view === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setView(key)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 30,
                          height: 30,
                          borderRadius: 100,
                          border: "none",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          background: active
                            ? "linear-gradient(135deg, #BBA14F, #987554)"
                            : "transparent",
                          color: active ? "#FFFFFF" : "#987554",
                          boxShadow: active ? "0 2px 12px rgba(187,161,79,0.4)" : "none",
                        }}
                      >
                        {icon}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Row 2 on mobile (toggle + date nav together); on desktop separate blocks */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: isMobile ? 8 : 16,
              justifyContent: isMobile ? "space-between" : "flex-end",
            }}
          >
            {/* Centre — view toggle (hidden on mobile, rendered inline in row 1) */}
            {!isMobile && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "rgba(187,161,79,0.08)",
                  border: "1px solid rgba(187,161,79,0.2)",
                  borderRadius: 100,
                  padding: 4,
                  gap: 2,
                }}
              >
                {[
                  { key: "calendar", icon: <FiCalendar size={13} />, label: "Calendar" },
                  { key: "cards",    icon: <FiGrid    size={13} />, label: "Cards"    },
                ].map(({ key, icon, label }) => {
                  const active = view === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setView(key)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "7px 16px",
                        borderRadius: 100,
                        border: "none",
                        cursor: "pointer",
                        fontFamily: "'Poppins', sans-serif",
                        fontSize: 11,
                        fontWeight: active ? 700 : 500,
                        transition: "all 0.2s ease",
                        background: active
                          ? "linear-gradient(135deg, #BBA14F, #987554)"
                          : "transparent",
                        color: active ? "#FFFFFF" : "#987554",
                        boxShadow: active ? "0 2px 12px rgba(187,161,79,0.4)" : "none",
                      }}
                    >
                      {icon}
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Right — date navigator */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                background: "rgba(187,161,79,0.08)",
                border: "1px solid rgba(187,161,79,0.2)",
                borderRadius: 100,
                padding: "4px 6px",
                flex: isMobile ? 1 : "unset",
                justifyContent: isMobile ? "space-between" : "flex-start",
              }}
            >
              <button
                onClick={prevDay}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  border: "none",
                  background: "transparent",
                  color: "#987554",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.15s, color 0.15s",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(187,161,79,0.15)"; e.currentTarget.style.color = "#BBA14F"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#987554"; }}
              >
                <FiChevronLeft size={15} />
              </button>

              <span
                style={{
                  fontSize: isMobile ? 11 : 12,
                  fontWeight: 600,
                  color: "#272727",
                  fontFamily: "'Poppins', sans-serif",
                  minWidth: isMobile ? 0 : 150,
                  flex: isMobile ? 1 : "unset",
                  textAlign: "center",
                  padding: "0 6px",
                  whiteSpace: "nowrap",
                }}
              >
                {isToday ? "Today · " : ""}
                {selectedDate.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: isMobile ? undefined : "numeric",
                })}
              </span>

              <button
                onClick={nextDay}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  border: "none",
                  background: "transparent",
                  color: "#987554",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.15s, color 0.15s",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(187,161,79,0.15)"; e.currentTarget.style.color = "#BBA14F"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#987554"; }}
              >
                <FiChevronRight size={15} />
              </button>

              {!isToday && (
                <button
                  onClick={() => setSelectedDate(new Date())}
                  style={{
                    marginLeft: 4,
                    fontSize: 11,
                    padding: "5px 14px",
                    borderRadius: 100,
                    border: "none",
                    background: "linear-gradient(135deg, #BBA14F, #987554)",
                    color: "#fff",
                    fontFamily: "'Poppins', sans-serif",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "opacity 0.15s",
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                >
                  Today
                </button>
              )}
            </div>

            {/* ── Add Appointment button — disabled on blocked days ── */}
            <button
              onClick={!selectedDateIsBlocked ? openWizard : undefined}
              disabled={selectedDateIsBlocked}
              title={selectedDateIsBlocked ? "Salon is closed on this day" : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: isMobile ? "7px 10px" : "7px 16px",
                borderRadius: 100,
                border: "none",
                cursor: selectedDateIsBlocked ? "not-allowed" : "pointer",
                background: selectedDateIsBlocked
                  ? "rgba(224,80,80,0.25)"
                  : "linear-gradient(135deg, #BBA14F, #987554)",
                color: selectedDateIsBlocked ? "#e05050" : "#fff",
                fontFamily: "'Poppins', sans-serif",
                fontSize: 12,
                fontWeight: 700,
                boxShadow: selectedDateIsBlocked ? "none" : "0 2px 14px rgba(187,161,79,0.4)",
                flexShrink: 0,
                transition: "opacity 0.15s, transform 0.15s",
                opacity: selectedDateIsBlocked ? 0.7 : 1,
              }}
              onMouseEnter={(e) => { if (!selectedDateIsBlocked) { e.currentTarget.style.opacity = "0.88"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = selectedDateIsBlocked ? "0.7" : "1"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              {selectedDateIsBlocked ? <FiSlash size={14} /> : <FiPlus size={14} />}
              {!isMobile && (selectedDateIsBlocked ? "Day Blocked" : "Add Appointment")}
            </button>
          </div>
        </div>

        {view === "calendar" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: isMobile ? "8px 16px" : "8px 28px",
              background: CALENDAR_SURFACE.muted,
              borderBottom: "1px solid rgba(92,74,52,0.14)",
              flexShrink: 0,
            }}
          >
            <FiUsers size={13} color="#8b744e" style={{ flexShrink: 0 }} />
            {!isMobile && (
              <span style={{ color: "#6f5a42", fontSize: 10, fontWeight: 700, fontFamily: "'Poppins',sans-serif", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Showing
              </span>
            )}
            <Select
              value={staffFilter}
              onChange={setStaffFilter}
              options={staffFilterOptions}
              showSearch
              optionFilterProp="label"
              popupMatchSelectWidth={260}
              aria-label="Filter calendar staff"
              style={{
                width: isMobile ? "100%" : 220,
                fontFamily: "'Poppins',sans-serif",
              }}
            />
            {!isMobile && (
              <span style={{ marginLeft: "auto", color: "rgba(111,90,66,0.72)", fontSize: 10, fontFamily: "'Poppins',sans-serif" }}>
                {calendarStaff.length} column{calendarStaff.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}

        {/* ── Blocked day banner — shown when the selected date is closed ── */}
        {selectedDateIsBlocked && (
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: isMobile ? "10px 16px" : "11px 28px",
            background: "rgba(224,80,80,0.1)",
            borderBottom: "1px solid rgba(224,80,80,0.25)",
            flexShrink: 0,
          }}>
            <FiSlash size={15} color="#e05050" style={{ flexShrink: 0 }} />
            <p style={{
              margin: 0, flex: 1,
              fontSize: 12, fontWeight: 600,
              color: "#e05050",
              fontFamily: "'Poppins', sans-serif",
            }}>
              <strong>Salon closed</strong>
              {selectedDateBlockReason ? ` · ${selectedDateBlockReason}` : ""}.
              {" "}New bookings are disabled for this day.
              {" "}
              <a
                href="/blocked-days"
                style={{ color: "rgba(224,80,80,0.7)", textDecoration: "underline", fontWeight: 700 }}
              >
                Manage blocked days →
              </a>
            </p>
          </div>
        )}

        {/* ── Cards view ── */}
        {view === "cards" && (
          <AppointmentsCardView
            dayBookings={dayBookings}
            staff={visibleStaff}
            onCardClick={setSelectedBooking}
            isMobile={isMobile}
          />
        )}

        {/* ── Calendar view ── */}
        {view === "calendar" && (<>

        {/* ── Column headers ── */}
        <div
          style={{
            display: "flex",
            flexShrink: 0,
            borderBottom: "1px solid rgba(187,161,79,0.15)",
            background: CALENDAR_SURFACE.muted,
          }}
        >
          {/* Time gutter header */}
          <div
            style={{
              width: gutterW,
              flexShrink: 0,
              borderRight: "1px solid rgba(92,74,52,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "10px 0",
            }}
          >
            <FiClock size={14} style={{ color: "rgba(187,161,79,0.7)" }} />
          </div>

          {/* Staff columns header */}
          <div
            ref={headerScrollRef}
            className="flex-1 overflow-x-auto"
            style={{ scrollbarWidth: "none" }}
            onScroll={(e) => syncHorizontalScroll(e.currentTarget, bodyRef.current)}
          >
            <div
              className="flex"
              style={{ minWidth: calendarStaff.length ? calendarStaff.length * colW : "100%" }}
            >
              {calendarStaff.length === 0 && (
                <div
                  style={{
                    width: "100%",
                    minHeight: 54,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    color: schedulesError ? "#7e4d3e" : "#78654f",
                    fontFamily: "'Poppins',sans-serif",
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {schedulesLoading && staffFilter === "scheduled" && <Spin size="small" />}
                  {schedulesLoading && staffFilter === "scheduled"
                    ? "Loading staff schedules…"
                    : schedulesError && staffFilter === "scheduled"
                    ? "Staff schedules could not be loaded."
                    : staffFilter === "scheduled"
                    ? "No staff scheduled for this day."
                    : "No staff match this filter."}
                </div>
              )}
              {calendarStaff.map((staff, i) => {
                const [from, to] = avatarGradient(staff.full_name);
                const staffBookings = dayBookings.filter((b) => b.staffId === staff.id);
                const staffAppointmentCount = new Set(
                  staffBookings.map((booking) => booking.appointmentId ?? booking.id)
                ).size;
                return (
                  <div
                    key={staff.id}
                    style={{
                      width: colW,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: isMobile ? 6 : 10,
                      padding: isMobile ? "8px 10px" : "10px 16px",
                      borderRight:
                        i < calendarStaff.length - 1
                          ? "1px solid rgba(92,74,52,0.2)"
                          : "none",
                    }}
                  >
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: "50%",
                        background: `linear-gradient(135deg, ${from}, ${to})`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#fff",
                        fontFamily: "'Poppins', sans-serif",
                        flexShrink: 0,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                      }}
                    >
                      {initials(staff.full_name)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#272727",
                          fontFamily: "'Poppins', sans-serif",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {staff.full_name}
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 10,
                          color: "rgba(187,161,79,0.7)",
                          fontFamily: "'Poppins', sans-serif",
                        }}
                      >
                        {staffAppointmentCount} booking{staffAppointmentCount !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Scrollable grid body */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}>
          {/* Time gutter */}
          <div
            className="hide-scrollbar"
            style={{
              width: gutterW,
              flexShrink: 0,
              borderRight: "1px solid rgba(92,74,52,0.25)",
              background: CALENDAR_SURFACE.muted,
              overflowY: "auto",
              overflowX: "hidden",
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
            ref={gridRef}
          >
            <div style={{ height: TOTAL_SLOTS * SLOT_HEIGHT_PX, position: "relative" }}>
              {timeLabels.map(({ s, h, isHour }) => (
                <div
                  key={s}
                  style={{
                    position: "absolute",
                    top: s * SLOT_HEIGHT_PX,
                    height: SLOT_HEIGHT_PX,
                    width: "100%",
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "flex-end",
                    paddingRight: isMobile ? 7 : 10,
                    paddingTop: 3,
                    boxSizing: "border-box",
                  }}
                >
                  {isHour && (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "baseline",
                        gap: 3,
                        fontSize: isMobile ? 10 : 11,
                        fontFamily: "'Poppins', sans-serif",
                        color: "#272727",
                        fontWeight: 700,
                        lineHeight: 1,
                      }}
                    >
                      <span>{h % 12 || 12}</span>
                      <span style={{ fontSize: 7, color: "#78654f", letterSpacing: "0.06em" }}>
                        {h >= 12 ? "PM" : "AM"}
                      </span>
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Staff columns */}
          <div
            className="flex-1 overflow-auto"
            id="cal-scroll"
            ref={bodyRef}
            onScroll={(e) => {
              if (gridRef.current)
                gridRef.current.scrollTop = e.currentTarget.scrollTop;
              syncHorizontalScroll(e.currentTarget, headerScrollRef.current);
            }}
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            <div
              className="flex relative"
              style={{
                minWidth: calendarStaff.length ? calendarStaff.length * colW : "100%",
                height: TOTAL_SLOTS * SLOT_HEIGHT_PX,
              }}
            >
              {/* Horizontal slot lines (shared background) */}
              <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 6 }}>
                {timeLabels.map(({ s, isHour, isHalfHour }) => (
                  <div
                    key={s}
                    className="absolute left-0 right-0"
                    style={{
                      top: s * SLOT_HEIGHT_PX,
                      height: 1,
                      background: isHour
                        ? "rgba(124,100,64,0.16)"
                        : isHalfHour
                        ? "rgba(124,100,64,0.07)"
                        : "rgba(124,100,64,0.035)",
                    }}
                  />
                ))}
              </div>

              {/* Current time line */}
              {isToday && nowMins >= 0 && nowMins <= (CALENDAR_END_HOUR - CALENDAR_START_HOUR) * 60 && (
                <div
                  className="absolute left-0 right-0 pointer-events-none"
                  style={{ top: nowY, zIndex: 20 }}
                >
                  <div
                    className="absolute"
                    style={{
                      top: -1,
                      left: 0,
                      right: 0,
                      height: 2,
                      background: "linear-gradient(90deg, #BBA14F, #e4ca80)",
                      boxShadow: "0 0 6px rgba(187,161,79,0.6)",
                    }}
                  />
                  {/* Circle on left */}
                  <div
                    className="absolute"
                    style={{
                      top: -5,
                      left: -5,
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: "#BBA14F",
                      boxShadow: "0 0 8px rgba(187,161,79,0.8)",
                    }}
                  />
                  <span
                    className="absolute text-[9px] font-semibold px-1.5 py-0.5 rounded"
                    style={{
                      left: 6,
                      top: -9,
                      background: "#BBA14F",
                      color: "#fff",
                      fontFamily: "'Poppins', sans-serif",
                    }}
                  >
                    {formatCurrentTime(nowMins)}
                  </span>
                </div>
              )}

              {/* Past shade (for today) */}
              {isToday && nowMins > 0 && (
                <div
                  className="absolute left-0 right-0 pointer-events-none"
                  style={{
                    top: 0,
                    height: Math.min(nowY, TOTAL_SLOTS * SLOT_HEIGHT_PX),
                    background:
                      "repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(255,255,255,0.015) 6px, rgba(255,255,255,0.015) 12px)",
                    zIndex: 7,
                  }}
                />
              )}

              {/* Staff columns */}
              {calendarStaff.map((staff, i) => {
                const colBookings = dayBookings.filter((b) => b.staffId === staff.id);
                const isDropTarget = dragOverCol === staff.id;
                const staffSchedule = schedulesByStaff.get(String(staff.id)) ?? [];

                const bookingLayout = layoutBookingLanes(colBookings);

                return (
                  <div
                    key={staff.id}
                    className="relative shrink-0"
                    style={{
                      width: colW,
                      height: TOTAL_SLOTS * SLOT_HEIGHT_PX,
                      borderRight:
                        i < calendarStaff.length - 1
                          ? "1px solid rgba(92,74,52,0.22)"
                          : "none",
                      background: isDropTarget
                        ? "rgba(187,161,79,0.12)"
                        : CALENDAR_SURFACE.grid,
                      transition: "background 0.15s",
                      zIndex: 5,
                    }}
                    onDragOver={(e) => handleDragOver(e, staff.id)}
                    onDrop={(e) => handleDrop(e, staff.id)}
                    onDragLeave={() => {
                      if (dragOverCol === staff.id) setDragOverCol(null);
                    }}
                  >
                    {/* Quarter-hour hit areas reveal exact time only on hover. */}
                    <div className="absolute inset-0" style={{ zIndex: 6 }}>
                      {timeLabels.map(({ s, mins }) => {
                        const isAvailable =
                          scheduleDataReady && isSlotInsideSchedule(staffSchedule, mins);
                        const isHovered =
                          hoveredTimeSlot?.staffId === staff.id &&
                          hoveredTimeSlot?.slot === s;
                        return (
                          <div
                            key={s}
                            className="absolute left-0 right-0"
                            style={{
                              top: s * SLOT_HEIGHT_PX,
                              height: SLOT_HEIGHT_PX,
                              background: isAvailable ? "transparent" : "rgba(126,77,62,0.105)",
                              cursor: isAvailable ? "default" : "not-allowed",
                            }}
                            onMouseEnter={() => setHoveredTimeSlot({ staffId: staff.id, slot: s })}
                            onMouseLeave={() => setHoveredTimeSlot(null)}
                            onClick={(e) => {
                              if (!isAvailable) e.stopPropagation();
                            }}
                            onPointerDown={(e) => {
                              if (!isAvailable) e.stopPropagation();
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (!isAvailable) {
                                e.dataTransfer.dropEffect = "none";
                                setDragOverCol(null);
                                setDragOverSlot(null);
                                return;
                              }
                              handleDragOver(e, staff.id);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (!isAvailable) {
                                setDragOverCol(null);
                                setDragOverSlot(null);
                                return;
                              }
                              handleDrop(e, staff.id);
                            }}
                          >
                            {isHovered && (
                              <span style={{
                                position: "absolute",
                                top: 2,
                                bottom: 2,
                                left: 4,
                                right: 4,
                                borderRadius: 100,
                                background: isAvailable
                                  ? "rgba(39,39,39,0.58)"
                                  : "rgba(126,77,62,0.64)",
                                color: "#F8F4EC",
                                fontSize: 8,
                                fontWeight: 700,
                                lineHeight: 1.25,
                                letterSpacing: "0.02em",
                                fontFamily: "'Poppins', sans-serif",
                                border: "1px solid rgba(255,255,255,0.16)",
                                boxShadow: "0 2px 7px rgba(39,39,39,0.13)",
                                backdropFilter: "blur(6px)",
                                WebkitBackdropFilter: "blur(6px)",
                                whiteSpace: "nowrap",
                                pointerEvents: "none",
                                zIndex: 15,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}>
                                {formatDisplayTime(minsToTime(s * SLOT_MINS))}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Drop indicator line */}
                    {isDropTarget && dragOverSlot !== null && (() => {
                      const dropMins = dragOverSlot * SLOT_MINS;
                      const isPastDrop = isToday && dropMins < Math.floor(nowMins / SLOT_MINS) * SLOT_MINS;
                      return (
                        <div
                          className="absolute left-0 right-0 pointer-events-none"
                          style={{
                            top: dragOverSlot * SLOT_HEIGHT_PX,
                            height: 2,
                            background: isPastDrop
                              ? "rgba(200,50,50,0.5)"
                              : "rgba(187,161,79,0.7)",
                            zIndex: 25,
                            borderRadius: 2,
                            boxShadow: isPastDrop
                              ? "0 0 6px rgba(200,50,50,0.4)"
                              : "0 0 6px rgba(187,161,79,0.5)",
                          }}
                        />
                      );
                    })()}

                    {bookingLayout.map(({ booking, lane, laneCount }) => (
                      <BookingCard
                        key={booking.calendarId ?? booking.id}
                        booking={booking}
                        isPast={bookingIsPast(booking)}
                        colOffset={lane}
                        colCount={laneCount}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onClick={setSelectedBooking}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        </>)} {/* end calendar view */}

      </div>

      {/* Booking detail modal */}
      {selectedBooking && (
        <BookingModal
          key={selectedBooking.calendarId ?? selectedBooking.id}
          booking={selectedBooking}
          staff={visibleStaff.find((s) => s.id === selectedBooking.staffId)}
          onClose={() => setSelectedBooking(null)}
          onOpenStatusDrawer={(booking) => {
            setSelectedBooking(null);
            setStatusDrawerBooking(booking);
          }}
        />
      )}

      {statusDrawerBooking && (
        <AppointmentCheckoutDrawer
          key={statusDrawerBooking.id}
          booking={statusDrawerBooking}
          staff={visibleStaff.find((s) => s.id === statusDrawerBooking.staffId)}
          allServices={servicesData}
          allStaff={visibleStaff}
          onClose={() => setStatusDrawerBooking(null)}
          onStatusChange={(id, status) => updateStatus.mutate({ id, status })}
          onReschedule={(id, date, time, staffId, reason) => rescheduleFromModal.mutate({ id, date, time, staffId, reason })}
          rescheduleLoading={rescheduleFromModal.isPending}
          onCancel={(id) => cancelAppointment.mutate(id)}
          cancelLoading={cancelAppointment.isPending}
          onDelete={(id) => deleteAppointment.mutate(id)}
          deleteLoading={deleteAppointment.isPending}
        />
      )}

      {/* ── Add Appointment Wizard Modal ── */}
      <Modal
        open={addOpen}
        onCancel={() => { setAddOpen(false); resetWizard(); createAppointment.reset(); addForm.resetFields(); }}
        footer={null}
        title={null}
        closeIcon={false}
        width={640}
        styles={{
          content: {
            background: "#FDFAF5",
            border: "1px solid rgba(187,161,79,0.2)",
            borderRadius: 20,
            padding: 0,
            overflow: "hidden",
            boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
          },
          mask: { backdropFilter: "blur(5px)", background: "rgba(30,24,14,0.55)" },
        }}
        destroyOnClose
      >
        {/* Dark luxury banner header */}
        <div style={{
          position: "relative",
          background: "linear-gradient(145deg, #1a1308 0%, #0d0a04 100%)",
          padding: "22px 28px 20px",
          overflow: "hidden",
        }}>
          {/* Dot grid texture */}
          <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(187,161,79,0.12) 1px, transparent 1px)", backgroundSize: "16px 16px", pointerEvents: "none" }} />
          {/* Gold glow */}
          <div style={{ position: "absolute", top: -40, left: "50%", transform: "translateX(-50%)", width: 200, height: 80, background: "radial-gradient(ellipse,rgba(187,161,79,0.25),transparent 70%)", pointerEvents: "none" }} />

          <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12,
                background: "linear-gradient(135deg,#BBA14F,#987554)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 4px 16px rgba(187,161,79,0.4)", flexShrink: 0,
              }}>
                <FiCalendar size={18} color="#fff" />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 8, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(187,161,79,0.65)", fontFamily: "'Poppins',sans-serif" }}>
                  {["Select Client", "Build Service Order", "Choose Options", "Anchor Date & Time", "Choose Providers", "Review Walk-in"][wizStep]}
                </p>
                <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#FDFAF5", fontFamily: "'Playfair Display',serif", lineHeight: 1.25 }}>
                  New Walk-in Appointment
                </p>
              </div>
            </div>
            <button
              onClick={() => { setAddOpen(false); resetWizard(); createAppointment.reset(); addForm.resetFields(); }}
              style={{
                width: 32, height: 32, borderRadius: "50%",
                background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.6)", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
            >
              <FiX size={15} />
            </button>
          </div>

          {/* Step indicator */}
          <div style={{ position: "relative", marginTop: 6 }}>
            <WizardSteps current={wizStep} />
          </div>
        </div>

        {/* Step body (scrollable) */}
        <div style={{
          overflowY: "auto",
          overflowX: "hidden",
          paddingTop: 20,
          maxHeight: wizStep >= 3
            ? "min(72vh, calc(100vh - 230px))"
            : "calc(100vh - 360px)",
        }}>
          {wizStep === 0 && (
            <StepClient
              clientMode={clientMode}
              setClientMode={setClientMode}
              selectedClient={selectedClient}
              setSelectedClient={setSelectedClient}
              walkIn={walkIn}
              setWalkIn={setWalkIn}
            />
          )}
          {wizStep === 1 && (
            <StepServices
              servicesData={servicesData}
              categoriesData={categoriesData}
              selectedServices={selectedServices}
              setSelectedServices={setSelectedServices}
            />
          )}
          {wizStep === 2 && (
            <StepServiceOptions
              selectedServices={selectedServices}
              selectedServiceOptions={selectedServiceOptions}
              setSelectedServiceOptions={setSelectedServiceOptions}
            />
          )}
          {wizStep === 3 && (
            <StepDateTime
              selectedDate={wizDate}
              setSelectedDate={setWizDate}
              selectedTime={wizTime}
              setSelectedTime={setWizTime}
              blockedDateSet={blockedDateSet}
              checkingAvailability={shouldFetchServiceAvailability && isFetchingServiceAvailability}
              availabilityError={serviceAvailabilityError}
              hasAvailableStaff={
                shouldFetchServiceAvailability && !isFetchingServiceAvailability && !serviceAvailabilityError
                  ? serviceWindowsAvailable
                  : null
              }
            />
          )}
          {wizStep === 4 && (
            <StepStaff
              selectedServices={selectedServices}
              selectedServiceOptions={selectedServiceOptions}
              staffPerService={staffPerService}
              setStaffPerService={setStaffPerService}
              serviceAvailabilityMap={serviceAvailabilityMap}
              isLoadingAvailability={isFetchingServiceAvailability}
              availabilityError={serviceAvailabilityError}
              onRetryAvailability={refetchServiceAvailability}
              recommendations={staffRecommendations}
              recommendingServiceId={recommendingServiceId}
              onRecommend={recommendStaffForService}
            />
          )}
          {wizStep === 5 && (
            <StepConfirm
              clientMode={clientMode}
              selectedClient={selectedClient}
              walkIn={walkIn}
              selectedServices={selectedServices}
              selectedServiceOptions={selectedServiceOptions}
              staffPerService={staffPerService}
              serviceAvailabilityMap={serviceAvailabilityMap}
              recommendations={staffRecommendations}
              bookingDate={wizDate}
              bookingTime={wizTime}
            />
          )}
        </div>

        {/* Footer nav */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 28px 22px",
          borderTop: "1px solid rgba(187,161,79,0.12)",
          background: "#FDFAF5",
          gap: 10,
        }}>
          {/* Back */}
          <button
            onClick={() => setWizStep((s) => s - 1)}
            disabled={wizStep === 0}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "9px 20px", borderRadius: 10,
              border: "1.5px solid #e0d5c5", background: "#fff",
              color: wizStep === 0 ? "#ccc" : "#987554",
              fontFamily: "'Poppins',sans-serif", fontSize: 13, fontWeight: 600,
              cursor: wizStep === 0 ? "not-allowed" : "pointer",
              transition: "border-color 0.15s",
            }}
            onMouseEnter={(e) => { if (wizStep > 0) e.currentTarget.style.borderColor = "#BBA14F"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e0d5c5"; }}
          >
            <FiArrowLeft size={14} /> Back
          </button>

          {/* Step hint */}
          <span style={{ fontSize: 10, color: "rgba(152,117,84,0.55)", fontFamily: "'Poppins',sans-serif" }}>
            Step {wizStep + 1} of 6
          </span>

          {/* Next / Book */}
          {wizStep < 5 ? (
            <button
              onClick={() => setWizStep((s) => s + 1)}
              disabled={!wizStepValid}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "9px 24px", borderRadius: 10, border: "none",
                background: wizStepValid
                  ? "linear-gradient(135deg,#BBA14F,#987554)"
                  : "rgba(187,161,79,0.35)",
                color: "#fff",
                fontFamily: "'Poppins',sans-serif", fontSize: 13, fontWeight: 700,
                cursor: wizStepValid ? "pointer" : "not-allowed",
                boxShadow: wizStepValid ? "0 4px 14px rgba(187,161,79,0.4)" : "none",
                transition: "opacity 0.15s",
              }}
              onMouseEnter={(e) => { if (wizStepValid) e.currentTarget.style.opacity = "0.88"; }}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              {wizStep === 1
                ? "Choose Options"
                : wizStep === 2
                ? "Pick Date & Time"
                : wizStep === 3
                ? "Choose Providers"
                : "Continue"}
              <FiArrowRight size={14} />
            </button>
          ) : (
            <button
              onClick={async () => {
                if (!staffSelectionsValid) {
                  message.error("Review each service window and choose an eligible provider before booking.");
                  setWizStep(4);
                  return;
                }
                try {
                  const services = selectedServices.map((service) => ({
                    service_id: service.id,
                    ...(selectedServiceOptions[service.id]
                      ? { service_option_id: Number(selectedServiceOptions[service.id]) }
                      : {}),
                    staff_id: staffPerService[service.id],
                  }));
                  const payload = buildWalkInAppointmentPayload({
                    customerId: clientMode === "existing" ? selectedClient?.id : null,
                    guest: {
                      full_name: walkIn.name,
                      phone_number: walkIn.phone,
                      email: walkIn.email,
                    },
                    appointmentDate: wizDate.format("YYYY-MM-DD"),
                    startTime: `${wizTime}:00`,
                    services,
                  });
                  createAppointment.mutate(payload);
                } catch (error) {
                  message.error(error.message);
                  setWizStep(4);
                }
              }}
              disabled={createAppointment.isPending || !staffSelectionsValid}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "10px 26px", borderRadius: 10, border: "none",
                background: createAppointment.isPending || !staffSelectionsValid
                  ? "rgba(187,161,79,0.5)"
                  : "linear-gradient(135deg,#BBA14F,#987554)",
                color: "#fff",
                fontFamily: "'Poppins',sans-serif", fontSize: 13, fontWeight: 700,
                cursor: createAppointment.isPending || !staffSelectionsValid ? "not-allowed" : "pointer",
                boxShadow: createAppointment.isPending || !staffSelectionsValid ? "none" : "0 4px 14px rgba(187,161,79,0.4)",
                transition: "opacity 0.15s",
              }}
              onMouseEnter={(e) => { if (!createAppointment.isPending && staffSelectionsValid) e.currentTarget.style.opacity = "0.88"; }}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              <FiCheckCircle size={15} />
              {createAppointment.isPending ? "Booking…" : "✦ Book Walk-in"}
            </button>
          )}
        </div>
      </Modal>

      {/* ── Waitlist fallback prompt ── */}
      {/* Shown when createAppointment fails with a waitlist-eligible error */}
      <Modal
        open={!!waitlistPrompt}
        onCancel={() => { setWaitlistPrompt(null); setWaitlistDate(null); setWaitlistStaffPerService({}); }}
        footer={null}
        width={420}
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "'Playfair Display', serif", color: "#272727", fontSize: 16 }}>
            <FiCreditCard size={16} color="#D4A847" />
            Slot Unavailable — Join Waitlist?
          </div>
        }
        style={{ top: 80 }}
      >
        <div style={{ fontFamily: "'Poppins', sans-serif" }}>
          {/* Error reason */}
          <div style={{
            padding: "10px 14px", borderRadius: 9, marginBottom: 18,
            background: "rgba(212,168,71,0.09)", border: "1px solid rgba(212,168,71,0.3)",
          }}>
            <p style={{ margin: 0, fontSize: 12, color: "#8a7030" }}>
              <FiAlertCircle size={12} style={{ marginRight: 5, verticalAlign: "middle" }} />
              {waitlistPrompt?.errorMsg || "This time slot is not directly bookable."}
            </p>
          </div>

          <p style={{ margin: "0 0 14px", fontSize: 13, color: "#272727" }}>
            Would you like to add this customer to the waitlist instead? They will be notified when a slot opens.
          </p>

          {/* Per-service staff selection — staff_id is required on every service */}
          {(waitlistPrompt?.payload?.services || []).length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#987554", display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Assign Staff per Service <span style={{ color: "#c43232" }}>*</span>
              </label>
              {(waitlistPrompt?.payload?.services || []).map((svc) => {
                const svcObj = selectedServices.find((s) => s.id === svc.service_id);
                const svcName = svcObj?.name || `Service #${svc.service_id}`;
                const assignedIds = svcObj?.assigned_staff_ids ?? svcObj?.staff_ids ?? [];
                const eligibleStaff = assignedIds.length
                  ? visibleStaff.filter((s) =>
                      assignedIds.some((id) => String(id) === String(s.id) || String(id) === String(s.user) || String(id) === String(s.user_id))
                    )
                  : visibleStaff;
                const displayStaff = eligibleStaff.length ? eligibleStaff : visibleStaff;
                return (
                  <div key={svc.service_id} style={{ marginBottom: 10 }}>
                    <p style={{ margin: "0 0 4px", fontSize: 11, color: "#272727", fontFamily: "'Poppins', sans-serif", fontWeight: 600 }}>
                      {svcName}
                    </p>
                    <Select
                      style={{ width: "100%" }}
                      placeholder="Select staff member…"
                      value={waitlistStaffPerService[svc.service_id] || undefined}
                      onChange={(val) =>
                        setWaitlistStaffPerService((prev) => ({ ...prev, [svc.service_id]: val }))
                      }
                      options={displayStaff.map((s) => ({
                        value: s.id,
                        label: s.full_name || s.name || `Staff #${s.id}`,
                      }))}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {/* Waitlist date picker */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#987554", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Waitlist Date <span style={{ color: "#c43232" }}>*</span>
            </label>
            <DatePicker
              value={waitlistDate}
              onChange={setWaitlistDate}
              format="YYYY-MM-DD"
              disabledDate={(d) => d && d < dayjs().startOf("day")}
              placeholder="Date customer is available"
              style={{ width: "100%" }}
            />
            <p style={{ margin: "5px 0 0", fontSize: 10, color: "rgba(152,117,84,0.7)" }}>
              The date you want the customer promoted if a slot opens.
            </p>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => { setWaitlistPrompt(null); setWaitlistDate(null); setWaitlistStaffPerService({}); }}
              style={{
                flex: 1, padding: "10px 0", borderRadius: 9,
                border: "1px solid rgba(187,161,79,0.25)",
                background: "#FDFAF5", color: "#987554",
                fontSize: 12, fontWeight: 600, fontFamily: "'Poppins', sans-serif",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              disabled={!waitlistDate || createWaitlist.isPending ||
                !(waitlistPrompt?.payload?.services || []).every((s) => waitlistStaffPerService[s.service_id])
              }
              onClick={() => {
                if (!waitlistDate || !waitlistPrompt) return;
                const base = waitlistPrompt.payload;
                // Rebuild services with confirmed staff_id from waitlistStaffPerService
                const correctedServices = (base.services || []).map((s) => ({
                  service_id: s.service_id,
                  ...(s.service_option_id ? { service_option_id: s.service_option_id } : {}),
                  staff_id:   waitlistStaffPerService[s.service_id],
                }));
                createWaitlist.mutate({
                  ...base,
                  services:     correctedServices,
                  waitlist_date: waitlistDate.format("YYYY-MM-DD"),
                  reason:        "staff_fully_booked",
                });
              }}
              style={{
                flex: 2, padding: "10px 0", borderRadius: 9, border: "none",
                background: (!waitlistDate || createWaitlist.isPending)
                  ? "rgba(187,161,79,0.45)"
                  : "linear-gradient(135deg,#BBA14F,#987554)",
                color: "#fff", fontSize: 12, fontWeight: 700,
                fontFamily: "'Poppins', sans-serif",
                cursor: (!waitlistDate || createWaitlist.isPending) ? "not-allowed" : "pointer",
                boxShadow: (!waitlistDate || createWaitlist.isPending) ? "none" : "0 4px 14px rgba(187,161,79,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              }}
            >
              <FiList size={13} />
              {createWaitlist.isPending ? "Adding…" : "Add to Waitlist"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
