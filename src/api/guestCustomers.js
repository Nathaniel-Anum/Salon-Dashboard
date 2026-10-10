import _axios from "./_axios.js";

const BASE = "/api/portal/v1/booking/guest-customers/";

export async function searchGuestCustomers(query = "", signal) {
  const search = String(query).trim();
  const response = await _axios.get(BASE, {
    ...(search ? { params: { search } } : {}),
    signal,
    portalMessage: false,
  });
  if (Array.isArray(response.data)) return response.data;
  return Array.isArray(response.data?.results) ? response.data.results : [];
}

export function guestHistoryLabel(guest = {}) {
  const rawCount = guest.appointment_count ?? guest.booking_count;
  const count = Number(rawCount);
  const parts = [];
  if (rawCount != null && Number.isFinite(count)) {
    parts.push(count > 0
      ? `${count} previous appointment${count === 1 ? "" : "s"}`
      : "No appointment history");
  }
  if (guest.last_appointment_date) {
    const date = new Date(guest.last_appointment_date);
    if (!Number.isNaN(date.getTime())) {
      parts.push(`Last visit ${new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(date)}`);
    }
  }
  return parts.join(" · ") || null;
}
