/**
 * clientProfile.js
 * ─────────────────
 * Fetches client-specific data for the profile page.
 *
 * Endpoints tried:
 *   GET /api/portal/v1/booking/bookings/?customer={id}   → appointment list
 *   GET /api/portal/v1/accounts/customers/{id}/          → single customer detail
 *
 * Falls back gracefully if the backend doesn't support customer filtering yet.
 */

import _axios from "./_axios";

/* ── Fetch a single customer's detail ── */
export async function fetchCustomerDetail(id) {
  const res = await _axios.get(`/api/portal/v1/accounts/customers/${id}/`);
  return res.data;
}

/**
 * Fetch all bookings for a specific customer.
 * Returns a normalised array of appointment objects.
 */
export async function fetchClientBookings(customerId) {
  try {
    /* Try ?customer= filter first */
    const res = await _axios.get("/api/portal/v1/booking/bookings/", {
      params: { customer: customerId },
    });
    const raw = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
    return raw.map(normaliseBooking);
  } catch {
    /* Fallback: try ?customer_id= */
    try {
      const res = await _axios.get("/api/portal/v1/booking/bookings/", {
        params: { customer_id: customerId },
      });
      const raw = Array.isArray(res.data)
        ? res.data
        : (res.data?.results ?? []);
      return raw.map(normaliseBooking);
    } catch {
      return [];
    }
  }
}

/**
 * Normalise a raw booking object into a consistent shape
 * that the profile page can render regardless of backend variance.
 */
function normaliseBooking(b) {
  /* Services — handle array or single */
  const services =
    b.services ??
    b.booking_services ??
    (b.service_name || b.service
      ? [{ service_name: b.service_name || b.service, price: b.price }]
      : []);

  const serviceNames = services
    .map((s) => s.service_name || s.name || "")
    .filter(Boolean);

  /* Total price */
  const total =
    b.total_price != null
      ? parseFloat(b.total_price)
      : b.total != null
        ? parseFloat(b.total)
        : services.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0);

  /* Date string YYYY-MM-DD */
  const dateStr = b.date ?? b.appointment_date ?? b.booking_date ?? "";

  /* Start time */
  const startTime = b.start_time ?? b.time ?? b.startTime ?? "";

  /* Staff */
  const staff =
    b.staff_name ?? b.staff?.full_name ?? b.services?.[0]?.staff_name ?? "";

  return {
    id: b.id,
    date: dateStr,
    startTime,
    status: b.status ?? "pending",
    services,
    serviceNames,
    total,
    staff,
    notes: b.notes ?? b.note ?? "",
    durationMins:
      b.duration_mins ??
      b.duration ??
      services.reduce((s, sv) => s + (sv.duration_mins || 0), 0),
  };
}

/**
 * Derive profile stats from a list of normalised bookings.
 */
export function computeProfileStats(bookings) {
  const completed = bookings.filter((b) => b.status === "completed");
  const totalSpend = completed.reduce((sum, b) => sum + b.total, 0);

  /* Favourite services — rank by frequency */
  const freq = {};
  bookings.forEach((b) =>
    b.serviceNames.forEach((n) => {
      freq[n] = (freq[n] || 0) + 1;
    }),
  );
  const favouriteServices = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  /* Loyalty points — 1 point per GHS 10 spent (completed) */
  const loyaltyPoints = Math.floor(totalSpend / 10);

  /* Last visit */
  const sortedCompleted = [...completed].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  const lastVisit = sortedCompleted[0]?.date ?? null;

  /* Upcoming */
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = bookings
    .filter((b) => b.date >= today && b.status !== "cancelled")
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalVisits: completed.length,
    totalSpend,
    favouriteServices,
    loyaltyPoints,
    lastVisit,
    upcoming,
  };
}
