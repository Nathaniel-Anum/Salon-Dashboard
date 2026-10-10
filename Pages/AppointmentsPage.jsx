import React, { useMemo, useState } from "react";
import { Button, Checkbox, Drawer, Empty, Input, Select, Skeleton, message } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  FiAlertCircle,
  FiArrowRight,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiCreditCard,
  FiDollarSign,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiUser,
  FiUsers,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import _axios from "../src/api/_axios";
import {
  getAppointmentFinancialSummary,
  getCheckoutAppointment,
} from "../src/api/appointmentCheckout";
import { firstApiErrorMessage } from "../src/api/apiErrors";
import {
  buildAppointmentEdit,
  buildServiceOperations,
  editAppointment,
  getAppointmentEditConfirmation,
  hasStructuralServiceOperations,
} from "../src/api/appointmentSchedule.js";
import { isActiveRole } from "../src/api/providerEligibility.js";
import { permissionState } from "../src/auth/permissions";
import CorrectNoShowModal from "../Components/CorrectNoShowModal";
import { bookingV2Keys, createIdempotencyKey, listAppointmentsV2 } from "../src/api/bookingV2.js";
import { useBookingV2 } from "../src/hooks/useBookingV2.js";
import "./AppointmentsPage.css";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "pending-deposit", label: "Pending deposit" },
  { value: "pending-payment", label: "Pending payment" },
  { value: "confirmed", label: "Confirmed" },
  { value: "arrived", label: "Arrived" },
  { value: "completed", label: "Completed" },
  { value: "no-show", label: "No-show" },
  { value: "cancelled", label: "Cancelled" },
];

const SETTLEMENT_OPTIONS = [
  { value: "all", label: "All payment states" },
  { value: "settled", label: "Settled" },
  { value: "unsettled", label: "Unsettled" },
];

const STATUS_META = {
  pending: { label: "Pending", tone: "pending" },
  "pending-deposit": { label: "Pending deposit", tone: "pending" },
  "pending-payment": { label: "Pending payment", tone: "pending" },
  confirmed: { label: "Confirmed", tone: "confirmed" },
  arrived: { label: "Arrived", tone: "arrived" },
  completed: { label: "Completed", tone: "completed" },
  "no-show": { label: "No-show", tone: "no-show" },
  cancelled: { label: "Cancelled", tone: "cancelled" },
};

function normalizeList(raw) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.results)) return raw.results;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
}

function normalizeStatus(status) {
  return String(status || "pending").trim().toLowerCase().replaceAll("_", "-");
}

function customerName(appointment = {}) {
  const customer =
    appointment.customer_details || appointment.customer || appointment.client ||
    appointment.guest_customer || appointment.guest || {};
  return (
    customer.full_name || customer.name ||
    [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
    appointment.customer_name || appointment.guest_name || "Guest customer"
  );
}

function serviceLineName(service = {}) {
  if (typeof service === "string") return service;
  const name =
    service.service_name_snapshot || service.service_name || service.name ||
    service.title || service.service_snapshot?.name || service.service_details?.name ||
    service.service_details?.service_name || service.service?.name ||
    service.service?.service_name || service.catalog_service?.name;
  const option =
    service.service_option_name_snapshot || service.service_option_name ||
    service.option_name || service.service_option_details?.name ||
    service.service_option?.name || service.option?.name;
  return name ? (option ? `${name} · ${option}` : name) : null;
}

function personName(person) {
  if (typeof person === "string") return person;
  if (!person || typeof person !== "object") return null;
  return person.full_name || person.name ||
    [person.first_name, person.last_name].filter(Boolean).join(" ") || null;
}

const personId = (person = {}) => person.id ?? person.user_id ?? person.user ?? person.account_id;

function serviceLineProviderName(service = {}) {
  return (
    service.staff_name_snapshot || service.provider_name_snapshot ||
    service.staff_name || service.provider_name || service.staff_member_name ||
    personName(service.staff_details) || personName(service.staff_member) ||
    personName(service.provider_details) || personName(service.provider) ||
    personName(service.staff) || personName(service.assigned_staff)
  );
}

function serviceLineProviderId(service = {}) {
  const staff = service.staff_details || service.staff_member || service.provider_details ||
    service.provider || service.staff || service.assigned_staff;
  return service.staff_id ?? service.provider_id ?? service.staff_member_id ??
    service.assigned_staff_id ?? staff?.id ?? staff?.user_id ?? staff?.user ??
    (typeof staff === "object" ? null : staff);
}

function appointmentServiceRows(appointment = {}) {
  const services =
    appointment.services || appointment.appointment_services ||
    appointment.booking_services || appointment.services_details ||
    (Array.isArray(appointment.service_details) ? appointment.service_details : null) ||
    appointment.service_lines || appointment.service_items ||
    appointment.line_items || appointment.items || [];
  const serviceRows = normalizeList(services);
  if (serviceRows.length) {
    return serviceRows
      .slice()
      .sort((a, b) => numeric(a?.sort_order ?? a?.sequence) - numeric(b?.sort_order ?? b?.sequence))
      .map((service) => ({
      id: service.appointment_item_id ?? service.item_id ?? service.id ?? service.service_id,
      name: serviceLineName(service) || "Service details unavailable",
      provider: serviceLineProviderName(service) || (serviceRows.length === 1 ? staffName(appointment) : "Provider unavailable"),
      providerId: serviceLineProviderId(service),
      serviceId: service.service_id ?? service.service_details?.id ?? service.service?.id ?? service.service,
      optionId: service.service_option_id ?? service.service_option_details?.id ?? service.service_option?.id ?? service.service_option ?? null,
      canReassign: Boolean(service.appointment_item_id ?? service.item_id ?? service.id),
      quantity: Math.max(1, numeric(service.quantity) || 1),
      price: service.price_snapshot,
      lineTotal: service.line_total_amount ?? service.price_snapshot,
      duration: numeric(service.duration_minutes_snapshot),
      extraTime: numeric(service.extra_time_minutes_snapshot),
      scheduledStart: service.scheduled_start,
      scheduledEnd: service.scheduled_end,
    }));
  }
  const directService = serviceLineName({
    service_name:
      appointment.service_name || appointment.service_details?.name ||
      (typeof appointment.service === "object" ? appointment.service?.name : null),
    service_option_name:
      appointment.service_option_name || appointment.service_option_details?.name ||
      appointment.service_option?.name,
  });
  return [{
    id: appointment.id,
    name: directService || appointment.service_summary || "Service details unavailable",
    provider: staffName(appointment),
    providerId: null,
    canReassign: false,
    quantity: 1,
    price: appointment.service_price,
    lineTotal: appointment.subtotal_amount ?? appointment.service_price,
    duration: numeric(appointment.total_duration_minutes ?? appointment.service_duration),
    extraTime: 0,
    scheduledStart: appointment.scheduled_start,
    scheduledEnd: appointment.scheduled_end,
  }];
}

function serviceNames(appointment = {}) {
  return appointmentServiceRows(appointment).map((service) => service.name).join(", ");
}

function staffName(appointment = {}) {
  const staff = appointment.staff_details || appointment.staff_member || appointment.staff || {};
  return (
    personName(staff) ||
    appointment.staff_name || "Unassigned"
  );
}

function appointmentStaffNames(appointment = {}) {
  const names = [...new Set(
    appointmentServiceRows(appointment)
      .map((service) => service.provider)
      .filter((name) => name && name !== "Provider unavailable" && name !== "Unassigned"),
  )];
  return names.length ? names.join(", ") : staffName(appointment);
}

function appointmentStart(appointment = {}) {
  const direct = appointment.scheduled_start || appointment.start_at || appointment.starts_at;
  if (direct && dayjs(direct).isValid()) return dayjs(direct);
  const date = appointment.appointment_date || appointment.date || appointment.booking_date;
  const time = appointment.start_time || appointment.time || "00:00";
  const combined = dayjs(`${date || ""} ${time}`);
  return combined.isValid() ? combined : null;
}

function appointmentReference(appointment = {}) {
  return appointment.appointment_reference || appointment.reference_code || appointment.reference || `#${appointment.id}`;
}

function numeric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function appointmentTotal(appointment = {}) {
  return numeric(
    appointment.financial_summary?.total_amount_due ?? appointment.total_amount_due ?? appointment.subtotal_amount ?? appointment.service_price ??
    appointment.total_price ?? appointment.total ?? appointment.amount_due,
  );
}

function appointmentBalance(appointment = {}) {
  return numeric(
    appointment.financial_summary?.remaining_amount_due ?? appointment.remaining_amount_due ?? appointment.remaining_balance_amount ?? appointment.outstanding_balance,
  );
}

function originalBookingPaid(appointment = {}) {
  const payments = normalizeList(appointment.payments);
  const completed = payments
    .filter((payment) => ["completed", "paid", "received", "success", "succeeded"].includes(String(payment?.status || "").toLowerCase()))
    .reduce((sum, payment) => sum + numeric(payment?.amount), 0);
  return completed || numeric(appointment.deposit_amount);
}

function appointmentDeposit(appointment = {}) {
  const payments = normalizeList(appointment.payments).filter(
    (payment) => payment?.is_deposit && ["completed", "paid", "received", "success", "succeeded"].includes(String(payment.status || "").toLowerCase()),
  );
  if (payments.length) return payments.reduce((sum, payment) => sum + numeric(payment.amount), 0);
  const value = appointment.financial_summary?.deposit_amount_paid ?? appointment.deposit_amount_paid ?? appointment.deposit_amount;
  return value == null || value === "" ? null : numeric(value);
}

function settlementCategory(appointment = {}) {
  if (appointment.is_settled === true || appointment.balance_settled === true) return "settled";
  if (appointment.is_settled === false || appointment.balance_settled === false) return "unsettled";

  const rawStatus = String(
    appointment.financial_summary?.settlement_status || appointment.settlement_status || appointment.appointment_payment_status ||
    appointment.payment_status || "",
  ).toLowerCase().replaceAll("_", "-");
  if (["paid", "settled", "no-payment-required", "waived"].includes(rawStatus)) return "settled";
  if (["unpaid", "partially-paid", "partial", "payment-due", "overpaid"].includes(rawStatus)) return "unsettled";

  const balanceFields = [
    appointment.financial_summary?.remaining_amount_due,
    appointment.remaining_amount_due,
    appointment.remaining_balance_amount,
    appointment.outstanding_balance,
  ];
  const knownBalance = balanceFields.find((value) => value !== null && value !== undefined && value !== "");
  if (knownBalance !== undefined) return numeric(knownBalance) > 0 ? "unsettled" : "settled";
  return "unknown";
}

function money(value, currency = "GHS") {
  return `${currency} ${numeric(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const appointmentCurrency = (appointment = {}) =>
  appointment.financial_summary?.currency || appointment.currency || "GHS";

function signedMoney(value, currency = "GHS") {
  const amount = numeric(value);
  return `${amount >= 0 ? "+" : "−"}${money(Math.abs(amount), currency)}`;
}

function durationLabel(minutes, extraMinutes = 0) {
  const base = numeric(minutes);
  const extra = numeric(extraMinutes);
  if (!base && !extra) return null;
  return `${base || extra} min${extra > 0 && base > 0 ? ` + ${extra} min extra` : ""}`;
}

function serviceWindow(service = {}) {
  if (!service.scheduledStart || !service.scheduledEnd) return null;
  const start = dayjs(service.scheduledStart);
  const end = dayjs(service.scheduledEnd);
  if (!start.isValid() || !end.isValid()) return null;
  return `${start.format("h:mm A")}–${end.format("h:mm A")}`;
}

function humanizeLabel(value, fallback = "Payment") {
  return String(value || fallback)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function StatusPill({ status }) {
  const normalized = normalizeStatus(status);
  const meta = STATUS_META[normalized] || { label: normalized.replaceAll("-", " "), tone: "pending" };
  return <span className={`appointments-status status-${meta.tone}`}><i />{meta.label}</span>;
}

function updateAppointmentCollection(raw, replacement) {
  const updateRows = (rows) => rows.map((row) =>
    String(row?.id) === String(replacement?.id) ? replacement : row,
  );
  if (Array.isArray(raw)) return updateRows(raw);
  if (Array.isArray(raw?.results)) return { ...raw, results: updateRows(raw.results) };
  if (Array.isArray(raw?.data)) return { ...raw, data: updateRows(raw.data) };
  return raw;
}

function DetailItem({ icon, label, children }) {
  return (
    <div className="appointment-detail-item">
      <span className="appointment-detail-icon">{icon}</span>
      <div><span>{label}</span><strong>{children || "—"}</strong></div>
    </div>
  );
}

export function AppointmentDetailDrawer({ appointmentId, listAppointment, onClose, onCorrect, enableCorrections = false }) {
  const bookingV2 = useBookingV2();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [serviceDraft, setServiceDraft] = useState([]);
  const [editReason, setEditReason] = useState("");
  const [editRequest, setEditRequest] = useState(null);
  const [overrideConflict, setOverrideConflict] = useState(null);
  const [editingPrice, setEditingPrice] = useState(false);
  const [finalTotal, setFinalTotal] = useState("");
  const [priceReason, setPriceReason] = useState("");
  const detailQ = useQuery({
    queryKey: bookingV2.enabled ? bookingV2Keys.appointment(appointmentId) : ["appointment-detail", appointmentId],
    queryFn: () => getCheckoutAppointment(appointmentId, { v2: bookingV2.enabled }),
    enabled: Boolean(appointmentId),
    staleTime: 15_000,
  });
  const summaryQ = useQuery({
    queryKey: ["appointment-financial-summary", appointmentId],
    queryFn: () => getAppointmentFinancialSummary(appointmentId),
    enabled: Boolean(appointmentId) && permissionState("booking_settlements.view", detailQ.data || listAppointment) !== false,
    staleTime: 5_000,
  });
  const staffQ = useQuery({
    queryKey: ["staff"],
    queryFn: () => _axios.get("/api/portal/v1/accounts/staff/").then((response) => normalizeList(response.data)),
    enabled: editing,
    staleTime: 300_000,
  });
  const servicesQ = useQuery({
    queryKey: ["services"],
    queryFn: () => _axios.get("/api/portal/v1/booking/services/").then((response) => normalizeList(response.data)),
    enabled: editing,
    staleTime: 300_000,
  });
  const appointment = detailQ.data || listAppointment || {};
  const summary = summaryQ.data || appointment.financial_summary
    ? { ...(summaryQ.data || {}), ...(appointment.financial_summary || {}) }
    : null;
  const start = appointmentStart(appointment);
  const status = normalizeStatus(appointment.status);
  const currency = summary?.currency || appointment.financial_summary?.currency || appointment.currency || "GHS";
  const remaining = numeric(summary?.remaining_amount_due ?? appointmentBalance(appointment));
  const fallbackPaid = originalBookingPaid(appointment);
  const financial = summary ?? {
    original_net_total: appointment.subtotal_amount ?? appointment.service_price,
    online_amount_paid: fallbackPaid,
    total_amount_due: appointment.subtotal_amount ?? appointment.service_price,
    total_amount_paid: fallbackPaid,
    remaining_amount_due: appointment.remaining_balance_amount,
    settlement_status: appointment.payment_status,
  };
  const canCorrect = status === "no-show" && permissionState("appointments.edit", appointment) !== false;
  const serviceRows = appointmentServiceRows(appointment);
  const canEdit = enableCorrections && bookingV2.enabled && ["confirmed", "arrived"].includes(status) && detailQ.isSuccess &&
    permissionState("appointments.edit", appointment) !== false;
  const canAdjustPrice = canEdit && permissionState("booking_price_adjustments.create", appointment) !== false;
  const activeStaff = normalizeList(staffQ.data).filter((person) =>
    personId(person) != null && isActiveRole(person) && person.is_external !== true &&
    (person.account_type == null || person.account_type === "staff") && (person.roles ?? []).some(isActiveRole),
  );
  const activeServices = normalizeList(servicesQ.data).filter(isActiveRole);
  const currentTotal = numeric(financial?.total_amount_due ?? appointmentTotal(appointment));
  const overpayment = numeric(financial?.overpayment_amount ?? Math.max(0, numeric(financial?.total_amount_paid) - currentTotal));
  const changedServices = buildServiceOperations(serviceRows, serviceDraft);
  const originalServiceTotal = serviceRows.reduce((total, row) => total + numeric(row.lineTotal), 0);
  const draftServiceTotal = serviceDraft.reduce((total, row) => {
    const original = serviceRows.find((item) => String(item.id) === String(row.appointmentItemId));
    if (original && String(original.serviceId) === String(row.serviceId) && String(original.optionId ?? null) === String(row.optionId ?? null)) return total + numeric(original.lineTotal);
    const service = activeServices.find((item) => String(item.id) === String(row.serviceId));
    const option = normalizeList(service?.service_options ?? service?.options).find((item) => String(item.id) === String(row.optionId));
    return total + numeric(option?.price ?? service?.price);
  }, 0);
  const calculatedTotal = Math.max(0, currentTotal + draftServiceTotal - originalServiceTotal);
  const priceDelta = numeric(finalTotal) - calculatedTotal;
  const originalPayments = normalizeList(appointment.payments);
  const statusHistory = normalizeList(appointment.status_history).slice().reverse();
  const correctionEvidence = appointment.correction_evidence;
  const correctionPayment = appointment.correction_payment;
  const correctionPriceAdjustment = appointment.correction_price_adjustment;
  const correctionLoyalty = appointment.correction_loyalty;

  const refreshAppointment = () => Promise.all([
    detailQ.refetch(),
    ...(permissionState("booking_settlements.view", appointment) !== false ? [summaryQ.refetch()] : []),
    queryClient.invalidateQueries({ queryKey: ["booking-v2", "appointments"] }),
    queryClient.invalidateQueries({ queryKey: ["appointments-ledger"] }),
    queryClient.invalidateQueries({ queryKey: ["appointments"] }),
  ]);
  const editMutation = useMutation({
    mutationFn: (payload) => editAppointment(appointmentId, payload),
    onSuccess: async (updated) => {
      queryClient.setQueryData(bookingV2Keys.appointment(appointmentId), updated);
      if (updated?.financial_summary) {
        queryClient.setQueryData(["appointment-financial-summary", appointmentId], (current) => ({ ...current, ...updated.financial_summary }));
      }
      setEditing(false);
      setEditingPrice(false);
      setEditRequest(null);
      setOverrideConflict(null);
      await refreshAppointment();
      message.success("Appointment changes saved.");
    },
  });

  function openEditor() {
    setServiceDraft(serviceRows.map((row) => ({
      clientId: `appointment-${row.id}`,
      appointmentItemId: row.id,
      serviceId: row.serviceId,
      optionId: row.optionId ?? null,
      staffId: row.providerId ?? null,
    })));
    setEditReason("");
    setEditRequest(null);
    setOverrideConflict(null);
    setFinalTotal(currentTotal.toFixed(2));
    setPriceReason("");
    setEditingPrice(false);
    setEditing(true);
  }

  function changeServiceDraft(clientId, changes) {
    setServiceDraft((current) => current.map((row) => row.clientId === clientId ? { ...row, ...changes } : row));
    setEditRequest(null);
    setOverrideConflict(null);
  }

  function addServiceDraft() {
    setServiceDraft((current) => [...current, {
      clientId: createIdempotencyKey("appointment-service"),
      appointmentItemId: null,
      serviceId: null,
      optionId: null,
      staffId: null,
    }]);
    setEditRequest(null);
    setOverrideConflict(null);
  }

  function removeServiceDraft(clientId) {
    setServiceDraft((current) => current.filter((row) => row.clientId !== clientId));
    setEditRequest(null);
    setOverrideConflict(null);
  }

  async function sendEdit(payload) {
    try {
      await editMutation.mutateAsync(payload);
    } catch (error) {
      const confirmation = getAppointmentEditConfirmation(error);
      if (confirmation?.canProceed) {
        setOverrideConflict(confirmation);
        message.warning(confirmation.detail);
        return;
      }
      if (hasStructuralServiceOperations(payload) && !error?.response) {
        await refreshAppointment();
        setEditing(false);
        setEditingPrice(false);
        setEditRequest(null);
        setOverrideConflict(null);
        message.warning("The save result was uncertain, so the appointment was refreshed. Review it before trying again.");
        return;
      }
      message.error(firstApiErrorMessage(error, "The appointment changes could not be saved."));
    }
  }

  function submitEdit() {
    try {
      if (!canEdit || (editingPrice && !canAdjustPrice)) throw new Error("You cannot edit this appointment.");
      if (overrideConflict) {
        if (!editReason.trim()) throw new Error("Enter a reason before confirming the provider override.");
        const confirmed = buildAppointmentEdit({ ...editRequest, reason: editReason, confirm_provider_override: true });
        setEditRequest(confirmed);
        sendEdit(confirmed);
        return;
      }
      if (!editRequest) {
        if (!serviceDraft.length) throw new Error("Keep at least one service on the appointment.");
        const selectedIds = serviceDraft.map((row) => String(row.serviceId));
        if (selectedIds.some((id) => id === "null") || new Set(selectedIds).size !== selectedIds.length) throw new Error("Choose each service once.");
        for (const row of serviceDraft) {
          const original = serviceRows.find((service) => String(service.id) === String(row.appointmentItemId));
          const service = activeServices.find((item) => String(item.id) === String(row.serviceId));
          const catalogChanged = !original || String(original.serviceId) !== String(row.serviceId) || String(original.optionId ?? null) !== String(row.optionId ?? null);
          if (catalogChanged && !service) throw new Error("Choose an active service.");
          const option = normalizeList(service?.service_options ?? service?.options).find((item) => String(item.id) === String(row.optionId));
          if (catalogChanged && ((service?.price_type === "from" && row.optionId == null) || (row.optionId != null && (!option || !isActiveRole(option) || option.price == null || !Number.isFinite(Number(option.price)))))) throw new Error("Choose an active priced option for the service.");
          const staffChanged = !original || String(original.providerId ?? null) !== String(row.staffId ?? null);
          if (staffChanged && row.staffId != null && !activeStaff.some((person) => String(personId(person)) === String(row.staffId))) throw new Error("Choose an active provider or leave the service unassigned.");
        }
      }
      const payload = editRequest ?? buildAppointmentEdit({
        ...(changedServices.length ? { services: changedServices } : {}),
        ...(editingPrice ? { price_adjustment: {
          final_total_amount_due: finalTotal,
          reason: priceReason,
          idempotency_key: createIdempotencyKey("portal-appointment-edit"),
        } } : {}),
        reason: editReason,
      }, changedServices.length ? undefined : currentTotal);
      setEditRequest(payload);
      sendEdit(payload);
    } catch (error) {
      message.error(error.message);
    }
  }

  function closeDrawer() {
    setEditing(false);
    setEditRequest(null);
    setEditingPrice(false);
    setOverrideConflict(null);
    onClose();
  }

  return (
    <Drawer
      open={Boolean(appointmentId)}
      onClose={closeDrawer}
      size={520}
      closeIcon={false}
      destroyOnHidden
      className="appointment-detail-drawer"
      title={null}
    >
      <header className="appointment-detail-header">
        <div>
          <span>Appointment record</span>
          <h2>{customerName(appointment)}</h2>
          <p>{appointmentReference(appointment)}</p>
        </div>
        <button onClick={closeDrawer} aria-label="Close appointment details"><FiX /></button>
      </header>

      {detailQ.isLoading ? (
        <div className="appointment-detail-loading">
          <Skeleton active paragraph={{ rows: 7 }} />
        </div>
      ) : detailQ.isError && !listAppointment ? (
        <div className="appointment-detail-error">
          <FiAlertCircle />
          <h3>Appointment details unavailable</h3>
          <p>{firstApiErrorMessage(detailQ.error, "The appointment could not be loaded.")}</p>
          <Button icon={<FiRefreshCw />} onClick={() => detailQ.refetch()}>Try again</Button>
        </div>
      ) : (
        <>
          <div className="appointment-detail-status-row">
            <StatusPill status={status} />
            <span>{start ? start.format("ddd, D MMM YYYY [at] h:mm A") : "Date unavailable"}</span>
          </div>

          <section className="appointment-detail-section">
            <h3>Visit details</h3>
            <div className="appointment-detail-grid">
              <DetailItem icon={<FiCalendar />} label="Date">{start?.format("D MMM YYYY")}</DetailItem>
              <DetailItem icon={<FiClock />} label="Time">{start?.format("h:mm A")}</DetailItem>
              <DetailItem icon={<FiUser />} label="Customer">{customerName(appointment)}</DetailItem>
              <DetailItem icon={<FiUsers />} label="Staff">{appointmentStaffNames(appointment)}</DetailItem>
            </div>
            <div className="appointment-service-block">
              <div className="appointment-service-heading"><span className="appointment-service-label">Services provided</span>{canEdit && !editing && <button onClick={openEditor}><FiUsers /> Edit appointment</button>}</div>
              <div className="appointment-service-list">
                {(editing ? serviceDraft : serviceRows).map((row, index) => {
                  const original = editing ? serviceRows.find((service) => String(service.id) === String(row.appointmentItemId)) : row;
                  const selectedId = row.serviceId;
                  const catalogService = activeServices.find((row) => String(row.id) === String(selectedId));
                  const options = normalizeList(catalogService?.service_options ?? catalogService?.options).filter((option) => isActiveRole(option) && option.price != null && Number.isFinite(Number(option.price)));
                  const fromPriced = catalogService?.price_type === "from";
                  const option = options.find((item) => String(item.id) === String(row.optionId));
                  const catalogChanged = editing && (!original || String(original.serviceId) !== String(row.serviceId) || String(original.optionId ?? null) !== String(row.optionId ?? null));
                  const lineTotal = editing && catalogChanged ? option?.price ?? catalogService?.price : original?.lineTotal;
                  const duration = editing && catalogChanged ? option?.duration ?? catalogService?.duration : original?.duration;
                  const extraTime = editing && catalogChanged ? catalogService?.extra_time ?? 0 : original?.extraTime;
                  const serviceName = catalogService?.name || catalogService?.service_name || original?.name || "Choose a service";
                  const providerName = editing
                    ? row.staffId == null ? "Unassigned" : personName(activeStaff.find((person) => String(personId(person)) === String(row.staffId))) || original?.provider || `Staff #${row.staffId}`
                    : original?.provider;
                  return (
                  <div className="appointment-service-line" key={editing ? row.clientId : original.id ?? `${original.name}-${index}`}>
                    <div className="appointment-service-main">
                      <div>
                        <strong>
                          {serviceName}
                          {!editing && original.quantity > 1 && <small> × {original.quantity}</small>}
                        </strong>
                        {editing && <div className="appointment-service-fields">
                          <Select
                            showSearch
                            optionFilterProp="label"
                            loading={servicesQ.isLoading}
                            disabled={editMutation.isPending || servicesQ.isError}
                            aria-label={`Service ${index + 1}`}
                            value={selectedId ?? undefined}
                            placeholder="Choose service"
                            onChange={(serviceId) => changeServiceDraft(row.clientId, { serviceId, optionId: null })}
                            options={[
                              ...activeServices.map((service) => ({ value: service.id, label: service.name || service.service_name, disabled: serviceDraft.some((other) => other.clientId !== row.clientId && String(other.serviceId) === String(service.id)) })),
                              ...(!catalogService && selectedId != null ? [{ value: selectedId, label: original?.name || "Recorded service", disabled: true }] : []),
                            ]}
                          />
                          <Select
                            aria-label={`Option for service ${index + 1}`}
                            disabled={editMutation.isPending || !catalogService}
                            value={row.optionId ?? "none"}
                            onChange={(optionId) => changeServiceDraft(row.clientId, { optionId: optionId === "none" ? null : optionId })}
                            options={[
                              { value: "none", label: fromPriced ? "Choose a priced option" : "No option", disabled: fromPriced },
                              ...options.map((item) => ({ value: item.id, label: `${item.name} · ${money(item.price, currency)}` })),
                              ...(String(selectedId) === String(original?.serviceId) && original?.optionId != null && !options.some((item) => String(item.id) === String(original.optionId)) ? [{ value: original.optionId, label: "Recorded option", disabled: true }] : []),
                            ]}
                          />
                        </div>}
                        {editing ? <Select
                          showSearch
                          optionFilterProp="label"
                          loading={staffQ.isLoading}
                          disabled={editMutation.isPending || staffQ.isError}
                          value={row.staffId ?? "unassigned"}
                          aria-label={`Provider for service ${index + 1}`}
                          onChange={(staffId) => changeServiceDraft(row.clientId, { staffId: staffId === "unassigned" ? null : staffId })}
                          options={[
                            { value: "unassigned", label: "Unassigned" },
                            ...activeStaff.map((person) => ({ value: personId(person), label: personName(person) || `Staff #${personId(person)}` })),
                            ...(row.staffId != null && !activeStaff.some((person) => String(personId(person)) === String(row.staffId)) ? [{ value: row.staffId, label: original?.provider || "Recorded provider", disabled: true }] : []),
                          ]}
                        /> : <span>Provided by {providerName}</span>}
                      </div>
                      <div className="appointment-service-actions">
                        {lineTotal != null && <b>{money(lineTotal, currency)}</b>}
                        {editing && <button type="button" onClick={() => removeServiceDraft(row.clientId)} disabled={editMutation.isPending || serviceDraft.length === 1} aria-label={`Remove ${serviceName}`}><FiTrash2 /></button>}
                      </div>
                    </div>
                    <div className="appointment-service-meta">
                      {!editing && serviceWindow(original) && <span><FiClock /> {serviceWindow(original)}</span>}
                      {durationLabel(duration, extraTime) && (
                        <span>{durationLabel(duration, extraTime)}</span>
                      )}
                      {!editing && original.quantity > 1 && original.price != null && (
                        <span>{money(original.price, currency)} each</span>
                      )}
                    </div>
                  </div>
                ); })}
              </div>
              {editing && <button type="button" className="appointment-add-service" onClick={addServiceDraft} disabled={editMutation.isPending || servicesQ.isError}><FiPlus /> Add service</button>}
              {editing && <div className="appointment-change-panel">
                {(servicesQ.isError || staffQ.isError) && <p>Some service or staff selections could not be loaded. <Button size="small" onClick={() => { servicesQ.refetch(); staffQ.refetch(); }}>Try again</Button></p>}
                {overrideConflict && <div className="appointment-override-conflict" role="alert"><strong>Provider confirmation required</strong><span>{overrideConflict.detail}</span>{overrideConflict.conflicts.map((conflict, index) => <small key={`${conflict.appointment_item_id ?? "new"}-${index}`}>{humanizeLabel(conflict.reason, "Provider conflict")}{conflict.staff_id ? ` · Staff #${conflict.staff_id}` : ""}</small>)}</div>}
                <label><span>Reason for change{overrideConflict ? " (required)" : " (optional)"}</span><Input.TextArea rows={2} maxLength={2000} disabled={editMutation.isPending} value={editReason} onChange={(event) => { setEditReason(event.target.value); if (!overrideConflict) setEditRequest(null); }} /></label>
                <div className="appointment-price-preview"><span>Updated appointment total</span><strong>{money(calculatedTotal, currency)}</strong><small>Service prices, duration, and times are finalized by the server when saved. Existing deposits are preserved.</small></div>
                {canAdjustPrice && Boolean(summary) && <Checkbox disabled={editMutation.isPending} checked={editingPrice} onChange={(event) => { setEditingPrice(event.target.checked); if (event.target.checked) setFinalTotal(calculatedTotal.toFixed(2)); setEditRequest(null); setOverrideConflict(null); }}>Set a different final total</Checkbox>}
                {editingPrice && <>
                  <label><span>Final appointment total ({currency})</span><Input disabled={editMutation.isPending} inputMode="decimal" value={finalTotal} onChange={(event) => { setFinalTotal(event.target.value); setEditRequest(null); }} prefix={currency} /></label>
                  <small>{Math.abs(priceDelta) < .005 ? "Enter a total different from the calculated amount" : `${priceDelta > 0 ? "Increase" : "Decrease"} of ${money(Math.abs(priceDelta), currency)}`}</small>
                  <label><span>Reason for price change</span><Input.TextArea disabled={editMutation.isPending} rows={2} maxLength={2000} value={priceReason} onChange={(event) => { setPriceReason(event.target.value); setEditRequest(null); }} /></label>
                  {numeric(finalTotal) < numeric(summary?.total_amount_paid) && <p>This total creates an overpayment. No refund or store credit will be issued automatically.</p>}
                </>}
                <div><Button disabled={editMutation.isPending} onClick={() => { setEditing(false); setEditingPrice(false); setEditRequest(null); setOverrideConflict(null); }}>Cancel</Button><Button type="primary" loading={editMutation.isPending} disabled={!canEdit || !serviceDraft.length || (!changedServices.length && !editingPrice) || (overrideConflict && !editReason.trim()) || (editingPrice && (!canAdjustPrice || !summary || !/^\d+(\.\d{1,2})?$/.test(finalTotal) || Math.abs(priceDelta) < .005 || priceReason.trim().length < 3))} onClick={submitEdit}>{overrideConflict ? "Confirm provider override" : "Save changes"}</Button></div>
              </div>}
            </div>
          </section>

          <section className="appointment-detail-section">
            <div className="appointment-section-heading">
              <h3>Settlement</h3>
              <div>{summaryQ.isFetching && <FiRefreshCw className="appointments-spin" />}{canAdjustPrice && !editingPrice && !editing && summaryQ.isSuccess && <button onClick={() => { openEditor(); setEditingPrice(true); }}><FiDollarSign /> Adjust price</button>}</div>
            </div>
            {permissionState("booking_settlements.view", appointment) === false ? <p className="appointment-financial-note">Financial summary access requires settlement view permission.</p> : summaryQ.isLoading ? (
              <div className="appointment-financial-loading"><Skeleton active paragraph={{ rows: 5 }} /></div>
            ) : summaryQ.isError ? (
              <button className="appointment-inline-retry" onClick={() => summaryQ.refetch()}>
                Balance unavailable. Check again
              </button>
            ) : (
              <>
                <div className="appointment-balance-card">
                  <div><span>Original services</span><strong>{money(financial?.original_net_total ?? appointmentTotal(appointment), currency)}</strong></div>
                  {numeric(financial?.active_addon_total) !== 0 && (
                    <div><span>Add-ons</span><strong>{money(financial.active_addon_total, currency)}</strong></div>
                  )}
                  {numeric(financial?.price_adjustment_total) !== 0 && (
                    <div><span>Price adjustment</span><strong>{money(financial.price_adjustment_total, currency)}</strong></div>
                  )}
                  <div><span>Deposit paid</span><strong>{money(financial?.deposit_amount_paid ?? financial?.online_amount_paid ?? fallbackPaid, currency)}</strong></div>
                  {numeric(financial?.salon_payments_received) !== 0 && (
                    <div><span>Paid in salon</span><strong>{money(financial.salon_payments_received, currency)}</strong></div>
                  )}
                  {numeric(financial?.salon_payment_reversals) !== 0 && (
                    <div><span>Salon payment reversals</span><strong>−{money(financial.salon_payment_reversals, currency)}</strong></div>
                  )}
                  <div className="appointment-financial-total"><span>Adjusted total due</span><strong>{money(financial?.total_amount_due ?? appointmentTotal(appointment), currency)}</strong></div>
                  <div><span>Total paid</span><strong>{money(financial?.total_amount_paid ?? fallbackPaid, currency)}</strong></div>
                  <div className={remaining > 0 ? "has-balance" : "is-settled"}>
                    <span>{overpayment > 0 || financial?.settlement_status === "overpaid" ? "Overpayment" : remaining > 0 ? "Outstanding" : "Payment status"}</span>
                    <strong>{overpayment > 0 || financial?.settlement_status === "overpaid" ? money(overpayment, currency) : remaining > 0 ? money(remaining, currency) : "Settled"}</strong>
                  </div>
                </div>
                {financial?.latest_revision_type && (
                  <p className="appointment-financial-note">
                    Current calculation: {humanizeLabel(financial.latest_revision_type, "Latest calculation")}. Salon payments and adjustments are included above.
                  </p>
                )}
              </>
            )}
          </section>

          <section className="appointment-detail-section">
            <h3>Original booking payments</h3>
            {originalPayments.length ? (
              <div className="appointment-payment-list">
                {originalPayments.map((payment, index) => {
                  const paidAt = dayjs(payment.paid_at || payment.created_at);
                  return (
                    <div className="appointment-payment-row" key={payment.id ?? index}>
                      <span className="appointment-payment-icon"><FiCreditCard /></span>
                      <div>
                        <strong>{humanizeLabel(payment.payment_method)}</strong>
                        <span>
                          {payment.is_deposit ? "Deposit" : "Booking payment"}
                          {payment.status ? ` · ${humanizeLabel(payment.status)}` : ""}
                          {paidAt.isValid() ? ` · ${paidAt.format("D MMM YYYY, h:mm A")}` : ""}
                        </span>
                        {payment.external_reference && <small>{payment.external_reference}</small>}
                      </div>
                      <b>{money(payment.amount, currency)}</b>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="appointment-detail-empty-copy">No original booking payments were recorded.</p>
            )}
            <p className="appointment-financial-note">
              On-site payments are represented in the financial summary above and are not part of this original booking-payment list.
            </p>
          </section>

          {correctionEvidence && (
            <section className="appointment-correction-evidence" aria-label="Correction confirmation">
              <div className="appointment-correction-evidence-heading">
                <FiCheckCircle />
                <div>
                  <strong>Attendance corrected</strong>
                  <span>
                    {correctionEvidence.corrected_by?.name || correctionEvidence.corrected_by?.email || "Portal staff"}
                    {dayjs(correctionEvidence.corrected_at).isValid() ? ` · ${dayjs(correctionEvidence.corrected_at).format("D MMM YYYY, h:mm A")}` : ""}
                    {correctionEvidence.audit_id ? ` · Audit #${correctionEvidence.audit_id}` : ""}
                  </span>
                </div>
              </div>
              {correctionEvidence.reason && <p>{correctionEvidence.reason}</p>}
              <div className="appointment-correction-results">
                {correctionPriceAdjustment && (
                  <span>
                    Price {signedMoney(correctionPriceAdjustment.amount_delta, correctionPriceAdjustment.currency || currency)} · final {money(correctionPriceAdjustment.final_total_amount_due, correctionPriceAdjustment.currency || currency)}
                  </span>
                )}
                {correctionPayment && (
                  <span>
                    {money(correctionPayment.amount, correctionPayment.currency || currency)} recorded by {humanizeLabel(correctionPayment.payment_method)}
                    {correctionPayment.external_reference ? ` · ${correctionPayment.external_reference}` : ""}
                  </span>
                )}
                {correctionEvidence.previous_deposit_status && correctionEvidence.deposit_status && correctionEvidence.previous_deposit_status !== correctionEvidence.deposit_status && (
                  <span>Deposit restored to {humanizeLabel(correctionEvidence.deposit_status)}</span>
                )}
                {correctionLoyalty?.qualified && <span>Loyalty points awarded</span>}
              </div>
            </section>
          )}

          {status === "no-show" && canCorrect && onCorrect && (
            <section className="appointment-correction-section">
              <div className="appointment-correction-copy">
                <div className="appointment-correction-icon"><FiCheckCircle /></div>
                <div>
                  <h3>Was this recorded incorrectly?</h3>
                  <p>Correct the attendance, settle any balance, and preserve a reason in the audit history.</p>
                </div>
              </div>
              <button className="appointment-correction-button" onClick={() => onCorrect(appointment)}>
                Correct attendance <FiArrowRight />
              </button>
            </section>
          )}

          {statusHistory.length > 0 && (
            <details className="appointment-history">
              <summary>Status history <span>{statusHistory.length}</span></summary>
              <div>
                {statusHistory.map((entry, index) => {
                  const changedAt = dayjs(entry.created_at);
                  return (
                    <article key={entry.id ?? index}>
                      <strong>{normalizeStatus(entry.previous_status).replaceAll("-", " ")} → {normalizeStatus(entry.new_status).replaceAll("-", " ")}</strong>
                      <span>{changedAt.isValid() ? changedAt.format("D MMM YYYY, h:mm A") : "Date unavailable"}{entry.changed_by_email ? ` · ${entry.changed_by_email}` : ""}</span>
                      {entry.reason && <p>{entry.reason}</p>}
                    </article>
                  );
                })}
              </div>
            </details>
          )}
        </>
      )}
    </Drawer>
  );
}

export default function AppointmentsPage() {
  const bookingV2 = useBookingV2();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [settlementFilter, setSettlementFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [correctionAppointment, setCorrectionAppointment] = useState(null);

  const appointmentsQ = useQuery({
    queryKey: bookingV2.enabled ? bookingV2Keys.appointments({ ledger: true }) : ["appointments-ledger"],
    queryFn: () => bookingV2.enabled
      ? listAppointmentsV2()
      : _axios.get("/api/portal/v1/booking/appointments/").then((response) => response.data),
    staleTime: 30_000,
  });

  const appointments = useMemo(() => normalizeList(appointmentsQ.data), [appointmentsQ.data]);
  const selectedListAppointment = appointments.find((row) => String(row.id) === String(selectedId));

  const filteredAppointments = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return appointments
      .filter((appointment) => {
        const status = normalizeStatus(appointment.status);
        if (statusFilter !== "all" && status !== statusFilter) return false;
        if (settlementFilter !== "all" && settlementCategory(appointment) !== settlementFilter) return false;
        const start = appointmentStart(appointment);
        if (fromDate && (!start || start.isBefore(dayjs(fromDate), "day"))) return false;
        if (toDate && (!start || start.isAfter(dayjs(toDate), "day"))) return false;
        if (!needle) return true;
        return [
          appointment.id,
          appointmentReference(appointment),
          customerName(appointment),
          serviceNames(appointment),
          appointmentStaffNames(appointment),
        ].some((value) => String(value || "").toLowerCase().includes(needle));
      })
      .sort((a, b) => (appointmentStart(b)?.valueOf() || 0) - (appointmentStart(a)?.valueOf() || 0));
  }, [appointments, fromDate, search, settlementFilter, statusFilter, toDate]);

  const noShowCount = appointments.filter((appointment) => normalizeStatus(appointment.status) === "no-show").length;
  const completedCount = appointments.filter((appointment) => normalizeStatus(appointment.status) === "completed").length;
  const activeFilterCount = [
    statusFilter !== "all",
    settlementFilter !== "all",
    Boolean(fromDate),
    Boolean(toDate),
    Boolean(search.trim()),
  ].filter(Boolean).length;

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setSettlementFilter("all");
    setFromDate("");
    setToDate("");
  }

  function handleCorrected(correctionResult) {
    const responseHasEnvelope = Boolean(correctionResult?.appointment);
    const responseAppointment = correctionResult?.appointment ?? correctionResult;
    if (!responseAppointment?.id) return;

    const updatedAppointment = responseHasEnvelope
      ? {
          ...responseAppointment,
          ...(correctionResult.financial_summary
            ? {
                total_amount_due: correctionResult.financial_summary.total_amount_due,
                total_amount_paid: correctionResult.financial_summary.total_amount_paid,
                remaining_amount_due: correctionResult.financial_summary.remaining_amount_due,
                settlement_status: correctionResult.financial_summary.settlement_status,
              }
            : {}),
          correction_evidence: correctionResult.correction ?? null,
          correction_price_adjustment: correctionResult.price_adjustment ?? null,
          correction_payment: correctionResult.payment ?? null,
          correction_loyalty: correctionResult.loyalty ?? null,
        }
      : responseAppointment;

    queryClient.setQueryData(bookingV2.enabled ? bookingV2Keys.appointments({ ledger: true }) : ["appointments-ledger"], (current) =>
      updateAppointmentCollection(current, updatedAppointment),
    );
    queryClient.setQueryData(bookingV2.enabled ? bookingV2Keys.appointment(updatedAppointment.id) : ["appointment-detail", updatedAppointment.id], updatedAppointment);

    if (responseHasEnvelope && Object.prototype.hasOwnProperty.call(correctionResult, "financial_summary")) {
      queryClient.setQueryData(
        ["appointment-financial-summary", updatedAppointment.id],
        correctionResult.financial_summary,
      );
    }

    setCorrectionAppointment(null);
    if (correctionResult?.payment) {
      message.success(`Appointment completed and ${money(correctionResult.payment.amount, correctionResult.payment.currency || "GHS")} recorded.`);
    } else {
      message.success("Appointment corrected and completed successfully.");
    }

    void Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: ["appointments"] }),
      queryClient.invalidateQueries({ queryKey: ["booking-v2", "appointments"] }),
      queryClient.invalidateQueries({ queryKey: ["client-bookings"] }),
      queryClient.invalidateQueries({
        predicate: (query) => String(query.queryKey[0] || "").startsWith("analytics-"),
      }),
      queryClient.invalidateQueries({
        predicate: (query) => String(query.queryKey[0] || "").startsWith("dash-analytics-"),
      }),
      ...(!responseHasEnvelope
        ? [queryClient.invalidateQueries({ queryKey: ["appointment-financial-summary", updatedAppointment.id] })]
        : []),
    ]);
  }

  return (
    <div className="appointments-page">
      <header className="appointments-page-heading">
        <div>
          <h1>Appointment records</h1>
          <p>Review visits and payment details without changing the working calendar.</p>
        </div>
        <div className="appointments-ledger-summary" aria-label="Appointment summary">
          <div><span>Records</span><strong>{appointments.length}</strong></div>
          <div><span>Completed</span><strong>{completedCount}</strong></div>
          <button onClick={() => setStatusFilter("no-show")} className={statusFilter === "no-show" ? "active" : ""}>
            <span>Needs review</span><strong>{noShowCount}</strong>
          </button>
        </div>
      </header>

      <section className="appointments-toolbar" aria-label="Appointment filters">
        <div className="appointments-search">
          <FiSearch />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search customer, reference, service, or staff"
            allowClear
            variant="borderless"
          />
        </div>
        <Select
          className="appointments-status-filter"
          value={statusFilter}
          options={STATUS_OPTIONS}
          onChange={setStatusFilter}
          aria-label="Filter by status"
        />
        <Select
          className="appointments-settlement-filter"
          value={settlementFilter}
          options={SETTLEMENT_OPTIONS}
          onChange={setSettlementFilter}
          aria-label="Filter by payment state"
        />
        <label className="appointments-date-filter"><span>From</span><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
        <label className="appointments-date-filter"><span>To</span><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
        {activeFilterCount > 0 && <button className="appointments-clear" onClick={clearFilters}>Clear {activeFilterCount}</button>}
        <button className="appointments-refresh" onClick={() => appointmentsQ.refetch()} disabled={appointmentsQ.isFetching} aria-label="Refresh appointments">
          <FiRefreshCw className={appointmentsQ.isFetching ? "appointments-spin" : ""} />
        </button>
      </section>

      <section className="appointments-ledger">
        <div className="appointments-ledger-title">
          <div>
            <h2>{statusFilter === "no-show" ? "No-shows awaiting review" : "All appointment records"}</h2>
            <p>{filteredAppointments.length} matching appointment{filteredAppointments.length === 1 ? "" : "s"}</p>
          </div>
          {noShowCount > 0 && statusFilter !== "no-show" && (
            <button onClick={() => setStatusFilter("no-show")}><FiAlertCircle /> Review {noShowCount} no-show{noShowCount === 1 ? "" : "s"}</button>
          )}
        </div>

        {appointmentsQ.isLoading ? (
          <div className="appointments-loading-list">
            {[1, 2, 3, 4, 5].map((item) => <Skeleton key={item} active paragraph={{ rows: 1 }} />)}
          </div>
        ) : appointmentsQ.isError ? (
          <div className="appointments-empty">
            <FiAlertCircle />
            <h3>Appointments could not be loaded</h3>
            <p>{firstApiErrorMessage(appointmentsQ.error, "Refresh the page and try again.")}</p>
            <Button icon={<FiRefreshCw />} onClick={() => appointmentsQ.refetch()}>Try again</Button>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="appointments-empty">
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={false} />
            <h3>No matching appointments</h3>
            <p>Adjust the filters to see more appointment records.</p>
            {activeFilterCount > 0 && <Button onClick={clearFilters}>Clear filters</Button>}
          </div>
        ) : (
          <>
            <div className="appointments-table-wrap">
              <table className="appointments-table">
                <thead><tr><th>Appointment</th><th>Customer</th><th>Service</th><th>Staff</th><th>Status</th><th>Total</th><th><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {filteredAppointments.map((appointment) => {
                    const start = appointmentStart(appointment);
                    const status = normalizeStatus(appointment.status);
                    const canCorrect = status === "no-show" && permissionState("appointments.edit", appointment) !== false;
                    return (
                      <tr key={appointment.id} onClick={() => setSelectedId(appointment.id)}>
                        <td><strong>{start?.format("D MMM YYYY") || "Date unavailable"}</strong><span>{start?.format("h:mm A") || appointmentReference(appointment)}</span></td>
                        <td><strong>{customerName(appointment)}</strong><span>{appointmentReference(appointment)}</span></td>
                        <td className="appointments-service-cell">{serviceNames(appointment)}</td>
                        <td>{appointmentStaffNames(appointment)}</td>
                        <td><StatusPill status={status} /></td>
                        <td><strong>{money(appointmentTotal(appointment), appointmentCurrency(appointment))}</strong>{appointmentDeposit(appointment) != null && <span>Deposit {money(appointmentDeposit(appointment), appointmentCurrency(appointment))}</span>}</td>
                        <td>
                          {canCorrect ? (
                            <button className="appointments-row-correct" aria-label={`Correct attendance for ${appointmentReference(appointment)}`} onClick={(event) => { event.stopPropagation(); setSelectedId(appointment.id); setCorrectionAppointment(appointment); }}>
                              Correct
                            </button>
                          ) : (
                            <button className="appointments-row-open" onClick={(event) => { event.stopPropagation(); setSelectedId(appointment.id); }} aria-label={`Open ${appointmentReference(appointment)}`}><FiArrowRight /></button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="appointments-mobile-list">
              {filteredAppointments.map((appointment) => {
                const start = appointmentStart(appointment);
                const status = normalizeStatus(appointment.status);
                const canCorrect = status === "no-show" && permissionState("appointments.edit", appointment) !== false;
                return (
                  <article key={appointment.id} className="appointment-mobile-card" onClick={() => setSelectedId(appointment.id)}>
                    <div className="appointment-mobile-top">
                      <div><strong>{customerName(appointment)}</strong><span>{appointmentReference(appointment)}</span></div>
                      <StatusPill status={status} />
                    </div>
                    <p>{serviceNames(appointment)}</p>
                    <div className="appointment-mobile-meta"><span><FiCalendar /> {start?.format("D MMM YYYY") || "—"}</span><span><FiClock /> {start?.format("h:mm A") || "—"}</span></div>
                    <div className="appointment-mobile-footer">
                      <span>{appointmentStaffNames(appointment)}{appointmentDeposit(appointment) != null ? ` · Deposit ${money(appointmentDeposit(appointment), appointmentCurrency(appointment))}` : ""}</span>
                      {canCorrect ? (
                        <button onClick={(event) => { event.stopPropagation(); setSelectedId(appointment.id); setCorrectionAppointment(appointment); }}>Correct attendance</button>
                      ) : <FiArrowRight />}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>

      <AppointmentDetailDrawer
        key={selectedId ?? "closed"}
        appointmentId={selectedId}
        listAppointment={selectedListAppointment}
        enableCorrections
        onClose={() => setSelectedId(null)}
        onCorrect={setCorrectionAppointment}
      />
      <CorrectNoShowModal
        open={Boolean(correctionAppointment)}
        appointment={correctionAppointment}
        onClose={() => setCorrectionAppointment(null)}
        onCorrected={handleCorrected}
      />
    </div>
  );
}
