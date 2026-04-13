import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal, Form, Input, Select, DatePicker, TimePicker, message, Tooltip, Spin } from "antd";
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
  FiTrash2,
  FiAlertCircle,
  FiDollarSign,
  FiCheckCircle,
  FiSlash,
} from "react-icons/fi";
import _axios from "../src/api/_axios";
import { fetchBlockedDays } from "../src/api/blockedDays";

/* ─────────────────────────────────────────────
   CONSTANTS & HELPERS
───────────────────────────────────────────── */
const HOUR_START = 8;          // 08:00
const HOUR_END   = 20;         // 20:00
const SLOT_MINS  = 15;         // granularity
const TOTAL_SLOTS = ((HOUR_END - HOUR_START) * 60) / SLOT_MINS; // 48
const SLOT_HEIGHT_PX = 64;     // height of each 15-min row
const COLUMN_W = 220;          // px width per person column

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

/** Convert "HH:MM" → minutes from HOUR_START */
function timeToMins(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  return (h - HOUR_START) * 60 + m;
}

/** Minutes from HOUR_START → "HH:MM" */
function minsToTime(mins) {
  const total = mins + HOUR_START * 60;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Pixel Y offset from top of grid */
function minsToY(mins) {
  const slot = mins / SLOT_MINS;
  return slot * SLOT_HEIGHT_PX;
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

/* ─────────────────────────────────────────────
   STATUS CONFIG
───────────────────────────────────────────── */
const STATUS_CFG = {
  confirmed:    { label: "Confirmed",    border: "#D4A847", dot: "#BBA14F"  },
  "in-progress":{ label: "In Progress", border: "#5282FF", dot: "#5282ff"  },
  in_progress:  { label: "In Progress", border: "#5282FF", dot: "#5282ff"  },
  pending:      { label: "Pending",      border: "#F0A830", dot: "#f5b43c"  },
  completed:    { label: "Completed",    border: "#2EAA60", dot: "#22a050"  },
};

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
  const steps = ["Client", "Services", "Staff", "Date & Time", "Confirm"];
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
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data: customersRaw, isFetching } = useQuery({
    queryKey: ["customers-search", debouncedSearch],
    queryFn: () =>
      _axios
        .get("/api/portal/v1/accounts/customers/", { params: debouncedSearch ? { search: debouncedSearch } : {} })
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
            ) : customers.length === 0 ? (
              <div style={{ textAlign: "center", padding: "28px 0", color: "#aaa", fontSize: 13, fontFamily: "'Poppins',sans-serif" }}>
                {search ? `No clients found for "${search}"` : "No clients yet"}
              </div>
            ) : (
              customers.map((c) => {
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
              style={WZ.inputBase}
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
              style={WZ.inputBase}
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
              style={WZ.inputBase}
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
    return amt > 0 ? `GH₵ ${amt.toFixed(2)}` : "Free";
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
    setSelectedServices((prev) =>
      isSelected(svc.id)
        ? prev.filter((s) => s.id !== svc.id)
        : [...prev, { ...svc, _price: priceOf(svc), _amount: parseFloat(svc.price || svc.amount || 0) }]
    );
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
                      {svc.duration && <p style={{ margin: 0, fontSize: 11, color: "#987554", fontFamily: "'Poppins',sans-serif" }}>{svc.duration} min</p>}
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

      {/* Selected summary */}
      {selectedServices.length > 0 && (
        <div style={{ padding: "10px 14px", background: "rgba(187,161,79,0.08)", borderRadius: 10, border: "1px solid rgba(187,161,79,0.25)" }}>
          <p style={{ margin: 0, fontSize: 11, fontFamily: "'Poppins',sans-serif", color: "#987554" }}>
            <strong style={{ color: "#BBA14F" }}>{selectedServices.length}</strong> service{selectedServices.length !== 1 ? "s" : ""} selected
            {" · "}
            <strong style={{ color: "#BBA14F" }}>
              {selectedServices.every((s) => s._amount === 0)
                ? "Free"
                : `GH₵ ${selectedServices.reduce((a, s) => a + s._amount, 0).toFixed(2)}`}
            </strong>
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Step 3: Staff ── */
function StepStaff({ staffList, selectedServices, staffPerService, setStaffPerService }) {
  // staffPerService: { [serviceId]: staffId | "any" }
  const ANY = "any";

  const isAssigned = (staff, svcId) => {
    if (!staff.service_ids && !staff.services) return true; // no restriction info → show without warning
    const ids = staff.service_ids || staff.services || [];
    return ids.includes(svcId) || ids.includes(String(svcId));
  };

  const setStaff = (svcId, staffId) => {
    setStaffPerService((prev) => ({ ...prev, [svcId]: staffId }));
  };

  const current = (svcId) => staffPerService[svcId] || ANY;

  return (
    <div style={{ padding: "0 28px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
      {selectedServices.map((svc) => {
        const cur = current(svc.id);
        return (
          <div key={svc.id}>
            <p style={{ ...WZ.sectionLabel, marginBottom: 10 }}>
              <FiScissors size={10} style={{ marginRight: 5 }} />{svc.name}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {/* Any Team Member */}
              <button
                onClick={() => setStaff(svc.id, ANY)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 14px", borderRadius: 12, cursor: "pointer",
                  border: `1.5px solid ${cur === ANY ? "#BBA14F" : "#ede8de"}`,
                  background: cur === ANY ? "linear-gradient(135deg,rgba(187,161,79,0.1),rgba(152,117,84,0.07))" : "#faf8f4",
                  transition: "all 0.15s", textAlign: "left",
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: cur === ANY ? "linear-gradient(135deg,#BBA14F,#987554)" : "rgba(187,161,79,0.12)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  <FiUsers size={15} color={cur === ANY ? "#fff" : "#BBA14F"} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#272727", fontFamily: "'Poppins',sans-serif" }}>Any Team Member</p>
                  <p style={{ margin: 0, fontSize: 11, color: "#987554", fontFamily: "'Poppins',sans-serif" }}>Assign automatically</p>
                </div>
                {cur === ANY && (
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#BBA14F", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <FiCheck size={12} color="#fff" />
                  </div>
                )}
              </button>

              {/* Staff members */}
              {staffList.map((s) => {
                const [from, to] = avatarGradient(s.full_name);
                const assigned = isAssigned(s, svc.id);
                const sel = cur === s.id;
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
                      opacity: !assigned ? 0.75 : 1,
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
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#272727", fontFamily: "'Poppins',sans-serif", lineHeight: 1.25 }}>{s.full_name}</p>
                      <p style={{ margin: 0, fontSize: 11, color: "#987554", fontFamily: "'Poppins',sans-serif" }}>{s.role}</p>
                    </div>
                    {!assigned && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
                        color: "#e05050", background: "rgba(224,80,80,0.1)", border: "1px solid rgba(224,80,80,0.25)",
                        borderRadius: 100, padding: "3px 8px", fontFamily: "'Poppins',sans-serif", flexShrink: 0,
                      }}>
                        <FiAlertCircle size={9} style={{ marginRight: 3 }} />Doesn't provide this service
                      </span>
                    )}
                    {sel && (
                      <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#BBA14F", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <FiCheck size={12} color="#fff" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Step 4: Date & Time ── */
function StepDateTime({ selectedDate, setSelectedDate, selectedTime, setSelectedTime, blockedDateSet = new Set() }) {
  const today = dayjs().startOf("day");

  // Build time slots 08:00–20:00 every 15 min
  const slots = [];
  for (let h = HOUR_START; h < HOUR_END; h++) {
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
      </div>
    </div>
  );
}

/* ── Step 5: Confirm ── */
function StepConfirm({ clientMode, selectedClient, walkIn, selectedServices, staffPerService, staffList, bookingDate, bookingTime }) {
  const staffName = (svcId) => {
    const id = staffPerService[svcId];
    if (!id || id === "any") return "Any Team Member";
    const s = staffList.find((x) => x.id === id);
    return s?.full_name || "Team Member";
  };

  const clientDisplay = clientMode === "existing"
    ? [selectedClient?.first_name, selectedClient?.last_name].filter(Boolean).join(" ") ||
      selectedClient?.full_name || "Client"
    : walkIn.name;

  const total = selectedServices.reduce((a, s) => a + s._amount, 0);
  const allFree = selectedServices.every((s) => s._amount === 0);

  const timeDisplay = (() => {
    if (!bookingTime) return "—";
    const [h, m] = bookingTime.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
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

      <p style={WZ.sectionLabel}>Services</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {selectedServices.map((svc) => (
          <div key={svc.id} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "10px 14px", borderRadius: 12,
            background: "#faf8f4", border: "1px solid rgba(187,161,79,0.18)",
          }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,rgba(187,161,79,0.15),rgba(152,117,84,0.1))", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <FiScissors size={13} color="#BBA14F" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#272727", fontFamily: "'Poppins',sans-serif", lineHeight: 1.25 }}>{svc.name}</p>
              <p style={{ margin: 0, fontSize: 11, color: "#987554", fontFamily: "'Poppins',sans-serif" }}>
                <FiUsers size={10} style={{ marginRight: 4 }} />{staffName(svc.id)}
              </p>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#BBA14F", fontFamily: "'Poppins',sans-serif", flexShrink: 0 }}>{svc._price}</span>
          </div>
        ))}
      </div>

      {/* Total */}
      <div style={{ padding: "12px 16px", borderRadius: 12, background: "linear-gradient(135deg,rgba(187,161,79,0.15),rgba(152,117,84,0.1))", border: "1px solid rgba(187,161,79,0.3)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#987554", fontFamily: "'Poppins',sans-serif", textTransform: "uppercase", letterSpacing: "0.06em" }}>Total Amount</span>
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
   On hover it reveals a rich info overlay showing all booking details.
───────────────────────────────────────────── */
function BookingCard({ booking, isPast, colOffset, colCount, onDragStart, onDragEnd, onClick }) {
  /* ── Geometry ── */
  const startMins = timeToMins(booking.startTime);
  const topPx     = minsToY(startMins);
  const heightPx  = Math.max(
    (booking.durationMins / SLOT_MINS) * SLOT_HEIGHT_PX - 4,
    SLOT_HEIGHT_PX - 4
  );

  /* ── Status colour config ── */
  const cfg = STATUS_CFG[booking.status] || STATUS_CFG.pending;

  /* ── Column splitting (for overlapping bookings on same staff column) ── */
  const slotW    = 100 / colCount;
  const leftPct  = colOffset * slotW;
  const rightPct = 100 - (colOffset + 1) * slotW;

  /* ── Hover state that toggles the info overlay ── */
  const [hovered, setHovered] = useState(false);

  /* ── Derive enriched data from booking.raw (full API response) ── */
  const raw = booking.raw || {};

  // Collect all services from raw — supports both single and multi-service bookings
  const rawServices = Array.isArray(raw.services) && raw.services.length > 0
    ? raw.services                              // new multi-service shape
    : raw.service_name                          // legacy single-service fallback
      ? [{ service_name: raw.service_name, staff_name: raw.staff_name }]
      : [];

  // Resolve staff display name — check multiple possible API field names
  const staffDisplay =
    raw.staff_full_name ||
    raw.staff_name      ||
    raw.assigned_staff  ||
    booking.staffName   ||
    null;

  // Calculate end time from start + duration
  const endMins   = startMins + booking.durationMins;
  const endTime   = `${String(Math.floor(endMins / 60)).padStart(2, "0")}:${String(endMins % 60).padStart(2, "0")}`;

  // Format duration as "1h 30m" or "45m"
  const durLabel  = booking.durationMins >= 60
    ? `${Math.floor(booking.durationMins / 60)}h${booking.durationMins % 60 ? ` ${booking.durationMins % 60}m` : ""}`
    : `${booking.durationMins}m`;

  return (
    <div
      draggable={!isPast}
      onDragStart={(e) => !isPast && onDragStart(e, booking)}
      onDragEnd={onDragEnd}
      onClick={() => onClick(booking)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "absolute",
        top:    topPx + 2,
        left:   `calc(${leftPct}% + 4px)`,
        right:  `calc(${rightPct}% + 4px)`,
        height: heightPx,
        /* Lift hovered card above neighbours */
        zIndex: hovered ? 40 : 10,
        borderRadius: 10,
        overflow: "visible",           // allow overlay to spill beyond card height
        cursor: isPast ? "not-allowed" : "grab",
        /* Pure black card */
        background: isPast
          ? "#1c1c1c"
          : "linear-gradient(170deg, #1e1e1e 0%, #141414 60%, #0d0d0d 100%)",
        boxShadow: isPast
          ? "none"
          : hovered
            ? "0 8px 32px rgba(0,0,0,0.9), inset 0 1px 0 rgba(187,161,79,0.4)"
            : "0 4px 18px rgba(0,0,0,0.7), inset 0 1px 0 rgba(187,161,79,0.25)",
        border: isPast
          ? "1px solid rgba(255,255,255,0.07)"
          : hovered
            ? "1px solid rgba(187,161,79,0.8)"
            : "1px solid rgba(187,161,79,0.45)",
        userSelect: "none",
        opacity: isPast ? 0.6 : 1,
        transition: "box-shadow 0.18s ease, border-color 0.18s ease, z-index 0s",
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
        flexDirection: "column",
        justifyContent: "center",
        height: "100%",
        paddingTop: 7,
        paddingBottom: 6,
        paddingLeft: 10,
        paddingRight: 8,
        gap: 3,
        /* Fade out content when overlay is shown so it doesn't bleed through */
        opacity: hovered ? 0 : 1,
        transition: "opacity 0.15s ease",
      }}>

        {/* Status badge row */}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{
            width: 6, height: 6,
            borderRadius: "50%",
            background: isPast ? "#aaa" : cfg.dot,
            display: "inline-block",
            flexShrink: 0,
          }} />
          <span style={{
            fontSize: 10,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "#FFFFFF",
            fontFamily: "'Poppins', sans-serif",
            textShadow: "0 1px 4px rgba(0,0,0,0.8)",
          }}>
            {cfg.label}
          </span>
        </div>

        {/* Client name */}
        <p style={{
          margin: 0,
          fontSize: 14,
          fontWeight: 800,
          color: "#FFFFFF",
          fontFamily: "'Poppins', sans-serif",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          lineHeight: 1.2,
          textShadow: "0 1px 6px rgba(0,0,0,0.9)",
        }}>
          {booking.client}
        </p>

        {/* Service name — only when card is tall enough */}
        {heightPx > 72 && (
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
        {heightPx > 100 && (
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

      {/* ── Hover info overlay — rich booking details panel ── */}
      {hovered && (
        <div
          /* Stop hover events from leaking to grid so the overlay stays open */
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            position: "absolute",
            /* Anchor to top of card; min height covers the card itself */
            top: 0,
            left: 0,
            right: 0,
            minHeight: Math.max(heightPx, 160),
            zIndex: 50,
            borderRadius: 10,
            background: "linear-gradient(160deg, #1a1308 0%, #100d05 60%, #0b0800 100%)",
            border: "1.5px solid rgba(187,161,79,0.65)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.95), inset 0 1px 0 rgba(187,161,79,0.3)",
            padding: "10px 12px 12px",
            pointerEvents: "none",             // overlay is read-only; clicks fall to card below
            display: "flex",
            flexDirection: "column",
            gap: 7,
          }}
        >
          {/* Gold top accent bar on overlay */}
          <div style={{
            position: "absolute",
            top: 0, left: 0, right: 0,
            height: 3,
            borderRadius: "10px 10px 0 0",
            background: "linear-gradient(90deg, #BBA14F, #e4ca80)",
          }} />

          {/* ── Client row ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 4 }}>
            <FiUser size={12} color="#BBA14F" style={{ flexShrink: 0 }} />
            <span style={{
              fontSize: 13,
              fontWeight: 800,
              color: "#FDFAF5",
              fontFamily: "'Poppins', sans-serif",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}>
              {booking.client}
            </span>
          </div>

          {/* ── Status badge ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{
              width: 7, height: 7,
              borderRadius: "50%",
              background: cfg.dot,
              display: "inline-block",
              flexShrink: 0,
            }} />
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: cfg.dot,
              fontFamily: "'Poppins', sans-serif",
            }}>
              {cfg.label}
            </span>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "rgba(187,161,79,0.2)", margin: "0 0 1px" }} />

          {/* ── Services list (supports multiple services) ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {rawServices.length > 0 ? rawServices.map((svc, idx) => (
              <div key={idx} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {/* Service name */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <FiScissors size={11} color="#BBA14F" style={{ flexShrink: 0 }} />
                  <span style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#FDFAF5",
                    fontFamily: "'Poppins', sans-serif",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}>
                    {svc.service_name || svc.name || booking.service}
                  </span>
                </div>
                {/* Per-service staff if present */}
                {svc.staff_name && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, paddingLeft: 17 }}>
                    <FiUsers size={10} color="rgba(187,161,79,0.6)" style={{ flexShrink: 0 }} />
                    <span style={{
                      fontSize: 11,
                      color: "rgba(253,250,245,0.65)",
                      fontFamily: "'Poppins', sans-serif",
                    }}>
                      {svc.staff_name}
                    </span>
                  </div>
                )}
              </div>
            )) : (
              /* Fallback: single service from booking object */
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <FiScissors size={11} color="#BBA14F" style={{ flexShrink: 0 }} />
                <span style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#FDFAF5",
                  fontFamily: "'Poppins', sans-serif",
                }}>
                  {booking.service || "—"}
                </span>
              </div>
            )}
          </div>

          {/* ── Assigned staff (top-level) — shown when not per-service ── */}
          {staffDisplay && rawServices.every(s => !s.staff_name) && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <FiUsers size={11} color="#BBA14F" style={{ flexShrink: 0 }} />
              <span style={{
                fontSize: 12,
                color: "rgba(253,250,245,0.8)",
                fontFamily: "'Poppins', sans-serif",
              }}>
                {staffDisplay}
              </span>
            </div>
          )}

          {/* Divider */}
          <div style={{ height: 1, background: "rgba(187,161,79,0.2)" }} />

          {/* ── Time & duration row ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <FiClock size={11} color="#BBA14F" style={{ flexShrink: 0 }} />
            <span style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#FDFAF5",
              fontFamily: "'Poppins', sans-serif",
            }}>
              {formatDisplayTime(booking.startTime)}
              <span style={{ color: "rgba(187,161,79,0.7)", margin: "0 4px" }}>→</span>
              {formatDisplayTime(endTime)}
            </span>
            <span style={{
              marginLeft: "auto",
              fontSize: 11,
              color: "rgba(253,250,245,0.5)",
              fontFamily: "'Poppins', sans-serif",
              whiteSpace: "nowrap",
            }}>
              {durLabel}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   BOOKING DETAIL MODAL
───────────────────────────────────────────── */
function BookingModal({ booking, staff, onClose, onDelete, deleteLoading }) {
  if (!booking) return null;
  const cfg = STATUS_CFG[booking.status] || STATUS_CFG.pending;
  const [from, to] = avatarGradient(staff?.full_name || "");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(30,24,14,0.55)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="relative rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl"
        style={{
          background: "#FDFAF5",
          border: "1px solid rgba(187,161,79,0.25)",
          animation: "fadeInUp 0.2s ease both",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* gold top bar */}
        <div
          className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
          style={{ background: "linear-gradient(90deg, #BBA14F, #c9ae5e)" }}
        />

        {/* close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center text-sm transition hover:bg-black/5"
          style={{ color: "#987554" }}
        >
          ✕
        </button>

        {/* staff avatar */}
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white"
            style={{
              background: `linear-gradient(135deg, ${from}, ${to})`,
              fontSize: 16,
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            {initials(staff?.full_name)}
          </div>
          <div>
            <p
              className="text-sm font-semibold text-[#272727]"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              {staff?.full_name}
            </p>
            <p className="text-xs text-[#987554]" style={{ fontFamily: "'Poppins', sans-serif" }}>
              {staff?.role}
            </p>
          </div>
        </div>

        {/* booking details */}
        <h3
          className="text-lg font-bold text-[#272727] mb-4"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          {booking.service}
        </h3>

        <div className="space-y-3">
          <DetailRow icon={<FiUser size={13} />} label="Client" value={booking.client} />
          <DetailRow icon={<FiClock size={13} />} label="Start" value={formatDisplayTime(booking.startTime)} />
          <DetailRow
            icon={<FiScissors size={13} />}
            label="Duration"
            value={
              booking.durationMins >= 60
                ? `${Math.floor(booking.durationMins / 60)}h${booking.durationMins % 60 ? ` ${booking.durationMins % 60}m` : ""}`
                : `${booking.durationMins}m`
            }
          />
          <DetailRow
            icon={<span className="w-2 h-2 rounded-full" style={{ background: cfg.dot, display: "inline-block" }} />}
            label="Status"
            value={
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
              >
                {cfg.label}
              </span>
            }
          />
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
          {onDelete && (
            <button
              onClick={() => onDelete(booking.id)}
              disabled={deleteLoading}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition hover:opacity-90"
              style={{
                background: deleteLoading ? "rgba(200,50,50,0.3)" : "rgba(200,50,50,0.12)",
                border: "1px solid rgba(200,50,50,0.35)",
                color: "#e05050",
                fontFamily: "'Poppins', sans-serif",
                cursor: deleteLoading ? "not-allowed" : "pointer",
              }}
            >
              {deleteLoading ? "Deleting…" : "Delete"}
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
            style={{
              background: "linear-gradient(135deg, #BBA14F, #987554)",
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            Close
          </button>
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
        style={{ fontFamily: "'Poppins', sans-serif" }}
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
        <div style={{ flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,0.07)", background: "#0d0d0d" }}>
          {/* Search */}
          <div style={{ padding: "12px 14px 10px" }}>
            <div
              style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: 10, padding: "8px 12px",
              }}
              onFocusCapture={(e) => (e.currentTarget.style.borderColor = "rgba(187,161,79,0.5)")}
              onBlurCapture={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)")}
            >
              <FiUser size={12} style={{ color: "rgba(187,161,79,0.6)", flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Search staff, client or service..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 12, color: "#FFFFFF", fontFamily: "'Poppins', sans-serif", caretColor: "#BBA14F" }}
              />
              {search && (
                <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: 0, fontSize: 13 }}>✕</button>
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
                background: activeStaff === null ? "linear-gradient(135deg, #BBA14F, #987554)" : "rgba(255,255,255,0.06)",
                color: activeStaff === null ? "#FFFFFF" : "rgba(255,255,255,0.55)",
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
                    background: isActive ? "linear-gradient(135deg, #BBA14F, #987554)" : "rgba(255,255,255,0.06)",
                    color: isActive ? "#FFFFFF" : "rgba(255,255,255,0.55)",
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
          borderRight: "1px solid rgba(255,255,255,0.07)",
          background: "#0d0d0d",
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
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: 10,
              padding: "8px 12px",
              transition: "border-color 0.2s",
            }}
            onFocusCapture={(e) => (e.currentTarget.style.borderColor = "rgba(187,161,79,0.5)")}
            onBlurCapture={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)")}
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
                color: "#FFFFFF",
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
                  color: "rgba(255,255,255,0.3)",
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
              <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: activeStaff === null ? "#FFFFFF" : "rgba(255,255,255,0.55)", fontFamily: "'Poppins', sans-serif" }}>
                All Staff
              </p>
              <p style={{ margin: 0, fontSize: 9, color: "rgba(187,161,79,0.65)", fontFamily: "'Poppins', sans-serif" }}>
                {dayBookings.length} appointments
              </p>
            </div>
          </button>
        </div>

        {/* Divider label */}
        <p style={{ margin: "4px 14px 6px", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.2)", fontFamily: "'Poppins', sans-serif" }}>
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
            if (!hasBookings && !nameMatch) return null;
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
                    color: isActive ? "#FFFFFF" : "rgba(255,255,255,0.6)",
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
                      color: isActive ? "#BBA14F" : "rgba(255,255,255,0.3)",
                      background: isActive ? "rgba(187,161,79,0.15)" : "rgba(255,255,255,0.06)",
                      border: `1px solid ${isActive ? "rgba(187,161,79,0.3)" : "rgba(255,255,255,0.08)"}`,
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
              color: "rgba(255,255,255,0.18)",
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
                        boxShadow: `0 0 0 3px rgba(0,0,0,0.8), 0 0 0 5px ${from}44`,
                        flexShrink: 0,
                      }}
                    >
                      {initials(s.full_name)}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#FFFFFF", fontFamily: "'Poppins', sans-serif", lineHeight: 1.2 }}>
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
                      const cfg = STATUS_CFG[booking.status] || STATUS_CFG.pending;
                      const durationLabel =
                        booking.durationMins >= 60
                          ? `${Math.floor(booking.durationMins / 60)}h${booking.durationMins % 60 ? ` ${booking.durationMins % 60}m` : ""}`
                          : `${booking.durationMins}m`;
                      return (
                        <div
                          key={booking.id}
                          onClick={() => onCardClick(booking)}
                          style={{
                            background: "linear-gradient(145deg, #1a1a1a 0%, #111111 100%)",
                            border: "1px solid rgba(187,161,79,0.22)",
                            borderRadius: 16,
                            overflow: "hidden",
                            cursor: "pointer",
                            transition: "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
                            boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "translateY(-3px)";
                            e.currentTarget.style.boxShadow = "0 10px 32px rgba(0,0,0,0.65)";
                            e.currentTarget.style.borderColor = "rgba(187,161,79,0.55)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.5)";
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
                              <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.5)", fontFamily: "'Poppins', sans-serif", display: "flex", alignItems: "center", gap: 5 }}>
                                <FiClock size={10} style={{ color: "rgba(187,161,79,0.6)" }} />
                                {formatDisplayTime(booking.startTime)}
                              </span>
                            </div>
                            <p style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "#FFFFFF", fontFamily: "'Playfair Display', serif", lineHeight: 1.25 }}>
                              {booking.client}
                            </p>
                            <p style={{ margin: "0 0 16px", fontSize: 12, color: "rgba(187,161,79,0.75)", fontFamily: "'Poppins', sans-serif", display: "flex", alignItems: "center", gap: 6 }}>
                              <FiScissors size={10} />{booking.service}
                            </p>
                            <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 14 }} />
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "'Poppins', sans-serif", display: "flex", alignItems: "center", gap: 5 }}>
                                <FiClock size={10} />{durationLabel}
                              </span>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 100, padding: "3px 10px 3px 5px" }}>
                                <div style={{ width: 18, height: 18, borderRadius: "50%", background: `linear-gradient(135deg, ${from}, ${to})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 800, color: "#fff", fontFamily: "'Poppins', sans-serif" }}>
                                  {initials(s.full_name)}
                                </div>
                                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.55)", fontFamily: "'Poppins', sans-serif", fontWeight: 500 }}>
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
  const [dragging, setDragging] = useState(null); // { booking, offsetSlots }
  const [dragOverCol, setDragOverCol] = useState(null);  // staffId
  const [dragOverSlot, setDragOverSlot] = useState(null); // slot index
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm] = Form.useForm();
  const [nowMins, setNowMins] = useState(() => {
    const n = new Date();
    return (n.getHours() - HOUR_START) * 60 + n.getMinutes();
  });

  /* ── Wizard state ── */
  const [wizStep, setWizStep] = useState(0);
  const [clientMode, setClientMode] = useState("existing");   // "existing" | "walkin"
  const [selectedClient, setSelectedClient] = useState(null); // customer object
  const [walkIn, setWalkIn] = useState({ name: "", phone: "", email: "" });
  const [selectedServices, setSelectedServices] = useState([]); // [{ id, name, _price, _amount, ... }]
  const [staffPerService, setStaffPerService] = useState({});   // { [serviceId]: staffId | "any" }
  const [wizDate, setWizDate] = useState(() => dayjs());
  const [wizTime, setWizTime] = useState(null);

  const gridRef = useRef(null);      // time gutter
  const bodyRef = useRef(null);      // main scroll body
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

  // Set of blocked date strings "YYYY-MM-DD" for O(1) lookup
  const blockedDateSet = useMemo(
    () => new Set(blockedDaysData.map((d) => d.date)),
    [blockedDaysData]
  );

  // Is the currently viewed date blocked?
  const selectedDateIsBlocked = blockedDateSet.has(dateStr);
  const selectedDateBlockReason = blockedDaysData.find((d) => d.date === dateStr)?.reason || "";

  /* ── Normalise API → internal booking shape ── */
  const dayBookings = useMemo(() => {
    const raw = Array.isArray(aptsRaw) ? aptsRaw : aptsRaw?.results ?? [];
    return raw.map((apt) => {
      /* ── Date: prefer scheduled_start, fall back to appointment_date ── */
      const aptDate = apt.scheduled_start
        ? apt.scheduled_start.slice(0, 10)
        : apt.appointment_date ?? dateStr;

      /* ── Start time: prefer scheduled_start slice, fall back to start_time field ── */
      let startTime = "09:00";
      if (apt.scheduled_start && apt.scheduled_start.length >= 16) {
        startTime = apt.scheduled_start.slice(11, 16);           // "HH:MM" from ISO
      } else if (apt.start_time) {
        startTime = apt.start_time.slice(0, 5);                  // "HH:MM" from "HH:mm:ss"
      }

      /* ── Staff ID: handle plain id, nested object, or staff_details ── */
      const staffId =
        typeof apt.staff === "object" && apt.staff !== null
          ? apt.staff.id
          : apt.staff_details?.id ?? apt.staff ?? null;

      /* ── Client name: try all known response shapes ── */
      const client =
        apt.customer_name ||
        apt.customer_full_name ||
        apt.guest_name ||
        apt.guest?.full_name ||
        (apt.customer_details
          ? `${apt.customer_details.first_name ?? ""} ${apt.customer_details.last_name ?? ""}`.trim()
          : null) ||
        (apt.customer ? `Client #${apt.customer}` : "Walk-in");

      /* ── Service name: try all known response shapes ── */
      const services = apt.services ?? apt.booking_services ?? [];
      const firstService = services[0];
      const service =
        apt.service_name ||
        apt.service_details?.name ||
        firstService?.service_name ||
        firstService?.name ||
        serviceLookup[apt.service]?.name ||
        "Service";

      /* ── Duration ── */
      const durationMins =
        apt.duration_mins ??
        apt.service_details?.duration_mins ??
        apt.service_details?.duration ??
        firstService?.duration_mins ??
        serviceLookup[apt.service]?.duration_mins ??
        serviceLookup[apt.service]?.duration ??
        60;

      return {
        id:          apt.id,
        staffId,
        client,
        service,
        services,      // keep full array for detail overlay
        startTime,
        durationMins,
        status:      (apt.status || "pending").replace("_", "-"),
        date:        aptDate,
        raw:         apt,
      };
    });
  }, [aptsRaw, serviceLookup, dateStr]);

  /* auto-scroll to current time on mount */
  useEffect(() => {
    const el = bodyRef.current;
    if (!el || !isToday) return;
    const targetY = Math.max(0, nowY - 120);
    el.scrollTop = targetY;
    if (gridRef.current) gridRef.current.scrollTop = targetY;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* update current-time line every minute */
  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setNowMins((n.getHours() - HOUR_START) * 60 + n.getMinutes());
    };
    const id = setInterval(tick, 60_000);
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

  /* ── Wizard helpers ── */
  const resetWizard = useCallback(() => {
    setWizStep(0);
    setClientMode("existing");
    setSelectedClient(null);
    setWalkIn({ name: "", phone: "", email: "" });
    setSelectedServices([]);
    setStaffPerService({});
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

  /* ── Wizard validation per step ── */
  const wizStepValid = useMemo(() => {
    switch (wizStep) {
      case 0: // Client
        if (clientMode === "existing") return !!selectedClient;
        return walkIn.name.trim() !== "" && walkIn.phone.trim() !== "";
      case 1: // Services
        return selectedServices.length > 0;
      case 2: // Staff (always valid — "any" is default)
        return true;
      case 3: // Date & Time — also blocked if selected date is a blocked day
        if (!wizDate || !wizTime) return false;
        if (blockedDateSet.has(wizDate.format("YYYY-MM-DD"))) return false;
        return true;
      case 4: // Confirm
        return true;
      default:
        return false;
    }
  }, [wizStep, clientMode, selectedClient, walkIn, selectedServices, wizDate, wizTime, blockedDateSet]);

  /* ── POST mutation — create appointment ── */
  const createAppointment = useMutation({
    mutationFn: (data) =>
      _axios.post("/api/portal/v1/booking/appointments/", data),
    onSuccess: (_, sentPayload) => {
      message.success("Appointment booked!");
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
    onError: (err) => {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.non_field_errors?.[0] ||
        Object.values(err?.response?.data ?? {})?.[0]?.[0] ||
        "Failed to create appointment";
      message.error(msg);
      createAppointment.reset();
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
      message.success("Booking rescheduled");
      queryClient.invalidateQueries(["appointments", dateStr]);
      refetchApts();
    },
    onError: () => {
      message.error("Failed to reschedule");
      // Refetch to revert optimistic state
      refetchApts();
    },
  });

  /* ── DELETE mutation ── */
  const deleteAppointment = useMutation({
    mutationFn: (id) =>
      _axios.delete(`/api/portal/v1/booking/appointments/${id}/`),
    onSuccess: () => {
      message.success("Appointment deleted");
      setSelectedBooking(null);
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
    e.dataTransfer.dropEffect = "move";
    if (!bodyRef.current) return;

    const gridRect = bodyRef.current.getBoundingClientRect();
    const y = e.clientY - gridRect.top + bodyRef.current.scrollTop;
    const slot = yToSlot(y);
    setDragOverCol(staffId);
    setDragOverSlot(slot);
  }

  function handleDrop(e, staffId) {
    e.preventDefault();
    if (!dragging) return;

    const gridRect = bodyRef.current.getBoundingClientRect();
    const y = e.clientY - gridRect.top + bodyRef.current.scrollTop;
    const slot = yToSlot(y);
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
    const totalMin = mins + HOUR_START * 60;
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

  const totalDayBookings = dayBookings.length;

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
          background: "#0d0d0d",
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
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            background: "#111111",
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
                  color: "#FFFFFF",
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
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.1)",
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
                          color: active ? "#FFFFFF" : "rgba(255,255,255,0.45)",
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
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)",
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
                        color: active ? "#FFFFFF" : "rgba(255,255,255,0.45)",
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
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.1)",
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
                  color: "rgba(255,255,255,0.6)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.15s, color 0.15s",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(187,161,79,0.15)"; e.currentTarget.style.color = "#BBA14F"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
              >
                <FiChevronLeft size={15} />
              </button>

              <span
                style={{
                  fontSize: isMobile ? 11 : 12,
                  fontWeight: 600,
                  color: "#FFFFFF",
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
                  color: "rgba(255,255,255,0.6)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.15s, color 0.15s",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(187,161,79,0.15)"; e.currentTarget.style.color = "#BBA14F"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
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
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            background: "#161616",
          }}
        >
          {/* Time gutter header */}
          <div
            style={{
              width: gutterW,
              flexShrink: 0,
              borderRight: "1px solid rgba(255,255,255,0.07)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "10px 0",
            }}
          >
            <FiClock size={14} style={{ color: "rgba(187,161,79,0.7)" }} />
          </div>

          {/* Staff columns header */}
          <div className="flex-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            <div className="flex" style={{ minWidth: visibleStaff.length * colW }}>
              {visibleStaff.map((staff, i) => {
                const [from, to] = avatarGradient(staff.full_name);
                const staffBookings = dayBookings.filter((b) => b.staffId === staff.id);
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
                        i < visibleStaff.length - 1
                          ? "1px solid rgba(255,255,255,0.06)"
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
                          color: "#FFFFFF",
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
                        {staffBookings.length} booking{staffBookings.length !== 1 ? "s" : ""}
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
              borderRight: "1px solid rgba(255,255,255,0.07)",
              background: "#111111",
              overflowY: "auto",
              overflowX: "hidden",
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
            ref={gridRef}
          >
            <div style={{ height: TOTAL_SLOTS * SLOT_HEIGHT_PX, position: "relative" }}>
              {timeLabels.map(({ s, h, isHour, isHalfHour }) => (
                <div
                  key={s}
                  style={{
                    position: "absolute",
                    top: s * SLOT_HEIGHT_PX,
                    height: SLOT_HEIGHT_PX,
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    paddingRight: 10,
                  }}
                >
                  {(isHour || isHalfHour) && (
                    <span
                      style={{
                        fontSize: isHour ? 11 : 9,
                        fontFamily: "'Poppins', sans-serif",
                        color: isHour ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.28)",
                        fontWeight: isHour ? 600 : 400,
                        lineHeight: 1,
                      }}
                    >
                      {isHour
                        ? `${h % 12 || 12}${h >= 12 ? "pm" : "am"}`
                        : ":30"}
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
            }}
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            <div
              className="flex relative"
              style={{
                minWidth: visibleStaff.length * colW,
                height: TOTAL_SLOTS * SLOT_HEIGHT_PX,
              }}
            >
              {/* Horizontal slot lines (shared background) */}
              <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }}>
                {timeLabels.map(({ s, isHour, isHalfHour }) => (
                  <div
                    key={s}
                    className="absolute left-0 right-0"
                    style={{
                      top: s * SLOT_HEIGHT_PX,
                      height: 1,
                      background: isHour
                        ? "rgba(255,255,255,0.12)"
                        : isHalfHour
                        ? "rgba(255,255,255,0.055)"
                        : "rgba(255,255,255,0.022)",
                    }}
                  />
                ))}
              </div>

              {/* Current time line */}
              {isToday && nowMins >= 0 && nowMins <= (HOUR_END - HOUR_START) * 60 && (
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
                    {formatDisplayTime(minsToTime(Math.max(0, nowMins)))}
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
                    zIndex: 2,
                  }}
                />
              )}

              {/* Staff columns */}
              {visibleStaff.map((staff, i) => {
                const colBookings = dayBookings.filter((b) => b.staffId === staff.id);
                const isDropTarget = dragOverCol === staff.id;

                // ── Overlap layout: assign each booking a column slot ──
                // Simple greedy algorithm: track end times of each "lane"
                const lanes = []; // each lane = end time (mins) of last booking in it
                const bookingLayout = colBookings.map((booking) => {
                  const start = timeToMins(booking.startTime);
                  const end   = start + booking.durationMins;
                  // find the first free lane
                  let lane = lanes.findIndex((laneEnd) => laneEnd <= start);
                  if (lane === -1) { lane = lanes.length; lanes.push(end); }
                  else lanes[lane] = end;
                  return { booking, lane };
                });
                const totalLanes = Math.max(1, lanes.length);

                return (
                  <div
                    key={staff.id}
                    className="relative shrink-0"
                    style={{
                      width: colW,
                      height: TOTAL_SLOTS * SLOT_HEIGHT_PX,
                      borderRight:
                        i < visibleStaff.length - 1
                          ? "1px solid rgba(255,255,255,0.06)"
                          : "none",
                      background: isDropTarget
                        ? "rgba(187,161,79,0.07)"
                        : "#0d0d0d",
                      transition: "background 0.15s",
                      zIndex: 5,
                    }}
                    onDragOver={(e) => handleDragOver(e, staff.id)}
                    onDrop={(e) => handleDrop(e, staff.id)}
                    onDragLeave={() => {
                      if (dragOverCol === staff.id) setDragOverCol(null);
                    }}
                  >
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

                    {bookingLayout.map(({ booking, lane }) => (
                      <BookingCard
                        key={booking.id}
                        booking={booking}
                        isPast={bookingIsPast(booking)}
                        colOffset={lane}
                        colCount={totalLanes}
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

        {/* ── Bottom legend bar ── */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "6px 16px",
            padding: isMobile ? "9px 16px" : "11px 28px",
            borderTop: "1px solid rgba(255,255,255,0.07)",
            background: "#111111",
            flexShrink: 0,
          }}
        >
          {Object.entries(STATUS_CFG).map(([key, cfg]) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: cfg.dot,
                  display: "inline-block",
                  boxShadow: `0 0 4px ${cfg.dot}88`,
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  color: "rgba(255,255,255,0.45)",
                  fontFamily: "'Poppins', sans-serif",
                }}
              >
                {cfg.label}
              </span>
            </div>
          ))}
          {isToday && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  width: 18,
                  height: 2,
                  borderRadius: 2,
                  background: "linear-gradient(90deg, #BBA14F, #e4ca80)",
                  display: "inline-block",
                  boxShadow: "0 0 4px rgba(187,161,79,0.6)",
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  color: "rgba(255,255,255,0.45)",
                  fontFamily: "'Poppins', sans-serif",
                }}
              >
                Current time
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Booking detail modal */}
      {selectedBooking && (
        <BookingModal
          booking={selectedBooking}
          staff={visibleStaff.find((s) => s.id === selectedBooking.staffId)}
          onClose={() => setSelectedBooking(null)}
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
        width={560}
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
                  {["Select Client", "Choose Services", "Team Member", "Date & Time", "Confirm Booking"][wizStep]}
                </p>
                <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#FDFAF5", fontFamily: "'Playfair Display',serif", lineHeight: 1.25 }}>
                  New Appointment
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
          maxHeight: wizStep >= 2
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
            <StepStaff
              staffList={visibleStaff}
              selectedServices={selectedServices}
              staffPerService={staffPerService}
              setStaffPerService={setStaffPerService}
            />
          )}
          {wizStep === 3 && (
            <StepDateTime
              selectedDate={wizDate}
              setSelectedDate={setWizDate}
              selectedTime={wizTime}
              setSelectedTime={setWizTime}
              blockedDateSet={blockedDateSet}
            />
          )}
          {wizStep === 4 && (
            <StepConfirm
              clientMode={clientMode}
              selectedClient={selectedClient}
              walkIn={walkIn}
              selectedServices={selectedServices}
              staffPerService={staffPerService}
              staffList={visibleStaff}
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
            Step {wizStep + 1} of 5
          </span>

          {/* Next / Book */}
          {wizStep < 4 ? (
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
              {wizStep === 1 ? "Select Staff" : wizStep === 2 ? "Pick Date & Time" : "Continue"}
              <FiArrowRight size={14} />
            </button>
          ) : (
            <button
              onClick={async () => {
                /* ─────────────────────────────────────────────
                   BUILD APPOINTMENT PAYLOAD
                   Two distinct shapes depending on client mode:

                   Existing customer:
                   { customer_id, appointment_date, start_time, services }

                   Walk-in / Guest:
                   { guest: { full_name, phone_number },
                     appointment_date, start_time, services,
                     staff, booking_source: "walk-in", notes }
                ───────────────────────────────────────────── */

                // Resolve the staff ID (first non-"any" selection)
                const resolvedStaff = (() => {
                  const picked = Object.values(staffPerService).find((v) => v && v !== "any");
                  return picked ? Number(picked) : null;
                })();

                // Date / time — backend expects "YYYY-MM-DD" and "HH:mm:ss"
                const appointmentDate = wizDate.format("YYYY-MM-DD");
                const startTime       = `${wizTime}:00`;   // e.g. "10:00:00"

                // Services array — each item is { service_id }
                const services = selectedServices.map((s) => ({ service_id: s.id }));

                let payload;

                if (clientMode === "existing" && selectedClient) {
                  // ── Existing registered customer ──
                  payload = {
                    customer_id:      selectedClient.id,
                    appointment_date: appointmentDate,
                    start_time:       startTime,
                    services,
                  };
                } else {
                  // ── Walk-in / Guest ──
                  payload = {
                    guest: {
                      full_name:    walkIn.name.trim(),
                      phone_number: walkIn.phone.trim(),
                      ...(walkIn.email.trim() ? { email: walkIn.email.trim() } : {}),
                    },
                    appointment_date: appointmentDate,
                    start_time:       startTime,
                    services,
                    ...(resolvedStaff !== null ? { staff: resolvedStaff } : {}),
                    booking_source:   "walk-in",
                    notes:            "",
                  };
                }

                createAppointment.mutate(payload);
              }}
              disabled={createAppointment.isPending}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "10px 26px", borderRadius: 10, border: "none",
                background: createAppointment.isPending
                  ? "rgba(187,161,79,0.5)"
                  : "linear-gradient(135deg,#BBA14F,#987554)",
                color: "#fff",
                fontFamily: "'Poppins',sans-serif", fontSize: 13, fontWeight: 700,
                cursor: createAppointment.isPending ? "not-allowed" : "pointer",
                boxShadow: createAppointment.isPending ? "none" : "0 4px 14px rgba(187,161,79,0.4)",
                transition: "opacity 0.15s",
              }}
              onMouseEnter={(e) => { if (!createAppointment.isPending) e.currentTarget.style.opacity = "0.88"; }}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              <FiCheckCircle size={15} />
              {createAppointment.isPending ? "Booking…" : "✦ Book Appointment"}
            </button>
          )}
        </div>
      </Modal>
    </div>
  );
}
