/**
 * Blocked Days API helper
 * ──────────────────────
 * Supports date-range blocked periods: { start_date, end_date, reason }.
 * Tries the backend REST endpoint first and falls back to localStorage.
 *
 * Backend endpoints:
 *   GET    /api/portal/v1/booking/blocked-days/        → [{ id, start_date, end_date, reason }]
 *   POST   /api/portal/v1/booking/blocked-days/        → { start_date, end_date, reason }
 *   GET    /api/portal/v1/booking/blocked-days/{id}/
 *   PATCH  /api/portal/v1/booking/blocked-days/{id}/   → { start_date, end_date, reason }
 *   DELETE /api/portal/v1/booking/blocked-days/{id}/
 */

import _axios from "./_axios";

const LS_KEY   = "salon_blocked_periods";
const ENDPOINT = "/api/portal/v1/booking/blocked-days/";

/* ── Local Storage helpers ── */

function lsRead() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  } catch {
    return [];
  }
}

function lsWrite(data) {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

/* ── Public API ── */

/**
 * Fetch all blocked periods.
 * Returns an array of { id, start_date, end_date, reason } objects.
 */
export async function fetchBlockedDays() {
  try {
    const res = await _axios.get(ENDPOINT);
    const raw = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
    const periods = raw.map((item) => ({
      id:         item.id,
      start_date: item.start_date,
      end_date:   item.end_date,
      reason:     item.reason || "",
    }));
    lsWrite(periods);
    return periods;
  } catch {
    return lsRead();
  }
}

/**
 * Block a date range (or a single day when start_date === end_date).
 * @param {string} start_date  "YYYY-MM-DD"
 * @param {string} end_date    "YYYY-MM-DD"
 * @param {string} reason
 * @returns {{ id, start_date, end_date, reason }}
 */
export async function blockPeriod(start_date, end_date, reason = "") {
  try {
    const res  = await _axios.post(ENDPOINT, { start_date, end_date, reason });
    const item = {
      id:         res.data.id,
      start_date: res.data.start_date,
      end_date:   res.data.end_date,
      reason:     res.data.reason || reason,
    };
    const list = lsRead();
    list.push(item);
    lsWrite(list);
    return item;
  } catch {
    const item = {
      id:         `local_${start_date}_${end_date}_${Date.now()}`,
      start_date,
      end_date,
      reason,
    };
    const list = lsRead();
    list.push(item);
    lsWrite(list);
    return item;
  }
}

/**
 * Update an existing blocked period.
 * @param {string|number} id
 * @param {string} start_date  "YYYY-MM-DD"
 * @param {string} end_date    "YYYY-MM-DD"
 * @param {string} reason
 * @returns {{ id, start_date, end_date, reason }}
 */
export async function updatePeriod(id, start_date, end_date, reason = "") {
  try {
    const res  = await _axios.patch(`${ENDPOINT}${id}/`, { start_date, end_date, reason });
    const item = {
      id:         res.data.id ?? id,
      start_date: res.data.start_date,
      end_date:   res.data.end_date,
      reason:     res.data.reason || reason,
    };
    lsWrite(lsRead().map((p) => (p.id === id ? item : p)));
    return item;
  } catch {
    const item = { id, start_date, end_date, reason };
    lsWrite(lsRead().map((p) => (p.id === id ? item : p)));
    return item;
  }
}

/**
 * Unblock a period by its ID.
 * @param {string|number} id
 */
export async function unblockPeriod(id) {
  lsWrite(lsRead().filter((p) => p.id !== id));
  if (id && !String(id).startsWith("local_")) {
    try {
      await _axios.delete(`${ENDPOINT}${id}/`);
    } catch {
      // Silently ignore if backend isn't available
    }
  }
}

/**
 * Quick synchronous check whether a date string falls inside any blocked period.
 * Uses only the localStorage cache — no network call.
 * @param {string} dateStr "YYYY-MM-DD"
 */
export function isDateBlocked(dateStr) {
  return lsRead().some((p) => dateStr >= p.start_date && dateStr <= p.end_date);
}

/**
 * Returns all blocked periods from the localStorage cache.
 */
export function getBlockedPeriods() {
  return lsRead();
}
