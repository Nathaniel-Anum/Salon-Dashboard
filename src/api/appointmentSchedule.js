import _axios from "./_axios.js";

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

export async function moveAppointment(appointmentId, update) {
  const response = await _axios.patch(
    `/api/portal/v1/booking/appointments/${appointmentId}/schedule/`,
    buildScheduleUpdate(update),
  );

  return response.data;
}

export function getStaffServiceOverride(error) {
  const response = error?.response;
  const data = response?.data;

  if (
    response?.status !== 409 ||
    data?.code !== STAFF_SERVICE_OVERRIDE_CODE ||
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
