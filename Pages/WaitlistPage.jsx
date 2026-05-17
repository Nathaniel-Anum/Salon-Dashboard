/**
 * WaitlistPage.jsx
 * ─────────────────
 * Portal staff view for managing all waitlist entries.
 *
 * Features:
 *   • Tab filter: All / Pending / Booked / Cancelled / Expired
 *   • Table showing reference, customer, services, waitlist date,
 *     requested time, payment deadline, status
 *   • Cancel action for pending entries + unpaid promoted holds
 *   • Entry detail drawer
 *   • Create waitlist entry modal (registered customer or guest)
 *
 * API: src/api/waitlist.js → /api/portal/v1/booking/waitlist/
 */

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  message,
  Drawer,
  Spin,
  Tooltip,
} from "antd";
import dayjs from "dayjs";
import {
  FiClock,
  FiUser,
  FiScissors,
  FiCalendar,
  FiPlus,
  FiX,
  FiSearch,
  FiAlertCircle,
  FiCheckCircle,
  FiXCircle,
  FiList,
  FiRefreshCw,
  FiAlertTriangle,
  FiCreditCard,
  FiChevronRight,
} from "react-icons/fi";
import { LoadingOutlined } from "@ant-design/icons";
import {
  getWaitlist,
  getWaitlistEntry,
  createWaitlistEntry,
  cancelWaitlistEntry,
} from "../src/api/waitlist";
import _axios from "../src/api/_axios";

/* ─────────────────────────────────────────────
   DESIGN TOKENS
───────────────────────────────────────────── */
const GOLD   = "#BBA14F";
const DARK   = "#272727";
const MID    = "#987554";
const CREAM  = "#FDFAF5";
const BORDER = "rgba(187,161,79,0.18)";

/* ─────────────────────────────────────────────
   STATUS CONFIG
───────────────────────────────────────────── */
const STATUS_CFG = {
  pending:  {
    label: "Pending",
    bg: "rgba(187,161,79,0.12)", color: "#8a7030",
    border: "rgba(187,161,79,0.3)", icon: <FiClock size={11} />,
  },
  booked:   {
    label: "Booked",
    bg: "rgba(79,122,168,0.12)", color: "#2d5a84",
    border: "rgba(79,122,168,0.3)", icon: <FiCheckCircle size={11} />,
  },
  cancelled:{
    label: "Cancelled",
    bg: "rgba(200,50,50,0.1)", color: "#c43232",
    border: "rgba(200,50,50,0.25)", icon: <FiXCircle size={11} />,
  },
  expired:  {
    label: "Expired",
    bg: "rgba(150,100,50,0.08)", color: "#7a5020",
    border: "rgba(150,100,50,0.2)", icon: <FiAlertTriangle size={11} />,
  },
};

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
   PAYMENT DEADLINE PILL
   Shows urgency colour based on time remaining
───────────────────────────────────────────── */
function PaymentDeadline({ dueAt }) {
  if (!dueAt) return <span style={{ color: MID, fontSize: 11 }}>—</span>;
  const due   = dayjs(dueAt);
  const now   = dayjs();
  const mins  = due.diff(now, "minute");
  const past  = mins < 0;
  const urgent = !past && mins <= 15;

  const color  = past ? "#c43232" : urgent ? "#D4A847" : "#1a8a40";
  const bg     = past ? "rgba(200,50,50,0.1)" : urgent ? "rgba(212,168,71,0.12)" : "rgba(34,160,80,0.1)";
  const border = past ? "rgba(200,50,50,0.25)" : urgent ? "rgba(212,168,71,0.3)" : "rgba(34,160,80,0.2)";
  const label  = past
    ? `Expired ${due.fromNow()}`
    : urgent
      ? `Due in ${mins}m`
      : due.format("D MMM h:mm A");

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 20,
      background: bg, color, border: `1px solid ${border}`,
      fontFamily: "'Poppins', sans-serif", whiteSpace: "nowrap",
    }}>
      <FiCreditCard size={10} /> {label}
    </span>
  );
}

/* ─────────────────────────────────────────────
   SKELETON
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
   TABLE ROW
───────────────────────────────────────────── */
function WaitlistRow({ entry, index, onView, onCancel, cancelling }) {
  const customerName =
    entry.customer_name ||
    entry.customer?.full_name ||
    entry.guest?.full_name ||
    "Guest";

  const servicesSummary =
    (entry.services || entry.items || [])
      .map((s) => s.service_name || s.name || "")
      .filter(Boolean)
      .join(", ") || "—";

  const requestedTime = entry.requested_start
    ? dayjs(entry.requested_start).format("D MMM, h:mm A")
    : entry.appointment_date
      ? `${dayjs(entry.appointment_date).format("D MMM")} ${entry.start_time || ""}`
      : "—";

  const waitlistDate = entry.waitlist_date
    ? dayjs(entry.waitlist_date).format("D MMM YYYY")
    : "—";

  const canCancel = entry.status === "pending" ||
    (entry.status === "booked" && entry.payment_due_at && dayjs(entry.payment_due_at).isAfter(dayjs()));

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "120px 1fr 1fr 110px 110px 100px 130px auto",
        gap: 10,
        alignItems: "center",
        padding: "12px 16px",
        borderBottom: `1px solid rgba(187,161,79,0.1)`,
        background: index % 2 === 0 ? CREAM : "rgba(187,161,79,0.03)",
        cursor: "pointer",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(187,161,79,0.07)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = index % 2 === 0 ? CREAM : "rgba(187,161,79,0.03)")}
      onClick={() => onView(entry)}
    >
      {/* Ref code */}
      <span style={{ fontSize: 11, fontWeight: 700, color: GOLD, fontFamily: "'Poppins', sans-serif", letterSpacing: "0.04em" }}>
        {entry.reference_code || `#${entry.id}`}
      </span>

      {/* Customer */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        <FiUser size={11} color={MID} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: DARK, fontFamily: "'Poppins', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {customerName}
        </span>
      </div>

      {/* Services */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        <FiScissors size={11} color={MID} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: MID, fontFamily: "'Poppins', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {servicesSummary}
        </span>
      </div>

      {/* Requested time */}
      <span style={{ fontSize: 11, color: DARK, fontFamily: "'Poppins', sans-serif" }}>
        {requestedTime}
      </span>

      {/* Waitlist date */}
      <span style={{ fontSize: 11, color: MID, fontFamily: "'Poppins', sans-serif" }}>
        {waitlistDate}
      </span>

      {/* Status */}
      <StatusBadge status={entry.status} />

      {/* Payment deadline (only relevant when booked/promoted) */}
      {entry.status === "booked" ? (
        <PaymentDeadline dueAt={entry.payment_due_at} />
      ) : (
        <span style={{ fontSize: 11, color: "rgba(152,117,84,0.4)", fontFamily: "'Poppins', sans-serif" }}>—</span>
      )}

      {/* Actions */}
      <div
        style={{ display: "flex", gap: 6 }}
        onClick={(e) => e.stopPropagation()}
      >
        <Tooltip title="View details">
          <button
            onClick={() => onView(entry)}
            style={{
              width: 28, height: 28, borderRadius: 7,
              border: `1px solid ${BORDER}`, background: CREAM,
              color: MID, display: "flex", alignItems: "center",
              justifyContent: "center", cursor: "pointer",
            }}
          >
            <FiChevronRight size={13} />
          </button>
        </Tooltip>
        {canCancel && (
          <Tooltip title="Cancel entry">
            <button
              onClick={() => onCancel(entry)}
              disabled={cancelling === entry.id}
              style={{
                width: 28, height: 28, borderRadius: 7,
                border: "1px solid rgba(200,50,50,0.3)",
                background: "rgba(200,50,50,0.06)",
                color: "#c43232", display: "flex", alignItems: "center",
                justifyContent: "center",
                cursor: cancelling === entry.id ? "not-allowed" : "pointer",
                opacity: cancelling === entry.id ? 0.5 : 1,
              }}
            >
              {cancelling === entry.id
                ? <Spin indicator={<LoadingOutlined style={{ fontSize: 10, color: "#c43232" }} spin />} />
                : <FiX size={13} />}
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   ENTRY DETAIL DRAWER
───────────────────────────────────────────── */
function EntryDrawer({ entryId, onClose, onCancel }) {
  const { data: entry, isLoading } = useQuery({
    queryKey: ["waitlist-entry", entryId],
    queryFn: () => getWaitlistEntry(entryId),
    enabled: !!entryId,
    staleTime: 30_000,
  });

  const canCancel = entry &&
    (entry.status === "pending" ||
     (entry.status === "booked" && entry.payment_due_at && dayjs(entry.payment_due_at).isAfter(dayjs())));

  const Field = ({ label, value }) => (
    <div style={{ marginBottom: 14 }}>
      <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: MID, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'Poppins', sans-serif", marginBottom: 3 }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: 13, color: DARK, fontFamily: "'Poppins', sans-serif" }}>
        {value || "—"}
      </p>
    </div>
  );

  return (
    <Drawer
      open={!!entryId}
      onClose={onClose}
      title={
        <span style={{ fontFamily: "'Playfair Display', serif", color: DARK }}>
          Waitlist Entry
        </span>
      }
      width={400}
      styles={{ body: { background: CREAM, padding: 24 } }}
      headerStyle={{ background: CREAM, borderBottom: `1px solid ${BORDER}` }}
    >
      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[1, 2, 3, 4, 5].map((k) => (
            <Skeleton key={k} width="100%" height={40} radius={8} />
          ))}
        </div>
      ) : !entry ? (
        <p style={{ color: MID, fontFamily: "'Poppins', sans-serif" }}>Entry not found.</p>
      ) : (
        <>
          {/* Ref + status */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: GOLD, fontFamily: "'Poppins', sans-serif" }}>
              {entry.reference_code || `#${entry.id}`}
            </span>
            <StatusBadge status={entry.status} />
          </div>

          <Field
            label="Customer"
            value={
              entry.customer_name ||
              entry.customer?.full_name ||
              entry.guest?.full_name ||
              "Guest"
            }
          />

          {entry.guest?.email && <Field label="Guest Email" value={entry.guest.email} />}

          <Field
            label="Requested Date / Time"
            value={
              entry.requested_start
                ? dayjs(entry.requested_start).format("ddd, D MMM YYYY [at] h:mm A")
                : entry.appointment_date
                  ? `${dayjs(entry.appointment_date).format("ddd, D MMM YYYY")} ${entry.start_time || ""}`
                  : "—"
            }
          />

          <Field
            label="Requested End"
            value={entry.requested_end ? dayjs(entry.requested_end).format("h:mm A") : "—"}
          />

          <Field
            label="Waitlist Date"
            value={entry.waitlist_date ? dayjs(entry.waitlist_date).format("ddd, D MMM YYYY") : "—"}
          />

          <Field label="Reason" value={entry.reason || "—"} />
          <Field label="Notes" value={entry.notes || "—"} />

          {/* Services */}
          <div style={{ marginBottom: 14 }}>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: MID, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'Poppins', sans-serif", marginBottom: 8 }}>
              Services
            </p>
            {(entry.services || entry.items || []).length === 0 ? (
              <p style={{ margin: 0, fontSize: 13, color: MID, fontFamily: "'Poppins', sans-serif" }}>—</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(entry.services || entry.items || []).map((s, i) => (
                  <div key={i} style={{
                    display: "flex", justifyContent: "space-between",
                    padding: "8px 12px", borderRadius: 8,
                    background: "rgba(187,161,79,0.06)",
                    border: `1px solid ${BORDER}`,
                  }}>
                    <span style={{ fontSize: 12, color: DARK, fontFamily: "'Poppins', sans-serif" }}>
                      {s.service_name || s.name || "—"}
                    </span>
                    {s.staff_name && (
                      <span style={{ fontSize: 11, color: MID, fontFamily: "'Poppins', sans-serif" }}>
                        {s.staff_name}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Promoted appointment info */}
          {entry.status === "booked" && (
            <div style={{
              padding: "12px 14px", borderRadius: 10,
              background: "rgba(79,122,168,0.07)",
              border: "1px solid rgba(79,122,168,0.2)",
              marginBottom: 14,
            }}>
              <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 700, color: "#2d5a84", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'Poppins', sans-serif" }}>
                Promoted to Appointment
              </p>
              {entry.booked_appointment_id && (
                <p style={{ margin: "0 0 4px", fontSize: 12, color: DARK, fontFamily: "'Poppins', sans-serif" }}>
                  Appointment ID: <strong>#{entry.booked_appointment_id}</strong>
                </p>
              )}
              {entry.payment_due_at && (
                <div style={{ marginTop: 6 }}>
                  <p style={{ margin: "0 0 4px", fontSize: 10, fontWeight: 700, color: MID, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'Poppins', sans-serif" }}>
                    Deposit Deadline
                  </p>
                  <PaymentDeadline dueAt={entry.payment_due_at} />
                </div>
              )}
            </div>
          )}

          {/* Cancel button */}
          {canCancel && (
            <button
              onClick={() => onCancel(entry)}
              style={{
                width: "100%", padding: "10px 0", borderRadius: 10,
                border: "1px solid rgba(200,50,50,0.3)",
                background: "rgba(200,50,50,0.06)", color: "#c43232",
                fontSize: 13, fontWeight: 600, fontFamily: "'Poppins', sans-serif",
                cursor: "pointer", display: "flex", alignItems: "center",
                justifyContent: "center", gap: 6,
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(200,50,50,0.12)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(200,50,50,0.06)")}
            >
              <FiXCircle size={14} /> Cancel Entry
            </button>
          )}
        </>
      )}
    </Drawer>
  );
}

/* ═══════════════════════════════════════════════
   CREATE WAITLIST MODAL
═══════════════════════════════════════════════ */
function CreateWaitlistModal({ open, onClose, onSuccess }) {
  const [form] = Form.useForm();
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState(null);

  /* Fetch customers for search */
  const { data: customersData = [] } = useQuery({
    queryKey: ["customers-search", clientSearch],
    queryFn: () =>
      _axios
        .get("/api/portal/v1/accounts/customers/", {
          params: clientSearch ? { search: clientSearch } : {},
        })
        .then((r) => (Array.isArray(r.data) ? r.data : (r.data?.results ?? []))),
    staleTime: 30_000,
  });

  /* Fetch services */
  const { data: servicesData = [] } = useQuery({
    queryKey: ["services-list"],
    queryFn: () =>
      _axios.get("/api/portal/v1/booking/services/").then((r) =>
        Array.isArray(r.data) ? r.data : (r.data?.results ?? [])
      ),
    staleTime: 5 * 60_000,
  });

  /* Fetch staff */
  const { data: staffData = [] } = useQuery({
    queryKey: ["staff-list"],
    queryFn: () =>
      _axios.get("/api/portal/v1/accounts/staff/").then((r) =>
        Array.isArray(r.data) ? r.data : (r.data?.results ?? [])
      ),
    staleTime: 5 * 60_000,
  });

  const createMutation = useMutation({
    mutationFn: createWaitlistEntry,
    onSuccess: () => {
      message.success("Waitlist entry created");
      form.resetFields();
      setSelectedClient(null);
      onSuccess();
    },
    onError: (err) => {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.non_field_errors?.[0] ||
        Object.values(err?.response?.data ?? {})?.[0]?.[0] ||
        "Failed to create waitlist entry";
      message.error(msg);
    },
  });

  const handleSubmit = () => {
    form.validateFields().then((vals) => {
      const services = (vals.services || []).map((item) => ({
        service_id: item.service_id,
        staff_id:   item.staff_id,
      }));

      const payload = {
        customer_id:   selectedClient?.id,
        waitlist_date: vals.waitlist_date.format("YYYY-MM-DD"),
        services,
        reason:        vals.reason || "staff_fully_booked",
      };

      createMutation.mutate(payload);
    });
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, color: DARK }}>
          Add to Waitlist
        </span>
      }
      footer={null}
      width={520}
      styles={{ body: { background: CREAM, padding: "20px 24px" } }}
      style={{ top: 40 }}
    >
      <Form form={form} layout="vertical">
        {/* Customer search */}
        <Form.Item label="Customer" required>
          <Select
            showSearch
            placeholder="Search by name or email…"
            filterOption={false}
            onSearch={(v) => setClientSearch(v)}
            onSelect={(_, opt) => setSelectedClient(opt.data)}
            value={selectedClient ? `${selectedClient.full_name || selectedClient.first_name}` : undefined}
            style={{ width: "100%" }}
            notFoundContent={<span style={{ fontSize: 11, color: MID, fontFamily: "'Poppins', sans-serif" }}>No customers found</span>}
          >
            {customersData.map((c) => {
              const name = c.full_name || [c.first_name, c.last_name].filter(Boolean).join(" ");
              return (
                <Select.Option key={c.id} value={c.id} data={c}>
                  <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 12 }}>
                    {name}
                  </span>
                </Select.Option>
              );
            })}
          </Select>
        </Form.Item>

        {/* Services + Staff per service */}
        <Form.List
          name="services"
          rules={[{
            validator: async (_, items) => {
              if (!items || items.length === 0)
                return Promise.reject(new Error("Add at least one service"));
            },
          }]}
        >
          {(fields, { add, remove }, { errors }) => (
            <>
              <div style={{ marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: MID, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'Poppins', sans-serif" }}>
                  Services &amp; Staff
                </span>
                <button
                  type="button"
                  onClick={() => add()}
                  style={{
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "4px 10px", borderRadius: 6,
                    border: `1px solid ${GOLD}`, background: "rgba(187,161,79,0.08)",
                    color: GOLD, fontSize: 11, fontWeight: 600,
                    fontFamily: "'Poppins', sans-serif", cursor: "pointer",
                  }}
                >
                  + Add Service
                </button>
              </div>

              {fields.length === 0 && (
                <div style={{
                  padding: "12px 14px", borderRadius: 8, marginBottom: 8,
                  border: `1px dashed ${BORDER}`, textAlign: "center",
                  color: MID, fontSize: 12, fontFamily: "'Poppins', sans-serif",
                }}>
                  Click "+ Add Service" to add services
                </div>
              )}

              {fields.map(({ key, name, ...restField }) => {
                // Watch the selected service_id to filter staff
                const selectedSvcId = form.getFieldValue(["services", name, "service_id"]);
                const svcObj = servicesData.find((s) => s.id === selectedSvcId);
                const assignedIds = svcObj?.assigned_staff_ids ?? svcObj?.staff_ids ?? [];
                const eligibleStaff = assignedIds.length
                  ? staffData.filter((s) =>
                      assignedIds.some(
                        (id) =>
                          String(id) === String(s.id) ||
                          String(id) === String(s.user) ||
                          String(id) === String(s.user_id)
                      )
                    )
                  : staffData;
                const displayStaff = eligibleStaff.length ? eligibleStaff : staffData;

                return (
                  <div
                    key={key}
                    style={{
                      padding: "10px 12px",
                      marginBottom: 8,
                      borderRadius: 10,
                      border: `1px solid ${BORDER}`,
                      background: "rgba(253,250,245,0.7)",
                      position: "relative",
                    }}
                  >
                    {/* Remove button — top-right corner */}
                    <button
                      type="button"
                      onClick={() => remove(name)}
                      style={{
                        position: "absolute", top: 8, right: 8,
                        width: 22, height: 22, borderRadius: 6,
                        border: "1px solid rgba(200,50,50,0.2)",
                        background: "rgba(200,50,50,0.05)", color: "#c43232",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: "pointer", fontSize: 13, lineHeight: 1,
                      }}
                    >
                      ×
                    </button>

                    {/* Service */}
                    <Form.Item
                      {...restField}
                      name={[name, "service_id"]}
                      label={<span style={{ fontSize: 11, color: MID, fontFamily: "'Poppins', sans-serif" }}>Service</span>}
                      rules={[{ required: true, message: "Select a service" }]}
                      style={{ margin: "0 0 8px" }}
                    >
                      <Select
                        placeholder="Choose a service…"
                        showSearch
                        filterOption={(input, opt) =>
                          (opt?.label || "").toLowerCase().includes(input.toLowerCase())
                        }
                        options={servicesData.map((s) => ({ value: s.id, label: s.name }))}
                        onChange={() => {
                          const cur = form.getFieldValue("services");
                          cur[name] = { ...cur[name], staff_id: undefined };
                          form.setFieldsValue({ services: cur });
                        }}
                      />
                    </Form.Item>

                    {/* Staff */}
                    <Form.Item
                      {...restField}
                      name={[name, "staff_id"]}
                      label={<span style={{ fontSize: 11, color: MID, fontFamily: "'Poppins', sans-serif" }}>Staff member</span>}
                      rules={[{ required: true, message: "Select staff" }]}
                      style={{ margin: 0 }}
                    >
                      <Select
                        placeholder={selectedSvcId ? "Choose staff member…" : "Select a service first…"}
                        showSearch
                        filterOption={(input, opt) =>
                          (opt?.label || "").toLowerCase().includes(input.toLowerCase())
                        }
                        options={displayStaff.map((s) => ({
                          value: s.id,
                          label: s.full_name || s.name || `Staff #${s.id}`,
                        }))}
                        disabled={!selectedSvcId}
                      />
                    </Form.Item>
                  </div>
                );
              })}

              <Form.ErrorList errors={errors} style={{ marginBottom: 8, fontSize: 12 }} />
            </>
          )}
        </Form.List>

        <Form.Item name="waitlist_date" label="Waitlist Date" rules={[{ required: true, message: "Required" }]}
          tooltip="The date the customer is available. They will be promoted when a slot opens on this date.">
          <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" disabledDate={(d) => d && d < dayjs().startOf("day")} />
        </Form.Item>

        <Form.Item name="reason" label="Reason">
          <Select
            placeholder="Select reason…"
            options={[
              { value: "staff_fully_booked", label: "Staff fully booked" },
              { value: "after_hours",        label: "After hours" },
              { value: "future_date",        label: "Preferred future date" },
              { value: "other",              label: "Other" },
            ]}
          />
        </Form.Item>

        {/* Footer buttons */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
          <button
            onClick={onClose}
            style={{
              padding: "9px 22px", borderRadius: 9, border: `1px solid ${BORDER}`,
              background: CREAM, color: MID, fontSize: 12, fontWeight: 600,
              fontFamily: "'Poppins', sans-serif", cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            style={{
              padding: "9px 22px", borderRadius: 9, border: "none",
              background: createMutation.isPending
                ? "rgba(187,161,79,0.5)"
                : "linear-gradient(135deg,#BBA14F,#987554)",
              color: "#fff", fontSize: 12, fontWeight: 700,
              fontFamily: "'Poppins', sans-serif",
              cursor: createMutation.isPending ? "not-allowed" : "pointer",
              boxShadow: createMutation.isPending ? "none" : "0 4px 14px rgba(187,161,79,0.35)",
            }}
          >
            {createMutation.isPending ? "Adding…" : "Add to Waitlist"}
          </button>
        </div>
      </Form>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════ */
const TABS = [
  { key: "all",       label: "All"       },
  { key: "pending",   label: "Pending"   },
  { key: "booked",    label: "Booked"    },
  { key: "cancelled", label: "Cancelled" },
  { key: "expired",   label: "Expired"   },
];

export default function WaitlistPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab]     = useState("all");
  const [search, setSearch]           = useState("");
  const [viewEntryId, setViewEntryId] = useState(null);
  const [createOpen, setCreateOpen]   = useState(false);
  const [cancelling, setCancelling]   = useState(null); // entry id being cancelled

  /* ── Fetch waitlist ── */
  const { data: rawList = [], isLoading, refetch } = useQuery({
    queryKey: ["waitlist", activeTab],
    queryFn: () => getWaitlist(activeTab !== "all" ? { status: activeTab } : {}),
    staleTime: 60_000,
    select: (d) => (Array.isArray(d) ? d : (d?.results ?? [])),
  });

  /* ── Cancel mutation ── */
  const cancelMutation = useMutation({
    mutationFn: (id) => cancelWaitlistEntry(id),
    onMutate: (id) => setCancelling(id),
    onSuccess: (_, id) => {
      message.success("Waitlist entry cancelled");
      setCancelling(null);
      setViewEntryId(null);
      queryClient.invalidateQueries({ queryKey: ["waitlist"] });
      queryClient.invalidateQueries({ queryKey: ["waitlist-entry", id] });
    },
    onError: (err) => {
      const msg =
        err?.response?.data?.detail ||
        Object.values(err?.response?.data ?? {})?.[0]?.[0] ||
        "Failed to cancel entry";
      message.error(msg);
      setCancelling(null);
    },
  });

  const handleCancel = (entry) => {
    Modal.confirm({
      title: "Cancel waitlist entry?",
      content: (
        <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13 }}>
          This will cancel entry <strong>{entry.reference_code || `#${entry.id}`}</strong>. This cannot be undone.
        </span>
      ),
      okText: "Yes, cancel it",
      okButtonProps: { danger: true },
      cancelText: "Keep",
      onOk: () => cancelMutation.mutate(entry.id),
    });
  };

  /* ── Local search filter ── */
  const filtered = useMemo(() => {
    if (!search.trim()) return rawList;
    const q = search.toLowerCase();
    return rawList.filter((e) => {
      const name = (
        e.customer_name ||
        e.customer?.full_name ||
        e.guest?.full_name ||
        ""
      ).toLowerCase();
      const ref  = (e.reference_code || "").toLowerCase();
      const svcs = (e.services || e.items || [])
        .map((s) => s.service_name || s.name || "")
        .join(" ")
        .toLowerCase();
      return name.includes(q) || ref.includes(q) || svcs.includes(q);
    });
  }, [rawList, search]);

  /* ── Tab counts ── */
  const counts = useMemo(() => {
    const c = { all: rawList.length, pending: 0, booked: 0, cancelled: 0, expired: 0 };
    rawList.forEach((e) => { if (c[e.status] !== undefined) c[e.status]++; });
    return c;
  }, [rawList]);

  return (
    <div style={{ fontFamily: "'Poppins', sans-serif", animation: "fadeInUp 0.3s ease both" }}>

      {/* ── Page header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{
            margin: 0, fontSize: 22, fontWeight: 700, color: DARK,
            fontFamily: "'Playfair Display', serif",
          }}>
            Waitlist
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: MID, fontFamily: "'Poppins', sans-serif" }}>
            Manage pending, promoted, and cancelled waitlist entries
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          {/* Refresh */}
          <button
            onClick={() => refetch()}
            style={{
              width: 36, height: 36, borderRadius: 9,
              border: `1px solid ${BORDER}`, background: CREAM,
              color: MID, display: "flex", alignItems: "center",
              justifyContent: "center", cursor: "pointer",
            }}
          >
            <FiRefreshCw size={14} />
          </button>

          {/* Add entry */}
          <button
            onClick={() => setCreateOpen(true)}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "9px 18px", borderRadius: 9, border: "none",
              background: "linear-gradient(135deg,#BBA14F,#987554)",
              color: "#fff", fontSize: 12, fontWeight: 700,
              fontFamily: "'Poppins', sans-serif", cursor: "pointer",
              boxShadow: "0 4px 14px rgba(187,161,79,0.35)",
            }}
          >
            <FiPlus size={14} /> Add to Waitlist
          </button>
        </div>
      </div>

      {/* ── Tabs + search bar ── */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 16, flexWrap: "wrap", gap: 10,
      }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                padding: "6px 14px", borderRadius: 8, border: `1px solid ${activeTab === t.key ? GOLD : BORDER}`,
                background: activeTab === t.key ? "rgba(187,161,79,0.1)" : CREAM,
                color: activeTab === t.key ? GOLD : MID,
                fontSize: 11, fontWeight: 600, fontFamily: "'Poppins', sans-serif",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
                transition: "all 0.15s",
              }}
            >
              {t.label}
              {counts[t.key] > 0 && (
                <span style={{
                  minWidth: 16, height: 16, borderRadius: 8,
                  background: activeTab === t.key ? GOLD : "rgba(187,161,79,0.2)",
                  color: activeTab === t.key ? "#fff" : MID,
                  fontSize: 9, fontWeight: 700, display: "flex",
                  alignItems: "center", justifyContent: "center",
                  padding: "0 4px",
                }}>
                  {counts[t.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ position: "relative", minWidth: 220 }}>
          <FiSearch size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: MID, pointerEvents: "none" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer, ref, service…"
            style={{
              width: "100%", padding: "7px 10px 7px 30px",
              border: `1px solid ${BORDER}`, borderRadius: 8,
              background: CREAM, color: DARK, fontSize: 12,
              fontFamily: "'Poppins', sans-serif",
              outline: "none", boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      {/* ── Table ── */}
      <div style={{
        background: CREAM, border: `1px solid ${BORDER}`,
        borderRadius: 16, overflow: "hidden",
        boxShadow: "0 2px 12px rgba(39,39,39,0.05)",
      }}>
        {/* Table header */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "120px 1fr 1fr 110px 110px 100px 130px auto",
          gap: 10,
          padding: "10px 16px",
          background: "linear-gradient(90deg, rgba(187,161,79,0.1), rgba(152,117,84,0.06))",
          borderBottom: `1px solid rgba(187,161,79,0.2)`,
        }}>
          {["Reference", "Customer", "Services", "Requested", "Waitlist Date", "Status", "Payment Due", ""].map((h) => (
            <span key={h} style={{
              fontSize: 10, fontWeight: 700, color: MID, textTransform: "uppercase",
              letterSpacing: "0.06em", fontFamily: "'Poppins', sans-serif",
            }}>
              {h}
            </span>
          ))}
        </div>

        {/* Rows */}
        {isLoading ? (
          [1, 2, 3, 4, 5].map((k) => (
            <div key={k} style={{ padding: "14px 16px", borderBottom: `1px solid rgba(187,161,79,0.1)` }}>
              <Skeleton width="100%" height={14} />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div style={{ padding: "48px 20px", textAlign: "center", color: MID }}>
            <FiList size={30} style={{ color: GOLD, opacity: 0.3, display: "block", margin: "0 auto 12px" }} />
            <p style={{ margin: 0, fontSize: 13, fontFamily: "'Poppins', sans-serif" }}>
              {search ? "No entries match your search" : "No waitlist entries"}
            </p>
          </div>
        ) : (
          filtered.map((entry, idx) => (
            <WaitlistRow
              key={entry.id}
              entry={entry}
              index={idx}
              onView={(e) => setViewEntryId(e.id)}
              onCancel={handleCancel}
              cancelling={cancelling}
            />
          ))
        )}

        {/* Footer */}
        {!isLoading && filtered.length > 0 && (
          <div style={{
            padding: "10px 16px",
            background: "rgba(187,161,79,0.04)",
            borderTop: `1px solid rgba(187,161,79,0.12)`,
          }}>
            <p style={{ margin: 0, fontSize: 11, color: "rgba(152,117,84,0.65)", fontFamily: "'Poppins', sans-serif" }}>
              {filtered.length} entr{filtered.length !== 1 ? "ies" : "y"}
              {activeTab !== "all" ? ` — ${activeTab}` : ""}
            </p>
          </div>
        )}
      </div>

      {/* ── Detail drawer ── */}
      <EntryDrawer
        entryId={viewEntryId}
        onClose={() => setViewEntryId(null)}
        onCancel={(e) => { setViewEntryId(null); handleCancel(e); }}
      />

      {/* ── Create modal ── */}
      <CreateWaitlistModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => {
          setCreateOpen(false);
          queryClient.invalidateQueries({ queryKey: ["waitlist"] });
        }}
      />
    </div>
  );
}
