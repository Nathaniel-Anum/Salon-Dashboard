import _axios from "./_axios.js";

const STAFF_OPTIONS_URL = "/api/portal/v1/booking/services/booking-staff-options/";
const RECOMMEND_STAFF_URL = "/api/portal/v1/booking/services/recommend-staff/";

function listFrom(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.data)) return value.data;
  return [];
}

function normalizeStaff(candidate = {}, roster = []) {
  const source = candidate.staff ?? candidate.staff_member ?? candidate.staff_details ?? candidate;
  const ids = [source?.id, source?.staff_id, source?.user, source?.user_id, source?.account_id]
    .filter((value) => value !== undefined && value !== null && value !== "")
    .map(String);
  const rosterMatch = roster.find((person) => [
    person.id,
    person.user,
    person.user_id,
    person.account_id,
  ].some((value) => ids.includes(String(value))));
  const id = rosterMatch?.id ?? source?.id ?? source?.staff_id ?? source?.user_id ?? source?.account_id;
  const fullName = rosterMatch?.full_name
    || source?.full_name
    || source?.name
    || [source?.first_name, source?.last_name].filter(Boolean).join(" ")
    || `Team member #${id}`;

  if (id === undefined || id === null) return null;

  return {
    ...source,
    ...rosterMatch,
    id,
    full_name: fullName,
    role: rosterMatch?.role ?? source?.role ?? source?.position ?? "Team member",
    assigned_to_service: candidate.assigned_to_service ?? source?.assigned_to_service ?? true,
  };
}

function responseRows(raw) {
  const source = raw?.data ?? raw ?? {};
  if (Array.isArray(source)) return source;
  return listFrom(
    source.services
    ?? source.service_windows
    ?? source.staff_options
    ?? source.results,
  );
}

export function normalizeBookingStaffOptions(raw, requestedServices = [], roster = []) {
  const rows = responseRows(raw);
  const rowsHaveServiceIds = rows.some(
    (row) => row?.service_id != null || row?.service?.id != null,
  );

  return requestedServices.map((requested, index) => {
    const row = rows.find((candidate) => {
      const sameService = String(candidate?.service_id ?? candidate?.service?.id) === String(requested.service_id);
      const candidateOption = candidate?.service_option_id ?? candidate?.service_option?.id;
      return sameService && (
        requested.service_option_id == null
        || candidateOption == null
        || String(candidateOption) === String(requested.service_option_id)
      );
    }) ?? (!rowsHaveServiceIds ? rows[index] : null) ?? {};
    const rawStaff = listFrom(
      row.eligible_staff
      ?? row.available_staff
      ?? row.staff_options
      ?? row.staff,
    );

    const staff = row.available === false
      ? []
      : rawStaff.map((candidate) => normalizeStaff(candidate, roster)).filter(Boolean);

    return {
      service_id: requested.service_id,
      service_option_id: requested.service_option_id ?? null,
      scheduled_start: row.scheduled_start ?? null,
      scheduled_end: row.scheduled_end ?? null,
      available: row.available !== false && staff.length > 0,
      reason: row.reason ?? null,
      retry_after_seconds: row.retry_after_seconds ?? null,
      staff,
    };
  });
}

export function normalizeStaffRecommendation(raw, roster = []) {
  const source = raw?.data ?? raw ?? {};
  return {
    available: source.available === true,
    recommendation_id: source.recommendation_id ?? null,
    staff: source.staff ? normalizeStaff(source.staff, roster) : null,
    scheduled_start: source.scheduled_start ?? null,
    scheduled_end: source.scheduled_end ?? null,
    expires_at: source.expires_at ?? null,
    reason: source.reason ?? null,
    retry_after_seconds: source.retry_after_seconds ?? null,
  };
}

export function buildWalkInAppointmentPayload({
  customerId,
  guest,
  appointmentDate,
  startTime,
  services,
}) {
  if (!appointmentDate || !startTime) throw new Error("Appointment date and time are required.");
  if (!Array.isArray(services) || services.length === 0) throw new Error("Select at least one service.");
  if (services.some((service) => !service.service_id || !service.staff_id)) {
    throw new Error("Every service must have an eligible staff member.");
  }

  const customer = customerId
    ? { customer_id: customerId }
    : {
        guest: {
          full_name: String(guest?.full_name ?? "").trim(),
          phone_number: String(guest?.phone_number ?? "").trim(),
          ...(String(guest?.email ?? "").trim() ? { email: String(guest.email).trim() } : {}),
        },
      };

  if (!customerId && (!customer.guest.full_name || !customer.guest.phone_number)) {
    throw new Error("Guest name and phone number are required.");
  }

  return {
    ...customer,
    booking_source: "walk-in",
    appointment_date: appointmentDate,
    start_time: startTime,
    services: services.map((service) => ({
      service_id: service.service_id,
      ...(service.service_option_id ? { service_option_id: service.service_option_id } : {}),
      staff_id: service.staff_id,
    })),
  };
}

export const getBookingStaffOptions = (payload) =>
  _axios.post(STAFF_OPTIONS_URL, payload, { portalMessage: false }).then((response) => response.data);

export const recommendWalkInStaff = (payload) =>
  _axios.post(RECOMMEND_STAFF_URL, payload, { portalMessage: false }).then((response) => response.data);
