/**
 * SchedulePage
 * ────────────
 * Manage staff availability schedules.
 * Each schedule entry covers one day of the week with a start/end time
 * and an is_available flag.
 *
 * GET  /api/portal/v1/booking/schedules/          → list (filtered by ?staff=id)
 * POST /api/portal/v1/booking/schedules/          → create
 * GET  /api/portal/v1/booking/schedules/{id}/     → detail
 * PATCH   /api/portal/v1/booking/schedules/{id}/  → update
 * DELETE  /api/portal/v1/booking/schedules/{id}/  → remove
 */

import React, { useState, useMemo } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Modal,
  Form,
  Select,
  TimePicker,
  Switch,
  Input,
  message,
  Tooltip,
} from "antd";
import {
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiClock,
  FiUser,
  FiAlertCircle,
  FiCheckCircle,
  FiGrid,
  FiList,
} from "react-icons/fi";
import dayjs from "dayjs";
import _axios from "../src/api/_axios";

/* ── Palette ── */
const GOLD   = "#BBA14F";
const BROWN  = "#987554";
const DARK   = "#272727";
const MID    = "#987554";
const BORDER = "rgba(187,161,79,0.2)";
const CREAM  = "#FDFAF5";

/* ── Days of week — 0 = Monday … 6 = Sunday (ISO) ── */
const DAYS = [
  { value: 0, short: "Mon", full: "Monday" },
  { value: 1, short: "Tue", full: "Tuesday" },
  { value: 2, short: "Wed", full: "Wednesday" },
  { value: 3, short: "Thu", full: "Thursday" },
  { value: 4, short: "Fri", full: "Friday" },
  { value: 5, short: "Sat", full: "Saturday" },
  { value: 6, short: "Sun", full: "Sunday" },
];

const TIME_FORMAT = "HH:mm";

/* ── Parse "HH:mm:ss" or "HH:mm" → dayjs ── */
function parsetime(str) {
  if (!str) return null;
  const [h, m] = str.split(":").map(Number);
  return dayjs().hour(h).minute(m).second(0);
}

/* ── Format dayjs → "HH:mm:ss" ── */
function fmtTime(dj) {
  return dj ? dj.format("HH:mm:ss") : null;
}

/* ── Avatar (shared gradient logic) ── */
const GRAD_PAIRS = [
  ["#BBA14F", "#987554"],
  ["#4f7aa8", "#2d5a84"],
  ["#7a4fa8", "#5a2d84"],
  ["#4fa87a", "#2d845a"],
  ["#a87a4f", "#845a2d"],
];
function StaffAvatar({ name = "?", size = 34 }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] || "")
    .join("")
    .toUpperCase();
  const [from, to] = GRAD_PAIRS[(name.charCodeAt(0) || 0) % GRAD_PAIRS.length];
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%",
        background: `linear-gradient(135deg, ${from}, ${to})`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Poppins', sans-serif", fontWeight: 700,
        fontSize: size * 0.34, color: "#fff", flexShrink: 0,
        boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
      }}
    >
      {initials}
    </div>
  );
}

/* ── Availability pill ── */
function AvailPill({ available }) {
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 3,
        padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700,
        fontFamily: "'Poppins', sans-serif",
        background: available ? "rgba(34,160,80,0.1)" : "rgba(200,50,50,0.08)",
        color: available ? "#1a8a40" : "#c43232",
        border: `1px solid ${available ? "rgba(34,160,80,0.2)" : "rgba(200,50,50,0.15)"}`,
      }}
    >
      {available
        ? <><FiCheckCircle size={9} /> Available</>
        : <><FiAlertCircle size={9} /> Unavailable</>}
    </span>
  );
}

/* ─────────────────────────────────────────────
   ROSTER CHIP — compact time pill for roster cells
───────────────────────────────────────────── */
function RosterChip({ entry, onEdit, onDelete, deleting }) {
  const [hov, setHov] = useState(false);
  const avail = entry.is_available;
  const start = entry.start_time?.slice(0, 5) ?? "";
  const end   = entry.end_time?.slice(0, 5)   ?? "";
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "3px 8px 3px 7px", borderRadius: 7, cursor: "default",
        background: avail ? "rgba(34,160,80,0.09)" : "rgba(200,50,50,0.07)",
        border: `1px solid ${avail ? "rgba(34,160,80,0.22)" : "rgba(200,50,50,0.18)"}`,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4,
      }}
    >
      <span style={{ fontSize: 10, fontWeight: 700, color: avail ? "#1a8a40" : "#c43232", fontFamily: "'Poppins', sans-serif", whiteSpace: "nowrap" }}>
        {start}–{end}
      </span>
      {hov && (
        <div style={{ display: "flex", gap: 1, flexShrink: 0 }}>
          <button onClick={() => onEdit(entry)} title="Edit" style={{ background: "none", border: "none", cursor: "pointer", padding: "1px 2px", color: BROWN, display: "flex", alignItems: "center" }}>
            <FiEdit2 size={9} />
          </button>
          <button onClick={() => onDelete(entry)} title="Remove" disabled={deleting === entry.id} style={{ background: "none", border: "none", cursor: "pointer", padding: "1px 2px", color: "#c43232", display: "flex", alignItems: "center", opacity: deleting === entry.id ? 0.4 : 1 }}>
            <FiTrash2 size={9} />
          </button>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   SCHEDULE ENTRY CARD
───────────────────────────────────────────── */
function ScheduleCard({ entry, onEdit, onDelete, deleting }) {
  const start = entry.start_time?.slice(0, 5) ?? "—";
  const end   = entry.end_time?.slice(0, 5)   ?? "—";

  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 10,
        background: entry.is_available ? "#FDFAF5" : "rgba(200,50,50,0.03)",
        border: `1px solid ${entry.is_available ? BORDER : "rgba(200,50,50,0.15)"}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 8, transition: "box-shadow 0.15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 3px 12px rgba(187,161,79,0.12)")}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
    >
      {/* Time range + badge */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <FiClock size={11} color={GOLD} />
          <span
            style={{
              fontSize: 13, fontWeight: 700, color: DARK,
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            {start} – {end}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <AvailPill available={entry.is_available} />
          {entry.notes && (
            <span
              style={{
                fontSize: 10, color: MID, fontFamily: "'Poppins', sans-serif",
                maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}
            >
              {entry.notes}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        <Tooltip title="Edit">
          <button
            onClick={() => onEdit(entry)}
            style={{
              width: 28, height: 28, borderRadius: 8, border: `1px solid ${BORDER}`,
              background: "rgba(187,161,79,0.08)", color: BROWN,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <FiEdit2 size={12} />
          </button>
        </Tooltip>
        <Tooltip title="Delete">
          <button
            onClick={() => onDelete(entry)}
            disabled={deleting === entry.id}
            style={{
              width: 28, height: 28, borderRadius: 8,
              border: "1px solid rgba(200,50,50,0.2)",
              background: "rgba(200,50,50,0.06)", color: "#c43232",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", opacity: deleting === entry.id ? 0.5 : 1,
            }}
          >
            <FiTrash2 size={12} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   DAY COLUMN
───────────────────────────────────────────── */
function DayColumn({ day, entries = [], onAdd, onEdit, onDelete, deleting }) {
  const isWeekend = day.value >= 5;
  return (
    <div
      style={{
        borderRadius: 16,
        border: `1px solid ${isWeekend ? "rgba(187,161,79,0.28)" : BORDER}`,
        background: isWeekend ? "rgba(187,161,79,0.03)" : CREAM,
        overflow: "hidden",
        display: "flex", flexDirection: "column",
      }}
    >
      {/* Day header */}
      <div
        style={{
          padding: "10px 14px",
          background: isWeekend
            ? "linear-gradient(90deg, rgba(187,161,79,0.15), rgba(152,117,84,0.08))"
            : "linear-gradient(90deg, rgba(187,161,79,0.08), rgba(152,117,84,0.03))",
          borderBottom: `1px solid ${BORDER}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}
      >
        <div>
          <p
            style={{
              margin: 0, fontFamily: "'Poppins', sans-serif",
              fontSize: 13, fontWeight: 700, color: DARK, lineHeight: 1.2,
            }}
          >
            {day.full}
          </p>
          <p
            style={{
              margin: 0, fontFamily: "'Poppins', sans-serif",
              fontSize: 10, color: MID,
            }}
          >
            {entries.length} slot{entries.length !== 1 ? "s" : ""}
          </p>
        </div>

        <Tooltip title="Add slot">
          <button
            onClick={() => onAdd(day.value)}
            style={{
              width: 26, height: 26, borderRadius: 8,
              border: `1px solid ${GOLD}`,
              background: "rgba(187,161,79,0.1)", color: GOLD,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(187,161,79,0.2)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(187,161,79,0.1)")}
          >
            <FiPlus size={13} />
          </button>
        </Tooltip>
      </div>

      {/* Entries */}
      <div style={{ padding: "10px 10px", flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
        {entries.length === 0 ? (
          <div
            style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              padding: "20px 8px", gap: 6,
            }}
          >
            <FiClock size={22} color="rgba(187,161,79,0.3)" />
            <p
              style={{
                margin: 0, fontSize: 11, color: "rgba(152,117,84,0.5)",
                fontFamily: "'Poppins', sans-serif", textAlign: "center",
              }}
            >
              No schedule
            </p>
          </div>
        ) : (
          entries
            .slice()
            .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""))
            .map((entry) => (
              <ScheduleCard
                key={entry.id}
                entry={entry}
                onEdit={onEdit}
                onDelete={onDelete}
                deleting={deleting}
              />
            ))
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   ADD / EDIT MODAL
───────────────────────────────────────────── */
function ScheduleModal({ open, onClose, staffId, prefillDay, editEntry, isPending, onSubmit }) {
  const [form] = Form.useForm();

  React.useEffect(() => {
    if (!open) return;
    if (editEntry) {
      form.setFieldsValue({
        day_of_week:  editEntry.day_of_week,
        start_time:   parsetime(editEntry.start_time),
        end_time:     parsetime(editEntry.end_time),
        is_available: editEntry.is_available ?? true,
        notes:        editEntry.notes || "",
      });
    } else {
      form.setFieldsValue({
        day_of_week:  prefillDay ?? 0,
        start_time:   dayjs().hour(9).minute(0).second(0),
        end_time:     dayjs().hour(17).minute(0).second(0),
        is_available: true,
        notes:        "",
      });
    }
  }, [open, editEntry, prefillDay, form]);

  const handleFinish = (vals) => {
    onSubmit({
      staff:        staffId,
      day_of_week:  vals.day_of_week,
      start_time:   fmtTime(vals.start_time),
      end_time:     fmtTime(vals.end_time),
      is_available: vals.is_available,
      notes:        vals.notes || "",
    });
  };

  const labelStyle = {
    fontSize: 11, fontWeight: 700, color: MID,
    fontFamily: "'Poppins', sans-serif",
    textTransform: "uppercase", letterSpacing: "0.05em",
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      destroyOnClose
      width={420}
      styles={{ content: { borderRadius: 20, padding: 0, overflow: "hidden" } }}
    >
      {/* Header */}
      <div
        style={{
          padding: "22px 28px 18px",
          background: "linear-gradient(135deg, #272727 0%, #3a2a1a 100%)",
          display: "flex", alignItems: "center", gap: 14,
        }}
      >
        <div
          style={{
            width: 40, height: 40, borderRadius: 12,
            background: "linear-gradient(135deg, #BBA14F, #987554)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 14px rgba(187,161,79,0.35)",
          }}
        >
          <FiClock size={18} color="#fff" />
        </div>
        <div>
          <p
            style={{
              margin: 0, fontSize: 10, color: "rgba(187,161,79,0.7)",
              fontFamily: "'Poppins', sans-serif", textTransform: "uppercase", letterSpacing: "0.12em",
            }}
          >
            {editEntry ? "Edit Slot" : "New Slot"}
          </p>
          <h3
            style={{
              margin: 0, fontFamily: "'Playfair Display', serif",
              fontSize: 18, color: "#fff",
            }}
          >
            {editEntry ? "Update Schedule" : "Add Schedule"}
          </h3>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "22px 28px 24px", background: CREAM }}>
        <Form form={form} layout="vertical" onFinish={handleFinish}>
          {/* Day */}
          <Form.Item
            name="day_of_week"
            label={<span style={labelStyle}>Day of week</span>}
            rules={[{ required: true }]}
          >
            <Select
              options={DAYS.map((d) => ({ value: d.value, label: d.full }))}
              placeholder="Select day…"
            />
          </Form.Item>

          {/* Time row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Form.Item
              name="start_time"
              label={<span style={labelStyle}>Start time</span>}
              rules={[{ required: true, message: "Required" }]}
              style={{ margin: 0 }}
            >
              <TimePicker format={TIME_FORMAT} minuteStep={15} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item
              name="end_time"
              label={<span style={labelStyle}>End time</span>}
              rules={[
                { required: true, message: "Required" },
                ({ getFieldValue }) => ({
                  validator(_, val) {
                    const start = getFieldValue("start_time");
                    if (!val || !start) return Promise.resolve();
                    return val.isAfter(start)
                      ? Promise.resolve()
                      : Promise.reject(new Error("Must be after start"));
                  },
                }),
              ]}
              style={{ margin: 0 }}
            >
              <TimePicker format={TIME_FORMAT} minuteStep={15} style={{ width: "100%" }} />
            </Form.Item>
          </div>

          {/* Available toggle */}
          <Form.Item
            name="is_available"
            label={<span style={labelStyle}>Available</span>}
            valuePropName="checked"
            style={{ marginTop: 16, marginBottom: 12 }}
          >
            <Switch
              checkedChildren="Available"
              unCheckedChildren="Unavailable"
              style={{ background: undefined }}
            />
          </Form.Item>

          {/* Notes */}
          <Form.Item
            name="notes"
            label={<span style={labelStyle}>Notes (optional)</span>}
            style={{ marginBottom: 20 }}
          >
            <Input.TextArea
              rows={2}
              placeholder="e.g. Lunch break, split shift…"
              style={{ borderRadius: 10, resize: "none" }}
            />
          </Form.Item>

          {/* Footer */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "9px 20px", borderRadius: 10,
                border: `1px solid ${BORDER}`, background: "transparent",
                color: BROWN, fontSize: 13, fontFamily: "'Poppins', sans-serif",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              style={{
                padding: "9px 24px", borderRadius: 10, border: "none",
                background: `linear-gradient(135deg, ${GOLD}, ${BROWN})`,
                color: "#fff", fontSize: 13, fontWeight: 700,
                fontFamily: "'Poppins', sans-serif", cursor: "pointer",
                opacity: isPending ? 0.7 : 1,
                boxShadow: "0 4px 14px rgba(187,161,79,0.35)",
              }}
            >
              {isPending ? "Saving…" : editEntry ? "Update" : "Add Slot"}
            </button>
          </div>
        </Form>
      </div>
    </Modal>
  );
}

/* ─────────────────────────────────────────────
   ROSTER VIEW — all staff × all days table
───────────────────────────────────────────── */
function RosterView({ staffList, rosterMap, onAdd, onEdit, onDelete, deleting }) {
  const [hoveredCell, setHoveredCell] = useState(null);

  if (staffList.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", borderRadius: 20, border: `1px dashed ${BORDER}`, background: CREAM }}>
        <FiUser size={36} color="rgba(187,161,79,0.3)" style={{ marginBottom: 12 }} />
        <p style={{ margin: 0, fontSize: 14, color: MID, fontFamily: "'Poppins', sans-serif" }}>No staff members found</p>
      </div>
    );
  }

  return (
    <div style={{ borderRadius: 18, border: `1px solid ${BORDER}`, overflow: "hidden", boxShadow: "0 4px 24px rgba(39,39,39,0.07)", overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 760 }}>
        {/* ── Header ── */}
        <thead>
          <tr>
            <th style={{ width: 190, padding: "14px 16px", textAlign: "left", background: "linear-gradient(135deg,#1c1a15 0%,#272727 100%)", borderBottom: "1px solid rgba(187,161,79,0.18)", position: "sticky", left: 0, zIndex: 3 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <FiUser size={12} color="rgba(187,161,79,0.5)" />
                <span style={{ fontSize: 10, color: "rgba(187,161,79,0.55)", fontFamily: "'Poppins', sans-serif", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700 }}>Team Member</span>
              </div>
            </th>
            {DAYS.map((day) => {
              const isWeekend = day.value >= 5;
              return (
                <th key={day.value} style={{ padding: "14px 10px", textAlign: "center", minWidth: 118, background: isWeekend ? "linear-gradient(135deg,#26200e,#3a2a14)" : "linear-gradient(135deg,#1c1a15 0%,#272727 100%)", borderBottom: "1px solid rgba(187,161,79,0.18)", borderLeft: "1px solid rgba(187,161,79,0.1)" }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: isWeekend ? GOLD : "#fff", fontFamily: "'Poppins', sans-serif", letterSpacing: "0.02em" }}>{day.short}</div>
                  <div style={{ fontSize: 9, color: isWeekend ? "rgba(187,161,79,0.55)" : "rgba(255,255,255,0.3)", fontFamily: "'Poppins', sans-serif", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 1 }}>{day.full}</div>
                </th>
              );
            })}
          </tr>
        </thead>

        {/* ── Body ── */}
        <tbody>
          {staffList.map((staff, rowIdx) => {
            const isLast = rowIdx === staffList.length - 1;
            const rowBg  = rowIdx % 2 === 0 ? "#FDFAF5" : "rgba(250,247,240,0.7)";
            return (
              <tr key={staff.id}>
                {/* Staff name — sticky */}
                <td style={{ padding: "10px 14px", background: rowBg, borderBottom: isLast ? "none" : "1px solid rgba(187,161,79,0.09)", borderRight: "1px solid rgba(187,161,79,0.13)", position: "sticky", left: 0, zIndex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <StaffAvatar name={staff.full_name || "?"} size={32} />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: DARK, fontFamily: "'Poppins', sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 114 }}>
                        {staff.full_name || `Staff #${staff.id}`}
                      </p>
                      {staff.email && (
                        <p style={{ margin: 0, fontSize: 9, color: MID, fontFamily: "'Poppins', sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 114 }}>
                          {staff.email}
                        </p>
                      )}
                    </div>
                  </div>
                </td>

                {/* Day cells */}
                {DAYS.map((day) => {
                  const entries   = (rosterMap[staff.id]?.[day.value] || []).slice().sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
                  const cellKey   = `${staff.id}-${day.value}`;
                  const isHovered = hoveredCell === cellKey;
                  const isWeekend = day.value >= 5;
                  return (
                    <td
                      key={day.value}
                      onMouseEnter={() => setHoveredCell(cellKey)}
                      onMouseLeave={() => setHoveredCell(null)}
                      style={{
                        padding: "8px 7px", verticalAlign: "top",
                        background: isWeekend
                          ? (isHovered ? "rgba(187,161,79,0.09)" : "rgba(187,161,79,0.03)")
                          : (isHovered ? "rgba(187,161,79,0.06)" : rowBg),
                        borderBottom: isLast ? "none" : "1px solid rgba(187,161,79,0.09)",
                        borderLeft: "1px solid rgba(187,161,79,0.09)",
                        transition: "background 0.12s",
                        minWidth: 110,
                      }}
                    >
                      {/* Slot chips */}
                      {entries.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 3 }}>
                          {entries.map((entry) => (
                            <RosterChip key={entry.id} entry={entry} onEdit={onEdit} onDelete={onDelete} deleting={deleting} />
                          ))}
                        </div>
                      )}
                      {/* Add button */}
                      <button
                        onClick={() => onAdd(day.value, staff.id)}
                        title={`Add slot — ${staff.full_name}, ${day.full}`}
                        style={{
                          width: "100%",
                          padding: entries.length > 0 ? "2px 0" : "9px 0",
                          borderRadius: 6, cursor: "pointer",
                          border: `1px dashed ${isHovered ? GOLD : "rgba(187,161,79,0.18)"}`,
                          background: isHovered ? "rgba(187,161,79,0.07)" : "transparent",
                          color: isHovered ? GOLD : "rgba(187,161,79,0.28)",
                          fontSize: 10, fontFamily: "'Poppins', sans-serif",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
                          transition: "all 0.15s", marginTop: entries.length > 0 ? 1 : 0,
                        }}
                      >
                        <FiPlus size={9} />
                        {entries.length === 0 && <span>Add slot</span>}
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────── */
export default function SchedulePage() {
  const queryClient = useQueryClient();

  const [viewMode,     setViewMode]     = useState("roster"); // "roster" | "staff"
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [modalOpen,    setModalOpen]    = useState(false);
  const [prefillDay,   setPrefillDay]   = useState(null);
  const [editEntry,    setEditEntry]    = useState(null);
  const [deletingId,   setDeletingId]   = useState(null);
  const [modalStaffId, setModalStaffId] = useState(null); // staff used by the modal

  /* ── Fetch staff ── */
  const { data: staffRaw = [], isLoading: staffLoading } = useQuery({
    queryKey: ["staff"],
    queryFn: () =>
      _axios.get("/api/portal/v1/accounts/staff/").then((r) =>
        Array.isArray(r.data) ? r.data : (r.data?.results ?? [])
      ),
    staleTime: 5 * 60_000,
  });

  /* Auto-select first staff when switching to staff view */
  React.useEffect(() => {
    if (viewMode === "staff" && !selectedStaff && staffRaw.length > 0) {
      setSelectedStaff(staffRaw[0].id);
    }
  }, [staffRaw, selectedStaff, viewMode]);

  /* ── Fetch schedules for selected staff (staff view) ── */
  const { data: schedulesRaw = [], isLoading: schedulesLoading } = useQuery({
    queryKey: ["schedules", selectedStaff],
    queryFn: () =>
      _axios
        .get("/api/portal/v1/booking/schedules/", { params: { staff: selectedStaff } })
        .then((r) => (Array.isArray(r.data) ? r.data : (r.data?.results ?? []))),
    enabled: viewMode === "staff" && !!selectedStaff,
    staleTime: 60_000,
  });

  /* ── Fetch ALL schedules (roster view) ── */
  const { data: allSchedules = [], isLoading: rosterLoading } = useQuery({
    queryKey: ["schedules-all"],
    queryFn: () =>
      _axios
        .get("/api/portal/v1/booking/schedules/")
        .then((r) => (Array.isArray(r.data) ? r.data : (r.data?.results ?? []))),
    enabled: viewMode === "roster",
    staleTime: 60_000,
  });

  /* ── Group by day (staff view) — only the selected staff's entries ── */
  const byDay = useMemo(() => {
    const map = {};
    DAYS.forEach((d) => { map[d.value] = []; });
    schedulesRaw
      .filter((entry) => String(entry.staff) === String(selectedStaff))
      .forEach((entry) => {
        if (map[entry.day_of_week] !== undefined) map[entry.day_of_week].push(entry);
      });
    return map;
  }, [schedulesRaw, selectedStaff]);

  /* ── Flat list of the selected staff's slots (derived from byDay) ── */
  const staffSlots = useMemo(() => Object.values(byDay).flat(), [byDay]);

  /* ── Build roster map: { staffId: { dayValue: [entries] } } ── */
  const rosterMap = useMemo(() => {
    const map = {};
    staffRaw.forEach((s) => {
      map[s.id] = {};
      DAYS.forEach((d) => { map[s.id][d.value] = []; });
    });
    allSchedules.forEach((entry) => {
      if (map[entry.staff]?.[entry.day_of_week] !== undefined) {
        map[entry.staff][entry.day_of_week].push(entry);
      }
    });
    return map;
  }, [staffRaw, allSchedules]);

  /* ── Current staff object ── */
  const currentStaffObj = useMemo(
    () => staffRaw.find((s) => s.id === selectedStaff),
    [staffRaw, selectedStaff]
  );

  /* ── Coverage summary (staff view) ── */
  const coveredDays = useMemo(
    () => DAYS.filter((d) => byDay[d.value]?.some((e) => e.is_available)).length,
    [byDay]
  );

  /* ── Invalidate both query caches after any mutation ── */
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["schedules", selectedStaff] });
    queryClient.invalidateQueries({ queryKey: ["schedules-all"] });
  };

  /* ── Create ── */
  const createSchedule = useMutation({
    mutationFn: (data) => _axios.post("/api/portal/v1/booking/schedules/", data),
    onSuccess: () => {
      message.success("Schedule slot added");
      invalidateAll();
      setModalOpen(false);
    },
    onError: (err) => {
      const detail = err.response?.data;
      message.error(typeof detail === "string" ? detail : JSON.stringify(detail) || "Failed to add slot");
    },
  });

  /* ── Update ── */
  const updateSchedule = useMutation({
    mutationFn: ({ id, ...data }) =>
      _axios.patch(`/api/portal/v1/booking/schedules/${id}/`, data),
    onSuccess: () => {
      message.success("Schedule updated");
      invalidateAll();
      setModalOpen(false);
      setEditEntry(null);
    },
    onError: (err) => {
      const detail = err.response?.data;
      message.error(typeof detail === "string" ? detail : JSON.stringify(detail) || "Failed to update slot");
    },
  });

  /* ── Delete ── */
  const deleteSchedule = useMutation({
    mutationFn: (id) => _axios.delete(`/api/portal/v1/booking/schedules/${id}/`),
    onSuccess: () => {
      message.success("Slot removed");
      invalidateAll();
      setDeletingId(null);
    },
    onError: (err) => {
      message.error(err.response?.data?.message || "Failed to delete slot");
      setDeletingId(null);
    },
  });

  /* ── Handlers ── */
  const handleAdd = (dayValue, staffId) => {
    setEditEntry(null);
    setPrefillDay(dayValue);
    setModalStaffId(staffId ?? selectedStaff);
    setModalOpen(true);
  };

  const handleEdit = (entry) => {
    setEditEntry(entry);
    setPrefillDay(entry.day_of_week);
    setModalStaffId(entry.staff ?? selectedStaff);
    setModalOpen(true);
  };

  const handleDelete = (entry) => {
    Modal.confirm({
      title: "Remove this slot?",
      content: `${DAYS.find((d) => d.value === entry.day_of_week)?.full} · ${entry.start_time?.slice(0, 5)} – ${entry.end_time?.slice(0, 5)}`,
      okText: "Remove",
      okButtonProps: { danger: true },
      cancelText: "Cancel",
      centered: true,
      onOk: () => {
        setDeletingId(entry.id);
        deleteSchedule.mutate(entry.id);
      },
    });
  };

  const handleModalClose = () => { setModalOpen(false); setEditEntry(null); };

  const handleModalSubmit = (data) => {
    if (editEntry) updateSchedule.mutate({ id: editEntry.id, ...data });
    else           createSchedule.mutate(data);
  };

  const isPending  = createSchedule.isPending || updateSchedule.isPending;
  const isLoading  = staffLoading || (viewMode === "staff" ? schedulesLoading : rosterLoading);

  const staffOptions = staffRaw.map((s) => ({
    value: s.id,
    label: s.full_name || s.name || `Staff #${s.id}`,
  }));

  /* ── Stat pills helper ── */
  const StatPill = ({ label, value, color }) => (
    <div style={{ padding: "10px 18px", borderRadius: 12, border: `1px solid ${BORDER}`, background: CREAM, boxShadow: "0 2px 8px rgba(187,161,79,0.06)" }}>
      <p style={{ margin: 0, fontSize: 10, color: MID, fontFamily: "'Poppins', sans-serif", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</p>
      <p style={{ margin: "2px 0 0", fontSize: 20, fontWeight: 700, color, fontFamily: "'Poppins', sans-serif", lineHeight: 1 }}>{value}</p>
    </div>
  );

  return (
    <div style={{ padding: "0 0 40px" }}>

      {/* ── Page header ── */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 22 }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700, color: DARK }}>
            Staff Schedules
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: MID, fontFamily: "'Poppins', sans-serif" }}>
            Set weekly availability for each team member
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* View toggle */}
          <div style={{ display: "flex", borderRadius: 10, border: `1px solid ${BORDER}`, overflow: "hidden", background: CREAM }}>
            {[
              { key: "roster", icon: <FiGrid size={13} />,  label: "Roster" },
              { key: "staff",  icon: <FiList size={13} />,  label: "Staff View" },
            ].map(({ key, icon, label }) => (
              <button
                key={key}
                onClick={() => setViewMode(key)}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "7px 14px", border: "none", cursor: "pointer",
                  fontSize: 12, fontFamily: "'Poppins', sans-serif", fontWeight: 600,
                  background: viewMode === key ? `linear-gradient(135deg,${GOLD},${BROWN})` : "transparent",
                  color: viewMode === key ? "#fff" : MID,
                  transition: "all 0.15s",
                }}
              >
                {icon}{label}
              </button>
            ))}
          </div>

          {/* Staff picker — only in staff view */}
          {viewMode === "staff" && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {currentStaffObj && <StaffAvatar name={currentStaffObj.full_name || "?"} size={36} />}
              <Select
                loading={staffLoading}
                value={selectedStaff}
                onChange={setSelectedStaff}
                options={staffOptions}
                placeholder="Select staff member…"
                showSearch
                filterOption={(input, opt) => (opt?.label || "").toLowerCase().includes(input.toLowerCase())}
                style={{ minWidth: 200 }}
                suffixIcon={<FiUser size={13} color={GOLD} />}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Summary bar ── */}
      {!isLoading && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
          {viewMode === "roster" ? (
            <>
              <StatPill label="Staff members"     value={staffRaw.length}                                         color={GOLD}     />
              <StatPill label="Total slots"        value={allSchedules.length}                                     color={BROWN}    />
              <StatPill label="Available slots"    value={allSchedules.filter((e) => e.is_available).length}       color="#22a050"  />
              <StatPill label="Unavailable slots"  value={allSchedules.filter((e) => !e.is_available).length}      color="#c43232"  />
            </>
          ) : selectedStaff ? (
            <>
              <StatPill label="Total slots"        value={staffSlots.length}                                       color={GOLD}     />
              <StatPill label="Available days"     value={`${coveredDays} / 7`}                                    color="#22a050"  />
              <StatPill label="Unavailable slots"  value={staffSlots.filter((e) => !e.is_available).length}        color="#c43232"  />
            </>
          ) : null}
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {isLoading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
          {DAYS.map((d) => (
            <div key={d.value} style={{ borderRadius: 16, border: `1px solid ${BORDER}`, background: CREAM, height: 180, animation: "pulse 1.5s ease-in-out infinite" }} />
          ))}
        </div>
      )}

      {/* ── Roster view ── */}
      {viewMode === "roster" && !isLoading && (
        <RosterView
          staffList={staffRaw}
          rosterMap={rosterMap}
          onAdd={handleAdd}
          onEdit={handleEdit}
          onDelete={handleDelete}
          deleting={deletingId}
        />
      )}

      {/* ── Staff view ── */}
      {viewMode === "staff" && !isLoading && (
        <>
          {!selectedStaff ? (
            <div style={{ textAlign: "center", padding: "60px 20px", borderRadius: 20, border: `1px dashed ${BORDER}`, background: CREAM }}>
              <FiUser size={36} color="rgba(187,161,79,0.3)" style={{ marginBottom: 12 }} />
              <p style={{ margin: 0, fontSize: 14, color: MID, fontFamily: "'Poppins', sans-serif" }}>
                Select a staff member to view their schedule
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
              {DAYS.map((day) => (
                <DayColumn
                  key={day.value}
                  day={day}
                  entries={byDay[day.value] || []}
                  onAdd={(dayVal) => handleAdd(dayVal, selectedStaff)}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  deleting={deletingId}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Add / Edit modal ── */}
      <ScheduleModal
        open={modalOpen}
        onClose={handleModalClose}
        staffId={modalStaffId ?? selectedStaff}
        prefillDay={prefillDay}
        editEntry={editEntry}
        isPending={isPending}
        onSubmit={handleModalSubmit}
      />

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
