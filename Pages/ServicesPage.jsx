/**
 * ServicesPage.jsx
 * ────────────────
 * Full CRUD page for salon services.
 *
 * Endpoints used:
 *   GET    /api/portal/v1/booking/services/          → list all services
 *   POST   /api/portal/v1/booking/services/          → create a service
 *   PATCH  /api/portal/v1/booking/services/{id}/     → update a service
 *   DELETE /api/portal/v1/booking/services/{id}/     → delete a service
 *   GET    /api/portal/v1/booking/service-categories/ → list all categories
 *
 * React Query keys:
 *   ["services"]           → the full list
 *   ["service-categories"] → all categories
 *
 * Design language: matches the rest of the dashboard
 *   – Cream/gold palette (#F5EFE6, #BBA14F, #987554, #272727)
 *   – Playfair Display headings, Poppins body
 *   – Rounded cards, gold gradient CTA buttons
 */

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  Button,
  message,
  Tooltip,
} from "antd";
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiSearch,
  FiScissors,
  FiClock,
  FiTag,
  FiLayers,
  FiUsers,
  FiCheck,
  FiUserCheck,
} from "react-icons/fi";
import _axios from "../src/api/_axios";

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */

/** Tailwind-free gold button class string (Ant Design overrides) */
const GOLD_BTN = "!bg-[#BBA14F] !border-none hover:!bg-[#a08340] !text-white";

/** Price type options for the selector */
const PRICE_TYPES = [
  { label: "Fixed",  value: "fixed" },
  { label: "Free",   value: "free"  },
  { label: "From",   value: "from"  },
];

/**
 * Duration options in 5-minute intervals up to 8 hours.
 * e.g. 5 → "5 mins", 60 → "1 hr", 65 → "1 hr 5 mins"
 */
const DURATION_OPTIONS = (() => {
  const opts = [];
  for (let mins = 5; mins <= 480; mins += 5) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    let label;
    if (h && m)      label = `${h} hr ${m} mins`;
    else if (h)      label = `${h} hr`;
    else             label = `${m} mins`;
    opts.push({ label, value: mins });
  }
  return opts;
})();

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */

/**
 * Formats a decimal price string like "43533." into "GHS 43,533.00"
 * Falls back gracefully if value is missing or not a number.
 */
function formatPrice(val) {
  const n = parseFloat(val);
  if (isNaN(n)) return "—";
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
  }).format(n);
}

/**
 * Returns a display label for the price pill on a service card.
 *  price_type === "free"  → "Free"
 *  price_type === "from"  → "From GHS X.XX"
 *  price === 0 (no type)  → "Free"
 *  otherwise              → "From GHS X.XX"
 */
function displayPrice(service) {
  const type = service.price_type;
  const n    = parseFloat(service.price);
  if (type === "free" || (!type && n === 0)) return "Free";
  // All non-free prices show with "From" prefix on the card
  return `From ${formatPrice(service.price)}`;
}

/**
 * Converts minutes to a human-readable duration string.
 * e.g. 90  → "1 hr 30 mins"
 *      60  → "1 hr"
 *      45  → "45 mins"
 */
function formatDuration(mins) {
  if (!mins && mins !== 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h} hr ${m} mins`;
  if (h) return `${h} hr`;
  return `${m} mins`;
}

/* ─────────────────────────────────────────────
   STAFF AVATAR COLOURS + MINI AVATAR
───────────────────────────────────────────── */
const AVATAR_COLORS = [
  ["#BBA14F", "#987554"],
  ["#987554", "#6b4f30"],
  ["#4f7aa8", "#2d5a84"],
  ["#7a4fa8", "#5a2d84"],
  ["#4fa87a", "#2d845a"],
  ["#a84f7a", "#842d5a"],
];

function MiniAvatar({ name, size = 34, selected = false }) {
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
      className="shrink-0 flex items-center justify-center rounded-full font-semibold text-white relative"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${from}, ${to})`,
        fontSize: size * 0.34,
        fontFamily: "'Poppins', sans-serif",
        boxShadow: selected
          ? "0 0 0 2px #BBA14F, 0 2px 8px rgba(0,0,0,0.15)"
          : "0 2px 8px rgba(0,0,0,0.1)",
        opacity: selected ? 1 : 0.75,
        transition: "all 0.15s",
      }}
    >
      {initials}
      {selected && (
        <div
          className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
          style={{ background: "#BBA14F", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }}
        >
          <FiCheck size={8} color="#fff" strokeWidth={3} />
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   STAFF PICKER MODAL
   Opens from the service form; shows a searchable
   grid of staff avatars for multi-selection.
───────────────────────────────────────────── */
function StaffPickerModal({ open, onClose, staffList = [], value = [], onChange }) {
  const [pickerSearch, setPickerSearch] = useState("");

  const filtered = useMemo(() => {
    if (!pickerSearch.trim()) return staffList;
    const q = pickerSearch.toLowerCase();
    return staffList.filter(
      (m) =>
        m.full_name?.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q)
    );
  }, [staffList, pickerSearch]);

  const isAll = value.length === 0;

  const toggle = (id) => {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  };

  const selectAll = () => onChange([]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      width={520}
      closable={false}
      styles={{
        content: { padding: 0, borderRadius: 20, overflow: "hidden" },
        mask: { backdropFilter: "blur(4px)", background: "rgba(39,39,39,0.5)" },
      }}
    >
      {/* ── Header ── */}
      <div
        className="relative overflow-hidden px-6 pt-6 pb-5"
        style={{
          background: "linear-gradient(120deg, #272727 0%, #3a2e1e 60%, #4a3a22 100%)",
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(187,161,79,0.18) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />
        <div
          className="absolute right-0 top-0 h-full w-1/2 pointer-events-none"
          style={{
            background: "radial-gradient(circle at 80% 50%, rgba(187,161,79,0.15), transparent 70%)",
          }}
        />

        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background: "linear-gradient(135deg, #BBA14F, #987554)",
                boxShadow: "0 4px 14px rgba(187,161,79,0.4)",
              }}
            >
              <FiUsers size={18} color="#fff" />
            </div>
            <div>
              <p
                className="text-[10px] uppercase tracking-[0.2em] mb-0.5"
                style={{ color: "#BBA14F", fontFamily: "'Poppins', sans-serif" }}
              >
                Assign Team
              </p>
              <h3
                className="text-base font-bold text-white leading-none"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Choose Team Members
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 hover:opacity-70"
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "#fff",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="px-6 py-5" style={{ background: "#FDFAF5" }}>

        {/* Search bar */}
        <div
          className="flex items-center gap-2 px-4 py-2.5 rounded-full mb-4"
          style={{
            background: "#fff",
            border: "1px solid rgba(187,161,79,0.3)",
            boxShadow: "0 1px 6px rgba(39,39,39,0.05)",
          }}
        >
          <FiSearch size={13} style={{ color: "#987554", flexShrink: 0 }} />
          <input
            placeholder="Search team members…"
            value={pickerSearch}
            onChange={(e) => setPickerSearch(e.target.value)}
            className="bg-transparent outline-none text-sm text-[#272727] placeholder-[#c8b88a] w-full"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          />
          {pickerSearch && (
            <button
              onClick={() => setPickerSearch("")}
              style={{ color: "#987554", background: "none", border: "none", cursor: "pointer", lineHeight: 1 }}
            >
              ×
            </button>
          )}
        </div>

        {/* "All members" chip */}
        <button
          onClick={selectAll}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl mb-3 transition-all duration-200"
          style={{
            background: isAll
              ? "linear-gradient(135deg, rgba(187,161,79,0.18), rgba(152,117,84,0.1))"
              : "rgba(187,161,79,0.05)",
            border: isAll
              ? "1.5px solid rgba(187,161,79,0.5)"
              : "1px solid rgba(187,161,79,0.15)",
            cursor: "pointer",
          }}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{
              background: isAll
                ? "linear-gradient(135deg, #BBA14F, #987554)"
                : "rgba(187,161,79,0.12)",
              boxShadow: isAll ? "0 2px 8px rgba(187,161,79,0.3)" : "none",
            }}
          >
            <FiUserCheck size={15} style={{ color: isAll ? "#fff" : "#BBA14F" }} />
          </div>
          <div className="text-left flex-1">
            <p
              className="text-sm font-semibold leading-none mb-0.5"
              style={{ color: isAll ? "#7a6030" : "#272727", fontFamily: "'Poppins', sans-serif" }}
            >
              All Team Members
            </p>
            <p
              className="text-[11px]"
              style={{ color: "#987554", fontFamily: "'Poppins', sans-serif" }}
            >
              Service is available to everyone ({staffList.length} members)
            </p>
          </div>
          {isAll && (
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "#BBA14F" }}
            >
              <FiCheck size={10} color="#fff" strokeWidth={3} />
            </div>
          )}
        </button>

        {/* Divider */}
        <div
          className="flex items-center gap-3 mb-3"
          style={{ color: "#c8b88a", fontFamily: "'Poppins', sans-serif", fontSize: 10, letterSpacing: "0.1em" }}
        >
          <div className="flex-1 h-px" style={{ background: "rgba(187,161,79,0.15)" }} />
          OR SELECT SPECIFIC MEMBERS
          <div className="flex-1 h-px" style={{ background: "rgba(187,161,79,0.15)" }} />
        </div>

        {/* Staff grid */}
        {filtered.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-8 rounded-2xl gap-2"
            style={{
              background: "rgba(187,161,79,0.04)",
              border: "1px dashed rgba(187,161,79,0.2)",
              color: "#987554",
              fontFamily: "'Poppins', sans-serif",
              fontSize: 13,
            }}
          >
            <FiUsers size={22} style={{ opacity: 0.4 }} />
            No members found
          </div>
        ) : (
          <div
            className="sp-scroll"
            style={{
              maxHeight: 280,
              overflowY: "auto",
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {filtered.map((member) => {
              const sel = value.includes(member.id);
              const name = member.full_name || member.email || "?";
              return (
                <button
                  key={member.id}
                  onClick={() => toggle(member.id)}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-2xl transition-all duration-150 w-full text-left"
                  style={{
                    background: sel
                      ? "linear-gradient(135deg, rgba(187,161,79,0.15), rgba(152,117,84,0.08))"
                      : "#fff",
                    border: sel
                      ? "1.5px solid rgba(187,161,79,0.5)"
                      : "1px solid rgba(187,161,79,0.12)",
                    cursor: "pointer",
                    boxShadow: sel ? "0 2px 10px rgba(187,161,79,0.12)" : "none",
                  }}
                >
                  <MiniAvatar name={name} size={36} selected={sel} />
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-medium leading-none mb-0.5 truncate"
                      style={{ color: "#272727", fontFamily: "'Poppins', sans-serif" }}
                    >
                      {name}
                    </p>
                    {member.email && (
                      <p
                        className="text-[11px] truncate"
                        style={{ color: "#987554", fontFamily: "'Poppins', sans-serif" }}
                      >
                        {member.email}
                      </p>
                    )}
                  </div>
                  {sel && (
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: "#BBA14F" }}
                    >
                      <FiCheck size={10} color="#fff" strokeWidth={3} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div
          className="flex items-center justify-between mt-5 pt-4"
          style={{ borderTop: "1px solid rgba(187,161,79,0.15)" }}
        >
          <p
            className="text-[11px]"
            style={{ color: "#987554", fontFamily: "'Poppins', sans-serif" }}
          >
            {isAll
              ? "All members selected"
              : `${value.length} member${value.length !== 1 ? "s" : ""} selected`}
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:opacity-90"
            style={{
              background: "linear-gradient(135deg, #BBA14F, #987554)",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontFamily: "'Poppins', sans-serif",
              boxShadow: "0 4px 14px rgba(187,161,79,0.3)",
            }}
          >
            ✦ Done
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ─────────────────────────────────────────────
   STAFF PICKER TRIGGER FIELD
   Used inside ServiceFormFields as a custom
   Form.Item child. Shows selected avatars and
   opens the StaffPickerModal on click.
───────────────────────────────────────────── */
function StaffPickerField({ value = [], onChange, staffList = [], staffLoading = false }) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const isAll = value.length === 0;

  /* names of selected members */
  const selectedMembers = useMemo(
    () => staffList.filter((m) => value.includes(m.id)),
    [staffList, value]
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        disabled={staffLoading}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 hover:shadow-md"
        style={{
          background: "#fff",
          border: "1.5px solid rgba(187,161,79,0.3)",
          cursor: staffLoading ? "not-allowed" : "pointer",
          textAlign: "left",
          boxShadow: "0 1px 6px rgba(39,39,39,0.04)",
        }}
      >
        {/* Avatar stack or "All" badge */}
        <div className="flex items-center shrink-0">
          {isAll ? (
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #BBA14F, #987554)" }}
            >
              <FiUsers size={15} color="#fff" />
            </div>
          ) : (
            <div className="flex items-center">
              {selectedMembers.slice(0, 4).map((m, i) => (
                <div key={m.id} style={{ marginLeft: i === 0 ? 0 : -10, zIndex: 10 - i }}>
                  <MiniAvatar name={m.full_name || m.email} size={32} selected={false} />
                </div>
              ))}
              {selectedMembers.length > 4 && (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold"
                  style={{
                    background: "rgba(187,161,79,0.2)",
                    color: "#987554",
                    marginLeft: -10,
                    border: "2px solid #FDFAF5",
                    fontFamily: "'Poppins', sans-serif",
                  }}
                >
                  +{selectedMembers.length - 4}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Label */}
        <div className="flex-1 min-w-0">
          <p
            className="text-sm font-medium leading-none mb-0.5"
            style={{ color: "#272727", fontFamily: "'Poppins', sans-serif" }}
          >
            {staffLoading
              ? "Loading team…"
              : isAll
              ? "All Team Members"
              : selectedMembers.map((m) => m.full_name || m.email).join(", ")}
          </p>
          <p
            className="text-[11px] truncate"
            style={{ color: "#987554", fontFamily: "'Poppins', sans-serif" }}
          >
            {isAll
              ? `Service available to all ${staffList.length} members`
              : `${value.length} member${value.length !== 1 ? "s" : ""} assigned`}
          </p>
        </div>

        {/* Edit hint */}
        <span
          className="text-[11px] shrink-0 px-2.5 py-1 rounded-full"
          style={{
            background: "rgba(187,161,79,0.1)",
            color: "#987554",
            fontFamily: "'Poppins', sans-serif",
            border: "1px solid rgba(187,161,79,0.2)",
          }}
        >
          Change
        </span>
      </button>

      <StaffPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        staffList={staffList}
        value={value}
        onChange={onChange}
      />
    </>
  );
}

/* ─────────────────────────────────────────────
   CATEGORY FORM FIELDS
   (shared between Add and Edit category modals)
───────────────────────────────────────────── */function CategoryFormFields() {
  return (
    <>
      <Form.Item
        name="name"
        label="Category Name"
        rules={[{ required: true, message: "Please enter a category name" }]}
      >
        <Input placeholder="e.g. Hair Care" className="rounded-xl" />
      </Form.Item>

      <Form.Item name="description" label="Description">
        <Input.TextArea
          placeholder="Briefly describe this category…"
          rows={3}
          className="rounded-xl"
        />
      </Form.Item>
    </>
  );
}

/* ─────────────────────────────────────────────
   SERVICE FORM FIELDS
   (shared between Add and Edit modals)
───────────────────────────────────────────── */

/**
 * Reusable form body rendered inside both Add and Edit modals.
 * Defined at module level so React never re-mounts it on re-renders.
 */
function ServiceFormFields({ categoryOptions = [], categoriesLoading = false, staffList = [], staffLoading = false }) {
  /* Watch price_type to conditionally show/hide the price input */
  const priceType = Form.useWatch("price_type");
  const showPrice = priceType !== "free";

  /* Shared label style */
  const labelStyle = {
    fontFamily: "'Poppins', sans-serif",
    fontSize: 11,
    fontWeight: 600,
    color: "#987554",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  };

  /* Shared input style injected via className */
  const inputCls = "!rounded-xl !border-[rgba(187,161,79,0.3)] focus:!border-[#BBA14F] !bg-[#FDFAF5] !text-[#272727] placeholder:!text-[#c8b88a]";

  return (
    <div className="flex flex-col gap-0">

      {/* ── Section: Identity ── */}
      <div
        className="flex items-center gap-2 mb-4"
        style={{ borderBottom: "1px solid rgba(187,161,79,0.15)", paddingBottom: 10 }}
      >
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg,#BBA14F,#987554)" }}
        >
          <FiScissors size={12} color="#fff" />
        </div>
        <span style={{ ...labelStyle, fontSize: 10 }}>Service Identity</span>
      </div>

      {/* Name + Category side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <Form.Item
          name="name"
          label={<span style={labelStyle}>Service Name</span>}
          rules={[{ required: true, message: "Required" }]}
          className="mb-0"
        >
          <Input
            placeholder="e.g. Deep Conditioning"
            className={inputCls}
          />
        </Form.Item>

        <Form.Item
          name="category"
          label={<span style={labelStyle}>Category</span>}
          className="mb-0"
        >
          <Select
            placeholder="Select category…"
            loading={categoriesLoading}
            allowClear
            options={categoryOptions}
            className="rounded-xl"
          />
        </Form.Item>
      </div>

      {/* Description */}
      <Form.Item
        name="description"
        label={<span style={labelStyle}>Description</span>}
        className="mb-5"
      >
        <Input.TextArea
          placeholder="Briefly describe what this service involves…"
          rows={2}
          className={inputCls}
          style={{ resize: "none" }}
        />
      </Form.Item>

      {/* ── Section: Pricing & Duration ── */}
      <div
        className="flex items-center gap-2 mb-4"
        style={{ borderBottom: "1px solid rgba(187,161,79,0.15)", paddingBottom: 10 }}
      >
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg,#BBA14F,#987554)" }}
        >
          <FiTag size={11} color="#fff" />
        </div>
        <span style={{ ...labelStyle, fontSize: 10 }}>Pricing & Duration</span>
      </div>

      {/* Price type + Amount + Duration — three-column row */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <Form.Item
          name="price_type"
          label={<span style={labelStyle}>Price Type</span>}
          rules={[{ required: true, message: "Required" }]}
          className="mb-0"
        >
          <Select
            placeholder="Type…"
            options={PRICE_TYPES}
            className="rounded-xl"
          />
        </Form.Item>

        <Form.Item
          name="price"
          label={<span style={labelStyle}>Amount (GHS)</span>}
          className="mb-0"
          rules={showPrice ? [{ required: true, message: "Required" }] : []}
          style={{ display: showPrice ? undefined : "none" }}
        >
          <InputNumber
            min={0}
            step={100}
            placeholder="0.00"
            className={`w-full ${inputCls}`}
            style={{ width: "100%" }}
            formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
            parser={(v) => v?.replace(/,/g, "")}
          />
        </Form.Item>

        {/* Show a free badge when price_type is "free" so the row stays balanced */}
        {!showPrice && (
          <div className="flex flex-col justify-end mb-0.5">
            <span style={labelStyle} className="mb-1.5">Amount</span>
            <div
              className="flex items-center justify-center rounded-xl h-8 text-xs font-semibold"
              style={{
                background: "rgba(34,160,80,0.1)",
                color: "#1a8a40",
                fontFamily: "'Poppins', sans-serif",
                border: "1px solid rgba(34,160,80,0.2)",
              }}
            >
              ✓ Free
            </div>
          </div>
        )}

        <Form.Item
          name="duration"
          label={<span style={labelStyle}>Duration</span>}
          rules={[{ required: true, message: "Required" }]}
          className="mb-0"
        >
          <Select
            placeholder="Select…"
            options={DURATION_OPTIONS}
            showSearch
            optionFilterProp="label"
            className="rounded-xl"
            style={{ width: "100%" }}
          />
        </Form.Item>
      </div>

      {/* ── Section: Team Members ── */}
      <div
        className="flex items-center gap-2 mb-3 mt-1"
        style={{ borderBottom: "1px solid rgba(187,161,79,0.15)", paddingBottom: 10 }}
      >
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg,#BBA14F,#987554)" }}
        >
          <FiUsers size={11} color="#fff" />
        </div>
        <span style={{ ...labelStyle, fontSize: 10 }}>Team Members</span>
      </div>

      <Form.Item name="staff_ids" className="mb-5">
        <StaffPickerField staffList={staffList} staffLoading={staffLoading} />
      </Form.Item>

      {/* ── Section: Status ── */}
      <div
        className="flex items-center justify-between px-4 py-3 rounded-xl"
        style={{
          background: "rgba(187,161,79,0.06)",
          border: "1px solid rgba(187,161,79,0.18)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(34,160,80,0.1)" }}
          >
            <FiClock size={14} style={{ color: "#1a8a40" }} />
          </div>
          <div>
            <p
              className="text-sm font-medium text-[#272727] leading-none mb-0.5"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              Mark as Active
            </p>
            <p
              className="text-[11px] text-[#987554]"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            >
              Service will appear in booking options
            </p>
          </div>
        </div>
        <Form.Item name="is_active" valuePropName="checked" className="mb-0">
          <Switch
            style={{ background: undefined }}
          />
        </Form.Item>
      </div>

    </div>
  );
}

/* ─────────────────────────────────────────────
   SERVICE CARD (Card view)
───────────────────────────────────────────── */

/**
 * A single luxurious card for one service.
 * Shows name, description, duration, price, active status, and action buttons.
 */
function ServiceCard({ service, onEdit, onDelete, deleting, staffData = [] }) {
  /* Resolve assigned staff IDs → names */
  const assignedIds = service.assigned_staff_ids ?? service.staff_ids ?? [];
  const assignedStaff = assignedIds
    .map((id) => staffData.find((s) => s.id === id || String(s.id) === String(id)))
    .filter(Boolean);

  return (
    <div
      className="relative rounded-2xl p-5 transition-all duration-250 hover:-translate-y-0.5 hover:shadow-lg"
      style={{
        background: "#FDFAF5",
        border: "1px solid rgba(187,161,79,0.18)",
        boxShadow: "0 3px 16px rgba(39,39,39,0.06)",
      }}
    >
      {/* Gold accent bar at the top */}
      <div
        className="absolute top-0 left-0 right-0 rounded-t-2xl"
        style={{
          height: 3,
          background: service.is_active
            ? "linear-gradient(90deg, #BBA14F, #e4ca80)"
            : "rgba(200,50,50,0.4)",
        }}
      />

      {/* Header: scissors icon + name + active badge */}
      <div className="flex items-start gap-3 mb-3 mt-1">
        {/* Icon circle */}
        <div
          className="flex items-center justify-center rounded-xl shrink-0"
          style={{
            width: 42,
            height: 42,
            background: "linear-gradient(135deg, rgba(187,161,79,0.18), rgba(152,117,84,0.1))",
            border: "1px solid rgba(187,161,79,0.3)",
          }}
        >
          <FiScissors size={17} style={{ color: "#BBA14F" }} />
        </div>

        <div className="flex-1 min-w-0">
          <h3
            className="font-semibold truncate leading-none mb-1"
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: 14,
              color: "#272727",
            }}
          >
            {service.name}
          </h3>
          {/* Active / Inactive badge */}
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-medium"
            style={{
              background: service.is_active
                ? "rgba(34,160,80,0.12)"
                : "rgba(200,50,50,0.1)",
              color: service.is_active ? "#1a8a40" : "#c43232",
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            {service.is_active ? "Active" : "Inactive"}
          </span>
        </div>
      </div>

      {/* Description */}
      {service.description && (
        <p
          className="text-xs mb-4 leading-relaxed line-clamp-2"
          style={{ color: "#987554", fontFamily: "'Poppins', sans-serif" }}
        >
          {service.description}
        </p>
      )}

      {/* Duration + Price pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs"
          style={{
            background: "rgba(187,161,79,0.1)",
            color: "#7a6030",
            fontFamily: "'Poppins', sans-serif",
          }}
        >
          <FiClock size={11} style={{ color: "#BBA14F" }} />
          {formatDuration(service.duration)}
        </div>

        {/* Price pill — shows Free / From GHS X / GHS X */}
        {(() => {
          const label = displayPrice(service);
          const isFree = label === "Free";
          return (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{
                background: isFree
                  ? "rgba(34,160,80,0.1)"
                  : "linear-gradient(135deg, rgba(187,161,79,0.15), rgba(152,117,84,0.08))",
                color: isFree ? "#1a8a40" : "#6b4a1e",
                fontFamily: "'Poppins', sans-serif",
                border: isFree
                  ? "1px solid rgba(34,160,80,0.2)"
                  : "1px solid rgba(187,161,79,0.2)",
              }}
            >
              {label}
            </div>
          );
        })()}
      </div>

      {/* Divider */}
      <div className="h-px mb-3" style={{ background: "rgba(187,161,79,0.15)" }} />

      {/* Assigned staff */}
      {assignedStaff.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {assignedStaff.slice(0, 3).map((s) => (
            <span
              key={s.id}
              className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{
                background: "rgba(187,161,79,0.1)",
                border: "1px solid rgba(187,161,79,0.22)",
                color: "#7a6030",
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              <FiUserCheck size={9} style={{ color: "#BBA14F" }} />
              {s.full_name || s.name || `Staff #${s.id}`}
            </span>
          ))}
          {assignedStaff.length > 3 && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{
                background: "rgba(187,161,79,0.08)",
                color: "#987554",
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              +{assignedStaff.length - 3} more
            </span>
          )}
        </div>
      )}

      {/* Divider before actions */}
      <div className="h-px mb-3" style={{ background: "rgba(187,161,79,0.15)" }} />

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={() => onEdit(service)}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all duration-200 hover:opacity-80"
          style={{
            color: "#987554",
            background: "rgba(152,117,84,0.1)",
            fontFamily: "'Poppins', sans-serif",
          }}
        >
          <FiEdit2 size={12} />
          Edit
        </button>
        <button
          onClick={() => onDelete(service.id)}
          disabled={deleting}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all duration-200 hover:opacity-80 disabled:opacity-50"
          style={{
            color: "#c43232",
            background: "rgba(196,50,50,0.08)",
            fontFamily: "'Poppins', sans-serif",
          }}
        >
          <FiTrash2 size={12} />
          Delete
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MODAL TITLE HELPER
───────────────────────────────────────────── */
const modalTitle = (text) => (
  <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: "#272727" }}>
    {text}
  </span>
);

/* ─────────────────────────────────────────────
   MAIN PAGE COMPONENT
───────────────────────────────────────────── */
export default function ServicesPage() {
  /* ── React Query client (for cache invalidation) ── */
  const queryClient = useQueryClient();

  /* ── Local UI state ── */
  const [addOpen, setAddOpen]         = useState(false);
  const [editOpen, setEditOpen]       = useState(false);
  const [editService, setEditService] = useState(null);
  const [search, setSearch]           = useState("");
  const [activeCat, setActiveCat]     = useState("all");

  /* ── Category modal state ── */
  const [addCatOpen, setAddCatOpen]   = useState(false);
  const [editCatOpen, setEditCatOpen] = useState(false);
  const [editCategory, setEditCategory] = useState(null);

  /* ── Ant Design form instances ── */
  const [addForm]    = Form.useForm();
  const [editForm]   = Form.useForm();
  const [addCatForm] = Form.useForm();
  const [editCatForm] = Form.useForm();

  /* ─────────────────────────────────────
     FETCH: list all services
     GET /api/portal/v1/booking/services/
  ───────────────────────────────────── */
  const { data: servicesRaw, isLoading: servicesLoading } = useQuery({
    queryKey: ["services"],
    queryFn: () =>
      _axios.get("/api/portal/v1/booking/services/").then((r) => r.data),
  });

  /* ─────────────────────────────────────
     FETCH: list all categories
     GET /api/portal/v1/booking/service-categories/
  ───────────────────────────────────── */
  const { data: categoriesRaw, isLoading: categoriesLoading } = useQuery({
    queryKey: ["service-categories"],
    queryFn: () =>
      _axios.get("/api/portal/v1/booking/service-categories/").then((r) => r.data),
  });

  /* ── Fetch staff for the team picker ── */
  const { data: staffRaw, isLoading: staffLoading } = useQuery({
    queryKey: ["staff"],
    queryFn: () => _axios.get("/api/portal/v1/accounts/staff/").then((r) => r.data),
  });

  /* Normalise arrays */
  const servicesData = useMemo(
    () => (Array.isArray(servicesRaw) ? servicesRaw : servicesRaw?.results || []),
    [servicesRaw]
  );

  const categoriesData = useMemo(
    () => (Array.isArray(categoriesRaw) ? categoriesRaw : categoriesRaw?.results || []),
    [categoriesRaw]
  );

  const staffData = useMemo(
    () => (Array.isArray(staffRaw) ? staffRaw : staffRaw?.results || []),
    [staffRaw]
  );

  /* Category options for Select dropdowns */
  const categoryOptions = useMemo(
    () => categoriesData.map((c) => ({ label: c.name, value: c.id })),
    [categoriesData]
  );

  /* ─────────────────────────────────────
     SEARCH + CATEGORY FILTER
  ───────────────────────────────────── */
  const filtered = useMemo(() => {
    let list = servicesData;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.name?.toLowerCase().includes(q) ||
          s.description?.toLowerCase().includes(q)
      );
    }
    if (activeCat !== "all") {
      list = list.filter((s) => String(s.category) === String(activeCat));
    }
    return list;
  }, [servicesData, search, activeCat]);

  /* ─────────────────────────────────────
     DERIVE CATEGORIES from services
     (works even without a categories API —
     falls back to extracting unique category
     ids/names from the services themselves)
  ───────────────────────────────────── */
  const sidebarCategories = useMemo(() => {
    // If we have a real categories API response, use it — sort A→Z
    if (categoriesData.length > 0)
      return [...categoriesData].sort((a, b) => a.name.localeCompare(b.name));
    // Otherwise derive from service fields, sorted A→Z
    const map = {};
    servicesData.forEach((s) => {
      if (s.category != null) {
        const id   = s.category;
        const name = s.category_name || s.category_display || `Category ${id}`;
        map[id] = { id, name };
      }
    });
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  }, [categoriesData, servicesData]);

  /* Group filtered services by category for the right panel */
  const groupedServices = useMemo(() => {
    // Build id → name map
    const catMap = {};
    sidebarCategories.forEach((c) => { catMap[c.id] = c.name; });

    const groups = {};
    filtered.forEach((s) => {
      const key  = s.category != null ? String(s.category) : "__none__";
      const name = catMap[s.category] || s.category_name || (s.category != null ? `Category ${s.category}` : "Uncategorised");
      if (!groups[key]) groups[key] = { key, name, services: [] };
      groups[key].services.push(s);
    });

    // Sort: put __none__ last
    return Object.values(groups).sort((a, b) => {
      if (a.key === "__none__") return 1;
      if (b.key === "__none__") return -1;
      return a.name.localeCompare(b.name);
    });
  }, [filtered, sidebarCategories]);

  const isLoading = servicesLoading;

  /* ─────────────────────────────────────
     CREATE
  ───────────────────────────────────── */
  const createService = useMutation({
    mutationFn: (data) => {
      const isFree = data.price_type === "free";
      return _axios.post("/api/portal/v1/booking/services/", {
        ...data,
        price: isFree ? "0" : String(data.price ?? 0),
      });
    },
    onSuccess: () => {
      message.success("Service created successfully");
      queryClient.invalidateQueries(["services"]);
      setAddOpen(false);
      addForm.resetFields();
    },
    onError: (err) => {
      message.error(err.response?.data?.message || "Failed to create service");
    },
  });

  /* ─────────────────────────────────────
     UPDATE
  ───────────────────────────────────── */
  const updateService = useMutation({
    mutationFn: (data) => {
      const isFree = data.price_type === "free";
      return _axios.patch(`/api/portal/v1/booking/services/${data.id}/`, {
        ...data,
        price: isFree ? "0" : String(data.price ?? 0),
      });
    },
    onSuccess: () => {
      message.success("Service updated successfully");
      queryClient.invalidateQueries(["services"]);
      setEditOpen(false);
      editForm.resetFields();
    },
    onError: (err) => {
      message.error(err.response?.data?.message || "Failed to update service");
    },
  });

  /* ─────────────────────────────────────
     DELETE SERVICE
  ───────────────────────────────────── */
  const deleteService = useMutation({
    mutationFn: (id) =>
      _axios.delete(`/api/portal/v1/booking/services/${id}/`),
    onSuccess: () => {
      message.success("Service deleted");
      queryClient.invalidateQueries(["services"]);
    },
    onError: (err) => {
      message.error(err.response?.data?.message || "Failed to delete service");
    },
  });

  /* ─────────────────────────────────────
     CREATE CATEGORY
     POST /api/portal/v1/booking/service-categories/
  ───────────────────────────────────── */
  const createCategory = useMutation({
    mutationFn: (data) =>
      _axios.post("/api/portal/v1/booking/service-categories/", data),
    onSuccess: () => {
      message.success("Category created");
      queryClient.invalidateQueries(["service-categories"]);
      setAddCatOpen(false);
      addCatForm.resetFields();
    },
    onError: (err) => {
      message.error(err.response?.data?.message || "Failed to create category");
    },
  });

  /* ─────────────────────────────────────
     UPDATE CATEGORY
     PATCH /api/portal/v1/booking/service-categories/{id}/
  ───────────────────────────────────── */
  const updateCategory = useMutation({
    mutationFn: (data) =>
      _axios.patch(`/api/portal/v1/booking/service-categories/${data.id}/`, { name: data.name, description: data.description ?? "" }),
    onSuccess: () => {
      message.success("Category updated");
      queryClient.invalidateQueries(["service-categories"]);
      setEditCatOpen(false);
      editCatForm.resetFields();
    },
    onError: (err) => {
      message.error(err.response?.data?.message || "Failed to update category");
    },
  });

  /* ─────────────────────────────────────
     DELETE CATEGORY
     DELETE /api/portal/v1/booking/service-categories/{id}/
  ───────────────────────────────────── */
  const deleteCategory = useMutation({
    mutationFn: (id) =>
      _axios.delete(`/api/portal/v1/booking/service-categories/${id}/`),
    onSuccess: () => {
      message.success("Category deleted");
      queryClient.invalidateQueries(["service-categories"]);
      setActiveCat("all");
    },
    onError: (err) => {
      message.error(err.response?.data?.message || "Failed to delete category");
    },
  });

  /* ─────────────────────────────────────
     OPEN EDIT CATEGORY MODAL
  ───────────────────────────────────── */
  const handleEditCategory = (cat) => {
    setEditCategory(cat);
    editCatForm.setFieldsValue({ name: cat.name, description: cat.description ?? "" });
    setEditCatOpen(true);
  };

  /* ─────────────────────────────────────
     CONFIRM DELETE CATEGORY
  ───────────────────────────────────── */
  const handleDeleteCategory = (cat) => {
    const count = servicesData.filter((s) => String(s.category) === String(cat.id)).length;
    Modal.confirm({
      title: `Delete "${cat.name}"?`,
      content: count > 0
        ? `This category has ${count} service${count !== 1 ? "s" : ""}. Deleting it will not remove those services, but they will become uncategorised.`
        : "Are you sure you want to delete this category?",
      okText: "Delete",
      okButtonProps: { danger: true },
      cancelText: "Cancel",
      centered: true,
      onOk: () => deleteCategory.mutate(cat.id),
    });
  };

  /* ─────────────────────────────────────
     OPEN EDIT MODAL
  ───────────────────────────────────── */
  const handleEdit = (service) => {
    setEditService(service);
    const priceVal = parseFloat(service.price);
    const priceType = service.price_type || (priceVal === 0 ? "free" : "fixed");
    editForm.setFieldsValue({
      name:        service.name,
      description: service.description,
      duration:    service.duration,
      price:       priceType === "free" ? undefined : priceVal,
      price_type:  priceType,
      is_active:   service.is_active,
      category:    service.category ?? undefined,
      // Pre-populate assigned staff from the API response field
      staff_ids:   service.assigned_staff_ids ?? service.staff_ids ?? [],
    });
    setEditOpen(true);
  };

  /* ─────────────────────────────────────
     CONFIRM DELETE
  ───────────────────────────────────── */
  const handleDelete = (id) => {
    Modal.confirm({
      title: "Delete Service",
      content: "Are you sure you want to delete this service? This cannot be undone.",
      okText: "Delete",
      okButtonProps: { danger: true },
      cancelText: "Cancel",
      centered: true,
      onOk: () => deleteService.mutate(id),
    });
  };

  /* ─────────────────────────────────────
     STATS
  ───────────────────────────────────── */
  const totalServices  = servicesData.length;
  const activeServices = servicesData.filter((s) => s.is_active).length;

  /* ═══════════════════════════════════
     RENDER
  ═══════════════════════════════════ */
  return (
    <div>

      {/* ──────────────────────────────────
          PAGE HEADER
      ────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">

        {/* Left: title + stats */}
        <div>
          <h2
            className="text-xl font-semibold text-[#272727]"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Services
          </h2>
          <p
            className="text-sm text-[#987554] mt-0.5"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            {totalServices} service{totalServices !== 1 ? "s" : ""} · {activeServices} active
          </p>
        </div>

        {/* Right: search + add button */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">

          {/* Search bar */}
          <div
            className="flex items-center gap-2 px-4 py-2.5 rounded-full"
            style={{
              background: "#FDFAF5",
              border: "1px solid rgba(187,161,79,0.25)",
              boxShadow: "0 1px 6px rgba(39,39,39,0.05)",
            }}
          >
            <FiSearch size={14} style={{ color: "#987554" }} />
            <input
              placeholder="Search services…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent outline-none text-sm text-[#272727] placeholder-[#b5a47a] w-40"
              style={{ fontFamily: "'Poppins', sans-serif" }}
            />
          </div>

          {/* Add service button */}
          <button
            onClick={() => setAddOpen(true)}
            className="flex cursor-pointer items-center justify-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium text-white transition-all duration-200 hover:opacity-90 hover:shadow-lg"
            style={{
              background: "linear-gradient(135deg, #BBA14F, #987554)",
              fontFamily: "'Poppins', sans-serif",
              boxShadow: "0 4px 14px rgba(187,161,79,0.3)",
            }}
          >
            <FiPlus />
            Add Service
          </button>
        </div>
      </div>

      {/* ──────────────────────────────────
          LOADING STATE
      ────────────────────────────────── */}
      {isLoading ? (
        <div
          className="flex flex-col items-center justify-center h-48 rounded-2xl gap-3"
          style={{
            background: "#FDFAF5",
            border: "1px dashed rgba(187,161,79,0.3)",
            fontFamily: "'Poppins', sans-serif",
            color: "#987554",
          }}
        >
          <FiScissors
            size={28}
            style={{ color: "#BBA14F", opacity: 0.5, animation: "spin 1.4s linear infinite" }}
          />
          <p className="text-sm">Loading services…</p>
        </div>

      ) : (
        /* ──────────────────────────────────
            TWO-PANEL LAYOUT
            Left  = independently scrollable category sidebar
            Right = independently scrollable service groups
        ────────────────────────────────── */
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>

          {/* ── LEFT SIDEBAR: Category list ── */}
          <div
            className="sp-scroll"
            style={{
              width: 220,
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              gap: 6,
              position: "sticky",
              top: 16,
              alignSelf: "flex-start",
              paddingRight: 4,
            }}
          >
            {/* Sidebar header + Add Category button */}
            <div
              className="flex items-center justify-between px-1 pb-3 mb-1"
              style={{ borderBottom: "1px solid rgba(187,161,79,0.18)" }}
            >
              <div className="flex items-center gap-2">
                <FiLayers size={14} style={{ color: "#BBA14F" }} />
                <span
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "#987554", fontFamily: "'Poppins', sans-serif" }}
                >
                  Categories
                </span>
              </div>
              <Tooltip title="Add category" placement="right">
                <button
                  onClick={() => setAddCatOpen(true)}
                  className="flex items-center justify-center w-6 h-6 rounded-full transition-all duration-200 hover:opacity-80"
                  style={{
                    background: "linear-gradient(135deg, #BBA14F, #987554)",
                    color: "#fff",
                    border: "none",
                  }}
                >
                  <FiPlus size={12} />
                </button>
              </Tooltip>
            </div>

            {/* "All" pill */}
            <button
              onClick={() => setActiveCat("all")}
              className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-sm text-left transition-all duration-200"
              style={{
                fontFamily: "'Poppins', sans-serif",
                background: activeCat === "all"
                  ? "linear-gradient(135deg, #BBA14F, #987554)"
                  : "transparent",
                color: activeCat === "all" ? "#fff" : "#7a6030",
                fontWeight: activeCat === "all" ? 600 : 400,
                border: activeCat === "all"
                  ? "none"
                  : "1px solid rgba(187,161,79,0.15)",
              }}
            >
              <span className="flex items-center gap-2">
                <FiScissors size={13} />
                All Services
              </span>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                style={{
                  background: activeCat === "all" ? "rgba(255,255,255,0.25)" : "rgba(187,161,79,0.15)",
                  color: activeCat === "all" ? "#fff" : "#987554",
                }}
              >
                {servicesData.length}
              </span>
            </button>

            {/* One row per category */}
            {sidebarCategories.map((cat) => {
              const count    = servicesData.filter((s) => String(s.category) === String(cat.id)).length;
              const isActive = String(activeCat) === String(cat.id);
              return (
                <div
                  key={cat.id}
                  className="group flex items-center gap-1 rounded-xl transition-all duration-200"
                  style={{
                    background: isActive
                      ? "linear-gradient(135deg, #BBA14F, #987554)"
                      : "transparent",
                    border: isActive ? "none" : "1px solid rgba(187,161,79,0.15)",
                  }}
                >
                  {/* Clickable label area */}
                  <button
                    onClick={() => setActiveCat(String(cat.id))}
                    className="flex items-center justify-between flex-1 min-w-0 px-3 py-2.5 text-sm text-left"
                    style={{
                      fontFamily: "'Poppins', sans-serif",
                      color: isActive ? "#fff" : "#7a6030",
                      fontWeight: isActive ? 600 : 400,
                      background: "transparent",
                      border: "none",
                    }}
                  >
                    <span className="flex items-center gap-2 min-w-0 truncate">
                      <FiTag size={12} style={{ flexShrink: 0 }} />
                      <span className="truncate">{cat.name}</span>
                    </span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ml-1"
                      style={{
                        background: isActive ? "rgba(255,255,255,0.25)" : "rgba(187,161,79,0.15)",
                        color: isActive ? "#fff" : "#987554",
                      }}
                    >
                      {count}
                    </span>
                  </button>

                  {/* Edit / Delete actions — visible on hover */}
                  <div
                    className="flex items-center gap-0.5 pr-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0"
                  >
                    <Tooltip title="Edit category" placement="top">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEditCategory(cat); }}
                        className="w-6 h-6 rounded-full flex items-center justify-center transition-all duration-150 hover:opacity-80"
                        style={{
                          background: isActive ? "rgba(255,255,255,0.2)" : "rgba(187,161,79,0.15)",
                          color: isActive ? "#fff" : "#987554",
                          border: "none",
                        }}
                      >
                        <FiEdit2 size={10} />
                      </button>
                    </Tooltip>
                    <Tooltip title="Delete category" placement="top">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat); }}
                        disabled={deleteCategory.isPending}
                        className="w-6 h-6 rounded-full flex items-center justify-center transition-all duration-150 hover:opacity-80 disabled:opacity-40"
                        style={{
                          background: isActive ? "rgba(255,255,255,0.2)" : "rgba(200,50,50,0.1)",
                          color: isActive ? "#fff" : "#c43232",
                          border: "none",
                        }}
                      >
                        <FiTrash2 size={10} />
                      </button>
                    </Tooltip>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── RIGHT PANEL: grouped services ── */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 28 }}>

            {filtered.length === 0 ? (
              /* Empty state */
              <div
                className="flex flex-col items-center justify-center h-48 rounded-2xl gap-2"
                style={{
                  background: "#FDFAF5",
                  border: "1px dashed rgba(187,161,79,0.35)",
                  fontFamily: "'Poppins', sans-serif",
                  color: "#987554",
                }}
              >
                <FiScissors size={28} style={{ color: "#BBA14F", opacity: 0.4 }} />
                <p className="text-sm">
                  {search ? `No services matching "${search}"` : "No services yet. Add your first one!"}
                </p>
              </div>
            ) : (
              groupedServices.map((group) => (
                <section key={group.key}>

                  {/* ── Category section header ── */}
                  <div
                    className="flex items-center gap-3 mb-4"
                    style={{ borderBottom: "2px solid rgba(187,161,79,0.2)", paddingBottom: 10 }}
                  >
                    {/* Coloured accent dot */}
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 10,
                        background: "linear-gradient(135deg, rgba(187,161,79,0.2), rgba(152,117,84,0.12))",
                        border: "1px solid rgba(187,161,79,0.3)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <FiTag size={14} style={{ color: "#BBA14F" }} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3
                        style={{
                          fontFamily: "'Playfair Display', serif",
                          fontSize: 16,
                          fontWeight: 700,
                          color: "#272727",
                          margin: 0,
                          lineHeight: 1.2,
                        }}
                      >
                        {group.name}
                      </h3>
                    </div>

                    {/* Service count badge */}
                    <span
                      className="px-3 py-1 rounded-full text-xs font-semibold shrink-0"
                      style={{
                        background: "linear-gradient(135deg, rgba(187,161,79,0.18), rgba(152,117,84,0.1))",
                        color: "#7a6030",
                        border: "1px solid rgba(187,161,79,0.25)",
                        fontFamily: "'Poppins', sans-serif",
                      }}
                    >
                      {group.services.length} service{group.services.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* ── Services grid under this category ── */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {group.services.map((service) => (
                      <ServiceCard
                        key={service.id}
                        service={service}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        deleting={deleteService.isPending}
                        staffData={staffData}
                      />
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────
          ADD SERVICE MODAL
      ────────────────────────────────── */}
      <Modal
        open={addOpen}
        onCancel={() => { setAddOpen(false); addForm.resetFields(); }}
        footer={null}
        centered
        width={580}
        closable={false}
        styles={{
          content: { padding: 0, borderRadius: 20, overflow: "hidden" },
          mask: { backdropFilter: "blur(4px)", background: "rgba(39,39,39,0.45)" },
        }}
      >
        {/* ── Luxury banner header ── */}
        <div
          className="relative overflow-hidden px-7 pt-7 pb-6"
          style={{
            background: "linear-gradient(120deg, #272727 0%, #3a2e1e 60%, #4a3a22 100%)",
          }}
        >
          {/* dot grid decoration */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(circle, rgba(187,161,79,0.18) 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          />
          {/* glow */}
          <div
            className="absolute right-0 top-0 h-full w-1/2 pointer-events-none"
            style={{
              background: "radial-gradient(circle at 80% 50%, rgba(187,161,79,0.15), transparent 70%)",
            }}
          />

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* icon badge */}
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                style={{
                  background: "linear-gradient(135deg, #BBA14F, #987554)",
                  boxShadow: "0 4px 14px rgba(187,161,79,0.4)",
                }}
              >
                <FiScissors size={20} color="#fff" />
              </div>
              <div>
                <p
                  className="text-[10px] uppercase tracking-[0.2em] mb-0.5"
                  style={{ color: "#BBA14F", fontFamily: "'Poppins', sans-serif" }}
                >
                  New Service
                </p>
                <h3
                  className="text-lg font-bold text-white leading-none"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  Add Service
                </h3>
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={() => { setAddOpen(false); addForm.resetFields(); }}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 hover:opacity-70"
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "#fff",
                cursor: "pointer",
                fontSize: 16,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* ── Form body ── */}
        <div className="px-7 py-6" style={{ background: "#FDFAF5" }}>
          <Form
            form={addForm}
            layout="vertical"
            onFinish={(values) => createService.mutate(values)}
            initialValues={{ is_active: true, price_type: "fixed", staff_ids: [] }}
          >
            <ServiceFormFields
              categoryOptions={categoryOptions}
              categoriesLoading={categoriesLoading}
              staffList={staffData}
              staffLoading={staffLoading}
            />

            {/* ── Footer ── */}
            <div
              className="flex items-center justify-between mt-6 pt-5"
              style={{ borderTop: "1px solid rgba(187,161,79,0.18)" }}
            >
              <p
                className="text-[11px] text-[#b5a47a]"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                Fields marked <span style={{ color: "#c43232" }}>*</span> are required
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setAddOpen(false); addForm.resetFields(); }}
                  className="px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:opacity-80"
                  style={{
                    background: "rgba(187,161,79,0.1)",
                    color: "#987554",
                    border: "1px solid rgba(187,161,79,0.25)",
                    fontFamily: "'Poppins', sans-serif",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={createService.isPending}
                  className="rounded-full! px-6! font-medium! text-sm!"
                  style={{
                    background: "linear-gradient(135deg, #BBA14F, #987554)",
                    border: "none",
                    fontFamily: "'Poppins', sans-serif",
                    boxShadow: "0 4px 14px rgba(187,161,79,0.35)",
                    height: 36,
                  }}
                >
                  ✦ Create Service
                </Button>
              </div>
            </div>
          </Form>
        </div>
      </Modal>

      {/* ──────────────────────────────────
          EDIT SERVICE MODAL
      ────────────────────────────────── */}
      <Modal
        open={editOpen}
        onCancel={() => { setEditOpen(false); editForm.resetFields(); }}
        footer={null}
        centered
        width={580}
        closable={false}
        styles={{
          content: { padding: 0, borderRadius: 20, overflow: "hidden" },
          mask: { backdropFilter: "blur(4px)", background: "rgba(39,39,39,0.45)" },
        }}
      >
        {/* ── Luxury banner header ── */}
        <div
          className="relative overflow-hidden px-7 pt-7 pb-6"
          style={{
            background: "linear-gradient(120deg, #272727 0%, #3a2e1e 60%, #4a3a22 100%)",
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(circle, rgba(187,161,79,0.18) 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          />
          <div
            className="absolute right-0 top-0 h-full w-1/2 pointer-events-none"
            style={{
              background: "radial-gradient(circle at 80% 50%, rgba(187,161,79,0.15), transparent 70%)",
            }}
          />

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                style={{
                  background: "linear-gradient(135deg, #987554, #6b4f30)",
                  boxShadow: "0 4px 14px rgba(152,117,84,0.4)",
                }}
              >
                <FiScissors size={20} color="#fff" />
              </div>
              <div>
                <p
                  className="text-[10px] uppercase tracking-[0.2em] mb-0.5"
                  style={{ color: "#BBA14F", fontFamily: "'Poppins', sans-serif" }}
                >
                  Edit Service
                </p>
                <h3
                  className="text-lg font-bold text-white leading-none"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  {editService?.name || "Edit Service"}
                </h3>
              </div>
            </div>

            <button
              onClick={() => { setEditOpen(false); editForm.resetFields(); }}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 hover:opacity-70"
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "#fff",
                cursor: "pointer",
                fontSize: 16,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* ── Form body ── */}
        <div className="px-7 py-6" style={{ background: "#FDFAF5" }}>
          <Form
            form={editForm}
            layout="vertical"
            onFinish={(values) => updateService.mutate({ id: editService?.id, ...values })}
          >
            <ServiceFormFields
              categoryOptions={categoryOptions}
              categoriesLoading={categoriesLoading}
              staffList={staffData}
              staffLoading={staffLoading}
            />

            {/* ── Footer ── */}
            <div
              className="flex items-center justify-between mt-6 pt-5"
              style={{ borderTop: "1px solid rgba(187,161,79,0.18)" }}
            >
              <p
                className="text-[11px] text-[#b5a47a]"
                style={{ fontFamily: "'Poppins', sans-serif" }}
              >
                Fields marked <span style={{ color: "#c43232" }}>*</span> are required
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setEditOpen(false); editForm.resetFields(); }}
                  className="px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:opacity-80"
                  style={{
                    background: "rgba(187,161,79,0.1)",
                    color: "#987554",
                    border: "1px solid rgba(187,161,79,0.25)",
                    fontFamily: "'Poppins', sans-serif",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={updateService.isPending}
                  className="rounded-full! px-6! font-medium! text-sm!"
                  style={{
                    background: "linear-gradient(135deg, #BBA14F, #987554)",
                    border: "none",
                    fontFamily: "'Poppins', sans-serif",
                    boxShadow: "0 4px 14px rgba(187,161,79,0.35)",
                    height: 36,
                  }}
                >
                  ✦ Save Changes
                </Button>
              </div>
            </div>
          </Form>
        </div>
      </Modal>

      {/* ──────────────────────────────────
          ADD CATEGORY MODAL
          POST /api/portal/v1/booking/service-categories/
      ────────────────────────────────── */}
      <Modal
        title={modalTitle("Add Category")}
        open={addCatOpen}
        onCancel={() => { setAddCatOpen(false); addCatForm.resetFields(); }}
        footer={null}
        centered
        style={{ borderRadius: 16 }}
      >
        <Form
          form={addCatForm}
          layout="vertical"
          onFinish={(values) => createCategory.mutate(values)}
          className="pt-3"
        >
          <CategoryFormFields />
          <Form.Item className="mt-5 mb-0">
            <div className="flex justify-end gap-3">
              <Button onClick={() => { setAddCatOpen(false); addCatForm.resetFields(); }}>
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={createCategory.isPending}
                className={GOLD_BTN}
              >
                Create Category
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* ──────────────────────────────────
          EDIT CATEGORY MODAL
          PATCH /api/portal/v1/booking/service-categories/{id}/
      ────────────────────────────────── */}
      <Modal
        title={modalTitle("Edit Category")}
        open={editCatOpen}
        onCancel={() => { setEditCatOpen(false); editCatForm.resetFields(); }}
        footer={null}
        centered
        style={{ borderRadius: 16 }}
      >
        <Form
          form={editCatForm}
          layout="vertical"
          onFinish={(values) => updateCategory.mutate({ id: editCategory?.id, ...values })}
          className="pt-3"
        >
          <CategoryFormFields />
          <Form.Item className="mt-5 mb-0">
            <div className="flex justify-end gap-3">
              <Button onClick={() => { setEditCatOpen(false); editCatForm.resetFields(); }}>
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={updateCategory.isPending}
                className={GOLD_BTN}
              >
                Save Changes
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
