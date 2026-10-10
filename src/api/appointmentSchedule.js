import _axios from "./_axios.js";
import { scheduleAppointmentV2 } from "./bookingV2.js";

export const STAFF_SERVICE_OVERRIDE_CODE =
  "STAFF_SERVICE_OVERRIDE_CONFIRMATION_REQUIRED";

export function buildScheduleUpdate(update = {}) {
  const payload = {};

  if (update.date !== undefined) payload.date = update.date;
  if (update.start_time !== undefined) payload.start_time = update.start_time;
  if (update.staff_id !== undefined) payload.staff_id = update.staff_id;
  if (update.reason) payload.reason = update.reason;
  if (update.confirm_unassigned_staff === true) {
    payload.confirm_unassigned_staff = true;
  }

  if (!["date", "start_time", "staff_id"].some((field) => field in payload)) {
    throw new Error("A date, start time, or staff member is required to reschedule an appointment.");
  }

  return payload;
}

export async function moveAppointment(appointmentId, update, { v2 = false } = {}) {
  if (v2) return scheduleAppointmentV2(appointmentId, buildScheduleUpdate(update));
  const response = await _axios.patch(
    `/api/portal/v1/booking/appointments/${appointmentId}/schedule/`,
    buildScheduleUpdate(update),
  );

  return response.data;
}

export function buildServiceOperations(rows, draftRows) {
  const originals = new Map(rows.filter((row) => row.canReassign).map((row) => [String(row.id), row]));
  const retained = new Set();
  const operations = [];

  for (const row of draftRows) {
    if (row.appointmentItemId == null) {
      operations.push({
        operation: "add",
        service_id: row.serviceId,
        service_option_id: row.optionId ?? null,
        staff_id: row.staffId ?? null,
      });
      continue;
    }

    const id = String(row.appointmentItemId);
    const original = originals.get(id);
    retained.add(id);
    if (!original) continue;
    const operation = { operation: "update", appointment_item_id: original.id };
    if (String(row.serviceId) !== String(original.serviceId)) {
      operation.service_id = row.serviceId;
      operation.service_option_id = row.optionId ?? null;
    } else if (String(row.optionId ?? null) !== String(original.optionId ?? null)) {
      operation.service_option_id = row.optionId ?? null;
    }
    if (String(row.staffId ?? null) !== String(original.providerId ?? null)) operation.staff_id = row.staffId ?? null;
    if (Object.keys(operation).length > 2) operations.push(operation);
  }

  for (const [id, row] of originals) {
    if (!retained.has(id)) operations.push({ operation: "remove", appointment_item_id: row.id });
  }
  return operations;
}

export function buildAppointmentEdit(update = {}, currentTotal) {
  if (Object.keys(update).some((key) => !["services", "price_adjustment", "reason", "confirm_provider_override"].includes(key))) throw new Error("Unsupported appointment edit field.");
  const payload = {};
  if (update.services !== undefined) {
    if (!Array.isArray(update.services) || !update.services.length) throw new Error("Change at least one service or provider.");
    const ids = new Set();
    payload.services = update.services.map((row) => {
      if (!row || typeof row !== "object") throw new Error("Choose a valid service operation.");
      const operation = row.operation ?? "update";
      if (!["update", "add", "remove"].includes(operation) || Object.keys(row).some((key) => !["operation", "appointment_item_id", "service_id", "service_option_id", "staff_id"].includes(key))) throw new Error("Choose a valid service operation.");
      const id = row.appointment_item_id;
      if (operation === "add") {
        if (id != null || row.service_id == null) throw new Error("Choose a service to add.");
      } else {
        if (id == null || ids.has(String(id))) throw new Error("Each appointment item must appear once.");
        ids.add(String(id));
      }
      if (operation === "remove" && Object.keys(row).some((key) => !["operation", "appointment_item_id"].includes(key))) throw new Error("Removed services cannot include replacement fields.");
      if (operation === "update" && !["service_id", "service_option_id", "staff_id"].some((key) => key in row)) throw new Error("Choose a service, option, or provider for each edit.");
      if ("service_id" in row && row.service_id == null) throw new Error("Choose a service.");
      if (["service_id", "service_option_id", "staff_id"].some((key) => key in row && row[key] === undefined)) throw new Error("Service selections cannot be undefined.");
      return { ...row, operation };
    });
  }
  if (update.price_adjustment !== undefined) {
    payload.price_adjustment = buildPriceAdjustment(update.price_adjustment);
    if (currentTotal != null && Number(payload.price_adjustment.final_total_amount_due) === Number(currentTotal)) throw new Error("Enter a different final total.");
  }
  if (!payload.services && !payload.price_adjustment) throw new Error("Include a service edit or price adjustment.");
  if (update.reason?.trim()) payload.reason = update.reason.trim();
  if (update.confirm_provider_override === true) {
    if (!payload.reason) throw new Error("Enter a reason before confirming the provider override.");
    payload.confirm_provider_override = true;
  }
  return payload;
}

export const hasStructuralServiceOperations = (payload = {}) =>
  Array.isArray(payload.services) && payload.services.some((row) => ["add", "remove"].includes(row.operation));

export function getAppointmentEditConfirmation(error) {
  const data = error?.response?.data;
  if (error?.response?.status !== 409 || data?.code !== "APPOINTMENT_EDIT_CONFIRMATION_REQUIRED") return null;
  return {
    detail: data.detail || "Review the provider conflicts before saving.",
    canProceed: data.can_proceed !== false,
    conflicts: Array.isArray(data.conflicts) ? data.conflicts : [],
  };
}

export const editAppointment = (appointmentId, update, currentTotal) =>
  _axios.patch(
    `/api/portal/v2/booking/appointments/${appointmentId}/edit/`,
    buildAppointmentEdit(update, currentTotal),
  ).then((response) => response.data);

export function buildPriceAdjustment(update = {}) {
  if (Object.keys(update).some((key) => !["final_total_amount_due", "reason", "idempotency_key"].includes(key))) throw new Error("Unsupported price adjustment field.");
  const finalTotal = Number(update.final_total_amount_due);
  const reason = typeof update.reason === "string" ? update.reason.trim() : "";
  if (!/^\d+(\.\d{1,2})?$/.test(String(update.final_total_amount_due)) || !Number.isFinite(finalTotal)) throw new Error("Enter a nonnegative final total with at most two decimal places.");
  if (reason.length < 3) throw new Error("Enter a reason for the price change.");
  if (reason.length > 2000) throw new Error("Keep the price-change reason within 2,000 characters.");
  if (typeof update.idempotency_key !== "string" || !update.idempotency_key.trim() || update.idempotency_key.length > 255) throw new Error("A price adjustment idempotency key of at most 255 characters is required.");
  const [whole, fraction = ""] = String(update.final_total_amount_due).split(".");
  return {
    final_total_amount_due: `${whole}.${fraction.padEnd(2, "0")}`,
    reason,
    idempotency_key: update.idempotency_key,
  };
}

export const createAppointmentPriceAdjustment = (appointmentId, update) =>
  _axios.post(
    `/api/portal/v1/booking/appointments/${appointmentId}/price-adjustments/`,
    buildPriceAdjustment(update),
  ).then((response) => response.data);

export function getStaffServiceOverride(error) {
  const response = error?.response;
  const data = response?.data;

  if (
    response?.status !== 409 ||
    (data?.code && ![STAFF_SERVICE_OVERRIDE_CODE, "staff_service_override_confirmation_required"].includes(data.code)) ||
    data?.requires_confirmation !== true
  ) {
    return null;
  }

  return {
    message: data.detail || "This provider is not assigned to every service in the appointment.",
    canProceed: data.can_proceed !== false,
    staff: data.staff ?? null,
    services: Array.isArray(data.unassigned_services) ? data.unassigned_services : [],
  };
}
