function staffIdOf(service = {}) {
  const staff = service.staff_id ?? service.staff;
  return typeof staff === "object" ? staff?.id : staff;
}

function durationOf(service = {}) {
  const base = Number(
    service.duration_minutes_snapshot ??
    service.duration_minutes ??
    service.duration_mins ??
    service.duration,
  );
  const extra = Number(service.extra_time_minutes_snapshot ?? service.extra_time_minutes ?? 0);
  return Number.isFinite(base) && base > 0 ? base + (Number.isFinite(extra) ? extra : 0) : null;
}

export const UNASSIGNED_STAFF_ID = "unassigned";

export function calendarStaffId(staffId, staff = []) {
  return staffId != null && staff.some((person) => String(person.id) === String(staffId))
    ? staffId
    : UNASSIGNED_STAFF_ID;
}

export function appointmentStaffId(appointment = {}) {
  const staff = appointment.staff_id ?? appointment.staff ?? appointment.staff_details;
  if (staff == null) return null;
  return typeof staff === "object" ? staff.id ?? staff.user_id ?? null : staff;
}

export function calendarCustomerName(appointment = {}) {
  const direct = appointment.customer_name ?? appointment.customer_full_name ?? appointment.guest_name;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const people = [
    appointment.customer,
    appointment.customer_details,
    typeof appointment.client === "object" ? appointment.client : null,
    appointment.guest_customer,
    appointment.guest,
  ];
  for (const person of people) {
    if (!person || typeof person !== "object") continue;
    const name = person.full_name || person.name || [person.first_name, person.last_name].filter(Boolean).join(" ");
    if (name?.trim()) return name.trim();
  }

  if (typeof appointment.client === "string" && appointment.client.trim()) return appointment.client.trim();
  const customerId = typeof appointment.customer === "object" ? appointment.customer?.id : appointment.customer;
  return customerId != null ? `Client #${customerId}` : "Walk-in";
}

export function buildAppointmentServiceSegments(services = [], scheduledStart) {
  const ordered = services
    .map((service, originalIndex) => {
      const sequence = Number(service.sequence);
      const rawStaffId = staffIdOf(service);
      return {
        service,
        originalIndex,
        staffId: rawStaffId == null ? Number.NaN : Number(rawStaffId),
        startMs: Date.parse(service.scheduled_start),
        endMs: Date.parse(service.scheduled_end),
        durationMinutes: durationOf(service),
        sequence: Number.isFinite(sequence) ? sequence : originalIndex + 1,
      };
    })
    .sort((a, b) => a.sequence - b.sequence || a.originalIndex - b.originalIndex);

  if (!ordered.length || ordered.some((line) => !Number.isFinite(line.staffId))) return [];

  const hasExplicitWindows = ordered.every(
    (line) => Number.isFinite(line.startMs) && Number.isFinite(line.endMs) && line.endMs > line.startMs,
  );

  let lines = ordered;
  if (!hasExplicitWindows) {
    let cursor = Date.parse(scheduledStart);
    if (!Number.isFinite(cursor) || ordered.some((line) => !line.durationMinutes)) return [];
    lines = ordered.map((line) => {
      const startMs = cursor;
      cursor += line.durationMinutes * 60_000;
      return { ...line, startMs, endMs: cursor };
    });
  }

  return lines.reduce((groups, line) => {
    const previous = groups.at(-1);
    if (previous && previous.staffId === line.staffId && previous.endMs === line.startMs) {
      previous.lines.push(line);
      previous.endMs = line.endMs;
    } else {
      groups.push({ staffId: line.staffId, startMs: line.startMs, endMs: line.endMs, lines: [line] });
    }
    return groups;
  }, []);
}
