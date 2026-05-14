import _axios from "./_axios";

const BASE = "/api/portal/v1/booking/waitlist/";

/* ── List all waitlist entries (optional ?status= filter) ── */
export const getWaitlist = (params = {}) =>
  _axios.get(BASE, { params }).then((r) => r.data);

/* ── Single waitlist entry detail ── */
export const getWaitlistEntry = (id) =>
  _axios.get(`${BASE}${id}/`).then((r) => r.data);

/* ── Create a new waitlist entry (portal staff on behalf of customer/guest) ── */
export const createWaitlistEntry = (data) =>
  _axios.post(BASE, data).then((r) => r.data);

/* ── Cancel a pending or unpaid-promoted waitlist entry ── */
export const cancelWaitlistEntry = (id) =>
  _axios.post(`${BASE}${id}/cancel/`).then((r) => r.data);
