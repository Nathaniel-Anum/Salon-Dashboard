import _axios from "./_axios.js";
import {
  bookingIdentityPayload,
  waitlistGuestCustomerId,
} from "./bookingIdentity.js";

const BASE = "/api/portal/v1/booking/waitlist/";

export function waitlistCustomerName(entry = {}) {
  return entry.customer_name
    || entry.guest_customer_name
    || entry.customer?.full_name
    || entry.guest?.full_name
    || entry.guest_customer?.full_name
    || "Guest";
}

export function normalizeWaitlistEntry(entry = {}) {
  const guestCustomerId = waitlistGuestCustomerId(entry);
  return {
    ...entry,
    resolved_customer_name: waitlistCustomerName(entry),
    ...(guestCustomerId ? { guest_customer_id: guestCustomerId } : {}),
  };
}

function normalizeWaitlistCollection(data) {
  if (Array.isArray(data)) return data.map(normalizeWaitlistEntry);
  if (Array.isArray(data?.results)) {
    return { ...data, results: data.results.map(normalizeWaitlistEntry) };
  }
  return data;
}

/* ── List all waitlist entries (optional ?status= filter) ── */
export const getWaitlist = (params = {}) =>
  _axios.get(BASE, { params }).then((response) => normalizeWaitlistCollection(response.data));

/* ── Single waitlist entry detail ── */
export const getWaitlistEntry = (id) =>
  _axios.get(`${BASE}${id}/`).then((response) => normalizeWaitlistEntry(response.data));

/* ── Create a new waitlist entry (portal staff on behalf of customer/guest) ── */
export function buildWaitlistPayload({
  identity,
  appointmentDate,
  startTime,
  waitlistDate,
  services,
  reason = "staff_fully_booked",
  notes,
}) {
  if (!appointmentDate || !startTime || !waitlistDate) {
    throw new Error("Appointment date, time, and waitlist date are required.");
  }
  if (!Array.isArray(services) || !services.length) throw new Error("Add at least one service.");
  if (services.some((service) => !service.service_id || !service.staff_id)) {
    throw new Error("Every service must have an eligible staff member.");
  }

  return {
    ...bookingIdentityPayload(identity),
    booking_source: "walk-in",
    appointment_date: appointmentDate,
    start_time: startTime,
    waitlist_date: waitlistDate,
    services: services.map((service) => ({
      service_id: service.service_id,
      ...(service.service_option_id ? { service_option_id: service.service_option_id } : {}),
      staff_id: service.staff_id,
    })),
    reason,
    ...(String(notes ?? "").trim() ? { notes: String(notes).trim() } : {}),
  };
}

/* ── Create a new waitlist entry (portal staff on behalf of customer/guest) ── */
export const createWaitlistEntry = (data) =>
  _axios.post(BASE, data).then((response) => normalizeWaitlistEntry(response.data));

/* ── Cancel a pending or unpaid-promoted waitlist entry ── */
export const cancelWaitlistEntry = (id) =>
  _axios.post(`${BASE}${id}/cancel/`).then((r) => r.data);
