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
  FiRefreshCw,
  FiSearch,
  FiUser,
  FiUsers,
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
  buildServiceCorrections,
  editAppointment,
} from "../src/api/appointmentSchedule.js";
import { isActiveRole, isStaffEligibleForCorrection } from "../src/api/providerEligibility.js";
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
      .sort((a, b) => numeric(a?.sort_order) - numeric(b?.sort_order))
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
    appointment.total_amount_due ?? appointment.subtotal_amount ?? appointment.service_price ??
    appointment.total_price ?? appointment.total ?? appointment.amount_due,
  );
}

function appointmentBalance(appointment = {}) {
  return numeric(
    appointment.remaining_amount_due ?? appointment.remaining_balance_amount ?? appointment.outstanding_balance,
  );
}

function originalBookingPaid(appointment = {}) {
  const payments = normalizeList(appointment.payments);
  const completed = payments
    .filter((payment) => ["completed", "paid", "received", "success", "succeeded"].includes(String(payment?.status || "").toLowerCase()))
    .reduce((sum, payment) => sum + numeric(payment?.amount), 0);
  return completed || numeric(appointment.deposit_amount);
}

function settlementCategory(appointment = {}) {
  if (appointment.is_settled === true || appointment.balance_settled === true) return "settled";
  if (appointment.is_settled === false || appointment.balance_settled === false) return "unsettled";

  const rawStatus = String(
    appointment.settlement_status || appointment.appointment_payment_status ||
    appointment.payment_status || "",
  ).toLowerCase().replaceAll("_", "-");
  if (["paid", "settled", "no-payment-required", "waived"].includes(rawStatus)) return "settled";
  if (["unpaid", "partially-paid", "partial", "payment-due", "overpaid"].includes(rawStatus)) return "unsettled";

  const balanceFields = [
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
  const [serviceDraft, setServiceDraft] = useState({});
  const [editReason, setEditReason] = useState("");
  const [editRequest, setEditRequest] = useState(null);
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
  const categoriesQ = useQuery({
    queryKey: ["service-categories"],
    queryFn: () => _axios.get("/api/portal/v1/booking/service-categories/").then((response) => normalizeList(response.data)),
    enabled: editing,
    staleTime: 300_000,
  });
  const appointment = detailQ.data || listAppointment || {};
  const summary = summaryQ.data;
  const start = appointmentStart(appointment);
  const status = normalizeStatus(appointment.status);
  const currency = summary?.currency || appointment.currency || "GHS";
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
  const priceDelta = numeric(finalTotal) - currentTotal;
  const changedServices = buildServiceCorrections(serviceRows, serviceDraft);
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
      setEditing(false);
      setEditingPrice(false);
      setEditRequest(null);
      await refreshAppointment();
      message.success("Appointment corrections saved.");
    },
    onError: (error) => message.error(firstApiErrorMessage(error, "The appointment corrections could not be saved.")),
  });

  function openEditor() {
    setServiceDraft({});
    setEditReason("");
    setEditRequest(null);
    setFinalTotal(currentTotal.toFixed(2));
    setPriceReason("");
    setEditingPrice(false);
    setEditing(true);
  }

  function changeServiceDraft(id, changes) {
    setServiceDraft((current) => ({ ...current, [String(id)]: { ...current[String(id)], ...changes } }));
    setEditRequest(null);
  }

  function submitEdit() {
    try {
      if (!canEdit || (editingPrice && !canAdjustPrice)) throw new Error("You cannot edit this appointment.");
      if (!editRequest) {
        for (const patch of changedServices) {
          const row = serviceRows.find((service) => String(service.id) === String(patch.appointment_item_id));
          const service = activeServices.find((service) => String(service.id) === String(patch.service_id ?? row.serviceId));
          if (patch.service_id !== undefined || patch.service_option_id !== undefined) {
            if (!service) throw new Error("Choose an active service.");
            const optionId = patch.service_option_id !== undefined ? patch.service_option_id : row.optionId;
            const option = normalizeList(service.service_options ?? service.options).find((option) => String(option.id) === String(optionId));
            if ((service.price_type === "from" && optionId == null) || (optionId != null && (!option || !isActiveRole(option) || option.price == null || !Number.isFinite(Number(option.price))))) throw new Error("Choose an active priced option for the service.");
          }
          if (patch.staff_id !== undefined || patch.service_id !== undefined) {
            const staff = activeStaff.find((person) => String(personId(person)) === String(patch.staff_id ?? row.providerId));
            if (!staff || !service || !isStaffEligibleForCorrection(service, staff, normalizeList(categoriesQ.data))) throw new Error("Choose an eligible active provider for the service.");
          }
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
      }, currentTotal);
      setEditRequest(payload);
      editMutation.mutate(payload);
    } catch (error) {
      message.error(error.message);
    }
  }

  function closeDrawer() {
    setEditing(false);
    setEditRequest(null);
    setEditingPrice(false);
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
              <DetailItem icon={<FiUsers />} label="Staff">{staffName(appointment)}</DetailItem>
            </div>
            <div className="appointment-service-block">
              <div className="appointment-service-heading"><span className="appointment-service-label">Services provided</span>{canEdit && !editing && <button onClick={openEditor}><FiUsers /> Edit appointment</button>}</div>
              <div className="appointment-service-list">
                {serviceRows.map((service, index) => {
                  const draft = serviceDraft[String(service.id)] ?? {};
                  const selectedId = draft.service_id ?? service.serviceId;
                  const catalogService = activeServices.find((row) => String(row.id) === String(selectedId));
                  const options = normalizeList(catalogService?.service_options ?? catalogService?.options).filter((option) => isActiveRole(option) && option.price != null && Number.isFinite(Number(option.price)));
                  const fromPriced = catalogService?.price_type === "from";
                  const providers = catalogService ? activeStaff.filter((person) => isStaffEligibleForCorrection(catalogService, person, normalizeList(categoriesQ.data))) : [];
                  return (
                  <div className="appointment-service-line" key={service.id ?? `${service.name}-${index}`}>
                    <div className="appointment-service-main">
                      <div>
                        <strong>
                          {service.name}
                          {service.quantity > 1 && <small> × {service.quantity}</small>}
                        </strong>
                        {editing && service.canReassign && <>
                          <Select
                            showSearch
                            optionFilterProp="label"
                            loading={servicesQ.isLoading}
                            disabled={editMutation.isPending || servicesQ.isError}
                            aria-label={`Service for ${service.name}`}
                            value={selectedId}
                            onChange={(serviceId) => changeServiceDraft(service.id, { service_id: serviceId, service_option_id: null })}
                            options={[
                              ...activeServices.map((row) => ({ value: row.id, label: row.name || row.service_name, disabled: serviceRows.some((other) => String(other.id) !== String(service.id) && (String(other.serviceId) === String(row.id) || String(serviceDraft[String(other.id)]?.service_id ?? other.serviceId) === String(row.id))) })),
                              ...(!catalogService ? [{ value: selectedId, label: service.name, disabled: true }] : []),
                            ]}
                          />
                          <Select
                            aria-label={`Option for ${service.name}`}
                            disabled={editMutation.isPending || !catalogService}
                            value={(draft.service_option_id !== undefined ? draft.service_option_id : service.optionId) ?? "none"}
                            onChange={(optionId) => changeServiceDraft(service.id, { service_option_id: optionId === "none" ? null : optionId })}
                            options={[
                              { value: "none", label: fromPriced ? "Choose a priced option" : "No option", disabled: fromPriced },
                              ...options.map((option) => ({ value: option.id, label: option.name })),
                              ...(String(selectedId) === String(service.serviceId) && service.optionId != null && !options.some((option) => String(option.id) === String(service.optionId)) ? [{ value: service.optionId, label: "Recorded option", disabled: true }] : []),
                            ]}
                          />
                        </>}
                        {editing && service.canReassign ? <Select
                          showSearch
                          optionFilterProp="label"
                          loading={staffQ.isLoading}
                          disabled={editMutation.isPending || staffQ.isError}
                          value={draft.staff_id ?? service.providerId ?? undefined}
                          placeholder="Choose staff"
                          aria-label={`Staff for ${service.name}`}
                          onChange={(staffId) => changeServiceDraft(service.id, { staff_id: staffId })}
                          options={[
                            ...providers.map((person) => ({ value: personId(person), label: personName(person) || `Staff #${personId(person)}` })),
                            ...(service.providerId != null && !providers.some((person) => String(personId(person)) === String(service.providerId)) ? [{ value: service.providerId, label: service.provider, disabled: true }] : []),
                          ]}
                        /> : <span>Provided by {service.provider}</span>}
                      </div>
                      {service.lineTotal != null && (
                        <b>{money(service.lineTotal, currency)}</b>
                      )}
                    </div>
                    <div className="appointment-service-meta">
                      {serviceWindow(service) && <span><FiClock /> {serviceWindow(service)}</span>}
                      {durationLabel(service.duration, service.extraTime) && (
                        <span>{durationLabel(service.duration, service.extraTime)}</span>
                      )}
                      {service.quantity > 1 && service.price != null && (
                        <span>{money(service.price, currency)} each</span>
                      )}
                    </div>
                  </div>
                ); })}
              </div>
              {editing && <div className="appointment-change-panel">
                {(servicesQ.isError || staffQ.isError || categoriesQ.isError) && <p>Some service or staff selections could not be loaded. <Button size="small" onClick={() => { servicesQ.refetch(); staffQ.refetch(); categoriesQ.refetch(); }}>Try again</Button></p>}
                <label><span>Reason for correction (optional)</span><Input.TextArea rows={2} maxLength={2000} disabled={editMutation.isPending} value={editReason} onChange={(event) => { setEditReason(event.target.value); setEditRequest(null); }} /></label>
                <p>Only changed rows are saved. Booked times, durations, prices, and deposits stay unchanged. Use the calendar to move an appointment.</p>
                {canAdjustPrice && summaryQ.isSuccess && <Checkbox disabled={editMutation.isPending} checked={editingPrice} onChange={(event) => { setEditingPrice(event.target.checked); setEditRequest(null); }}>Include a price correction</Checkbox>}
                {editingPrice && <>
                  <label><span>Final appointment total ({currency})</span><Input disabled={editMutation.isPending} inputMode="decimal" value={finalTotal} onChange={(event) => { setFinalTotal(event.target.value); setEditRequest(null); }} prefix={currency} /></label>
                  <small>{Math.abs(priceDelta) < .005 ? "Enter a different final total" : `${priceDelta > 0 ? "Increase" : "Decrease"} of ${money(Math.abs(priceDelta), currency)}`}</small>
                  <label><span>Reason for price change</span><Input.TextArea disabled={editMutation.isPending} rows={2} maxLength={2000} value={priceReason} onChange={(event) => { setPriceReason(event.target.value); setEditRequest(null); }} /></label>
                  {numeric(finalTotal) < numeric(summary?.total_amount_paid) && <p>This total creates an overpayment. No refund or store credit will be issued automatically.</p>}
                </>}
                <div><Button disabled={editMutation.isPending} onClick={() => { setEditing(false); setEditingPrice(false); setEditRequest(null); }}>Cancel</Button><Button type="primary" loading={editMutation.isPending} disabled={!canEdit || (!changedServices.length && !editingPrice) || (editingPrice && (!canAdjustPrice || !summaryQ.isSuccess || !/^\d+(\.\d{1,2})?$/.test(finalTotal) || Math.abs(priceDelta) < .005 || priceReason.trim().length < 3))} onClick={submitEdit}>Save corrections</Button></div>
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
                  <div><span>Paid online</span><strong>{money(financial?.online_amount_paid ?? fallbackPaid, currency)}</strong></div>
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
          staffName(appointment),
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
                        <td>{staffName(appointment)}</td>
                        <td><StatusPill status={status} /></td>
                        <td><strong>{money(appointmentTotal(appointment), appointment.currency || "GHS")}</strong></td>
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
                      <span>{staffName(appointment)}</span>
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
