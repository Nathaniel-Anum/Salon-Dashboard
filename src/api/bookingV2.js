import _axios from "./_axios.js";
import { normalizeBookingStaffOptions } from "./walkIn.js";

export const BOOKING_V2_BASE = "/api/portal/v2/booking";

export const bookingV2Keys = Object.freeze({
  capabilities: ["booking-v2", "capabilities"],
  shifts: (filters = {}) => ["booking-v2", "staff-shifts", filters],
  datedShifts: (filters = {}) => ["booking-v2", "shifts", filters],
  repeatingShifts: (filters = {}) => ["booking-v2", "repeating-shifts", filters],
  timeOffs: (filters = {}) => ["booking-v2", "time-offs", filters],
  appointments: (filters = {}) => ["booking-v2", "appointments", filters],
  appointment: (id) => ["booking-v2", "appointment", String(id)],
});

export function listFrom(raw) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.results)) return raw.results;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
}

const data = (request) => request.then((response) => response.data);

export const getBookingV2Capabilities = () =>
  data(_axios.get(`${BOOKING_V2_BASE}/capabilities/`, { portalMessage: false }));

export const listStaffShifts = (params) =>
  data(_axios.get(`${BOOKING_V2_BASE}/staff-shifts/`, { params, portalMessage: false }));

export const listDatedShifts = (params) =>
  data(_axios.get(`${BOOKING_V2_BASE}/shifts/`, { params, portalMessage: false }));

export function calendarShiftQuery(date) {
  const [year, month] = date.split("-").map(Number);
  const filters = {
    starts_on: `${date.slice(0, 7)}-01`,
    ends_on: new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10),
  };
  return { queryKey: bookingV2Keys.datedShifts(filters), queryFn: () => listDatedShifts(filters), staleTime: 60_000 };
}
export const createDatedShift = (payload) =>
  data(_axios.post(`${BOOKING_V2_BASE}/shifts/`, payload));
export const updateDatedShift = (id, payload) =>
  data(_axios.patch(`${BOOKING_V2_BASE}/shifts/${id}/`, payload));
export const deleteDatedShift = (id) =>
  data(_axios.delete(`${BOOKING_V2_BASE}/shifts/${id}/`));

export const listRepeatingShifts = (params) =>
  data(_axios.get(`${BOOKING_V2_BASE}/repeating-shifts/`, { params, portalMessage: false }));
export const createRepeatingShift = (payload) =>
  data(_axios.post(`${BOOKING_V2_BASE}/repeating-shifts/`, payload));
export const updateRepeatingShift = (id, payload) =>
  data(_axios.patch(`${BOOKING_V2_BASE}/repeating-shifts/${id}/`, payload));
export const deleteRepeatingShift = (id) =>
  data(_axios.delete(`${BOOKING_V2_BASE}/repeating-shifts/${id}/`));

export const listTimeOffs = (params) =>
  data(_axios.get(`${BOOKING_V2_BASE}/time-offs/`, { params, portalMessage: false }));
export const createTimeOff = (payload) =>
  data(_axios.post(`${BOOKING_V2_BASE}/time-offs/`, payload));
export const updateTimeOff = (id, payload) =>
  data(_axios.patch(`${BOOKING_V2_BASE}/time-offs/${id}/`, payload));
export const deleteTimeOff = (id) =>
  data(_axios.delete(`${BOOKING_V2_BASE}/time-offs/${id}/`));

export function repeatingShiftDay(rule, date) {
  const target = String(date).slice(0, 10);
  const start = String(rule?.start_date || "").slice(0, 10);
  if (!rule?.is_active || !start || target < start || (rule.end_date && target > String(rule.end_date).slice(0, 10))) return null;
  const targetDate = new Date(`${target}T12:00:00Z`);
  const startDate = new Date(`${start}T12:00:00Z`);
  if (Number.isNaN(targetDate.getTime()) || Number.isNaN(startDate.getTime())) return null;
  const weeks = Math.floor((targetDate - startDate) / 604800000);
  if (weeks < 0 || weeks % Number(rule.frequency_weeks || 1)) return null;
  const weekday = targetDate.getUTCDay() === 0 ? 6 : targetDate.getUTCDay() - 1;
  const day = (rule.days || []).find((row) => Number(row.day_of_week) === weekday);
  return day?.is_available ? day : null;
}

export function applyShiftHoursForward(days = [], sourceDay = 0) {
  const source = days[sourceDay];
  if (!source?.is_available || !source.start_time || !source.end_time) return days;
  return days.map((day, index) => index >= sourceDay && day?.is_available
    ? { ...day, start_time: source.start_time, end_time: source.end_time }
    : day);
}

export function timeOffCoversDate(timeOff, date) {
  if (!timeOff?.active || !timeOff.start_date) return false;
  const target = String(date).slice(0, 10);
  const start = String(timeOff.start_date).slice(0, 10);
  const end = String(timeOff.end_date || start).slice(0, 10);
  if (!timeOff.repeat) return target >= start && target <= end;
  const year = Number(target.slice(0, 4));
  return [year - 1, year].some((candidate) => {
    const annualStart = `${candidate}-${start.slice(5)}`;
    const annualEnd = `${candidate + (end.slice(5) < start.slice(5) ? 1 : 0)}-${end.slice(5)}`;
    return target >= annualStart && target <= annualEnd;
  });
}

export function calendarSchedulesV2(dated, repeating, timeOffs, date, timezone) {
  const staffId = (row) => row.staff_id?.id ?? row.staff_id ?? row.staff?.id ?? row.staff;
  const clock = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" });
  const blockedStaff = new Set(timeOffs.filter((row) => timeOffCoversDate(row, date)).map((row) => String(staffId(row))));
  const working = [
    ...dated.filter((row) => (row.date ?? localDate.format(new Date(row.starts_at))) === date),
    ...repeating.flatMap((rule) => {
      const day = repeatingShiftDay(rule, date);
      return day ? [{ ...day, staff_id: staffId(rule) }] : [];
    }),
  ];
  return working.map((row) => ({
    staff: staffId(row),
    day_of_week: (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7,
    start_time: row.starts_at ? clock.format(new Date(row.starts_at)) : row.start_time,
    end_time: row.ends_at ? clock.format(new Date(row.ends_at)) : row.end_time,
    is_available: row.is_available !== false && row.status !== "cancelled" && !blockedStaff.has(String(staffId(row))),
  }));
}

export function isSlotInsideSchedule(scheduleEntries, slotStartMins, intervalMinutes = 15) {
  const slotEndMins = slotStartMins + intervalMinutes;
  return scheduleEntries.some((entry) => entry.is_available !== false
    && slotStartMins >= entry.startMins && slotEndMins <= entry.endMins)
    && !scheduleEntries.some((entry) => entry.is_available === false
      && slotStartMins < entry.endMins && slotEndMins > entry.startMins);
}

export const getAvailableTimesV2 = (payload, config = {}) =>
  data(_axios.post(`${BOOKING_V2_BASE}/availability/times/`, payload, { ...config, portalMessage: false }));
export const getAvailableStaffV2 = (payload, config = {}) =>
  data(_axios.post(`${BOOKING_V2_BASE}/availability/staff/`, payload, { ...config, portalMessage: false }));

export function formatBookingTime(value, timezone) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export const createCheckoutHoldV2 = (payload) =>
  data(_axios.post(`${BOOKING_V2_BASE}/checkout-holds/`, payload));
export const getCheckoutHoldV2 = (id) =>
  data(_axios.get(`${BOOKING_V2_BASE}/checkout-holds/${id}/`, { portalMessage: false }));
export const confirmCheckoutHoldV2 = (id) =>
  data(_axios.post(`${BOOKING_V2_BASE}/checkout-holds/${id}/confirm/`, {}));

export const listAppointmentsV2 = (params) =>
  data(_axios.get(`${BOOKING_V2_BASE}/appointments/`, { params, portalMessage: false }));
export const getAppointmentV2 = (id) =>
  data(_axios.get(`${BOOKING_V2_BASE}/appointments/${id}/`, { portalMessage: false }));
export const scheduleAppointmentV2 = (id, payload) =>
  data(_axios.post(`${BOOKING_V2_BASE}/appointments/${id}/schedule/`, payload));
export const updateAppointmentStatusV2 = (id, status) =>
  data(_axios.post(`${BOOKING_V2_BASE}/appointments/${id}/status/`, { status: status === "no_show" ? "no-show" : status }));
export const cancelAppointmentV2 = (id, reason) =>
  data(_axios.post(`${BOOKING_V2_BASE}/appointments/${id}/cancel/`, { reason }));
export const correctNoShowV2 = (id, payload) =>
  data(_axios.post(`${BOOKING_V2_BASE}/appointments/${id}/correct-no-show/`, payload));

export function createIdempotencyKey(scope = "portal-booking") {
  const random = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${scope}:${random}`;
}

function offsetForZone(date, clock, timezone) {
  if (!timezone) return -new Date(`${date}T${clock}`).getTimezoneOffset();
  try {
    const zoneName = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "longOffset",
      hour: "2-digit",
    }).formatToParts(new Date(`${date}T${clock}Z`)).find((part) => part.type === "timeZoneName")?.value;
    if (zoneName === "GMT" || zoneName === "UTC") return 0;
    const match = zoneName?.match(/GMT([+-])(\d{2}):(\d{2})/);
    if (match) {
      const amount = Number(match[2]) * 60 + Number(match[3]);
      return match[1] === "+" ? amount : -amount;
    }
  } catch {
    // Invalid or unsupported zone names are validated by the backend.
  }
  return -new Date(`${date}T${clock}`).getTimezoneOffset();
}

export function explicitOffsetStart(date, time, timezone) {
  const [hour = "00", minute = "00", second = "00"] = String(time).split(":");
  const clock = `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:${second.padStart(2, "0")}`;
  const local = new Date(`${date}T${clock}`);
  if (Number.isNaN(local.getTime())) throw new Error("Choose a valid appointment date and time.");
  const offset = offsetForZone(date, clock, timezone);
  const sign = offset >= 0 ? "+" : "-";
  const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
  const minutes = String(Math.abs(offset) % 60).padStart(2, "0");
  return `${date}T${clock}${sign}${hours}:${minutes}`;
}

export function holdIdentity(identity = {}) {
  if (identity.customer_id != null) return { customer_id: identity.customer_id };
  if (identity.guest_customer_id != null) return { guest_customer_id: identity.guest_customer_id };
  if (identity.guest) return { guest: identity.guest };
  if (identity.customer != null) return { customer_id: identity.customer };
  throw new Error("Choose a customer or enter guest contact details.");
}

export async function createAndConfirmPortalBooking(payload) {
  const availability = await getAvailableStaffV2({
    services: payload.services.map(({ service_id, service_option_id }) => ({ service_id, service_option_id: service_option_id ?? null })),
    scheduled_start: payload.scheduled_start,
    timezone: payload.timezone,
  });
  const windows = normalizeBookingStaffOptions(availability, payload.services);
  if (!windows.length || windows.some((window, index) => !window.available
    || !window.staff.some((person) => String(person.id) === String(payload.services[index].staff_id)))) {
    const error = new Error("Unavailable. Review the time and choose an available provider for each service.");
    error.code = "staff_window_unavailable";
    throw error;
  }
  const hold = await createCheckoutHoldV2(payload);
  const holdId = hold?.id ?? hold?.uuid ?? hold?.hold_id ?? hold?.public_id;
  if (!holdId) throw new Error("The server reserved the time but did not return a hold reference.");

  try {
    return await confirmCheckoutHoldV2(holdId);
  } catch (error) {
    if (error?.response) throw error;
    const reconciled = await getCheckoutHoldV2(holdId);
    const appointment = reconciled?.appointment ?? reconciled?.confirmed_appointment;
    if (appointment || ["confirmed", "completed"].includes(String(reconciled?.status).toLowerCase())) {
      return appointment ?? reconciled;
    }
    throw error;
  }
}
