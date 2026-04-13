/**
 * Blocked Days API helper
 * ──────────────────────
 * Tries the backend REST endpoint first.
 * If the endpoint doesn't exist yet (404/network error) it silently
 * falls back to localStorage so the feature works regardless of
 * whether the backend has been updated.
 *
 * Storage shape (localStorage key: "salon_blocked_days"):
 *   { "YYYY-MM-DD": { date, reason, createdAt }, ... }
 *
 * Backend endpoint (when available):
 *   GET  /api/portal/v1/booking/blocked-days/          → [{ date, reason, id }]
 *   POST /api/portal/v1/booking/blocked-days/          → { date, reason }
 *   DELETE /api/portal/v1/booking/blocked-days/{id}/
 */

import _axios from "./_axios";

const LS_KEY = "salon_blocked_days";
const ENDPOINT = "/api/portal/v1/booking/blocked-days/";

/* ── Local Storage helpers ── */

function lsRead() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "{}");
  } catch {
    return {};
  }
}

function lsWrite(data) {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

/* ── Public API ── */

/**
 * Fetch all blocked days.
 * Returns an array of { id, date: "YYYY-MM-DD", reason } objects.
 */
export async function fetchBlockedDays() {
  try {
    const res = await _axios.get(ENDPOINT);
    const raw = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
    // Sync backend response into localStorage as a cache
    const map = {};
    raw.forEach((item) => {
      map[item.date] = {
        id: item.id,
        date: item.date,
        reason: item.reason || "",
      };
    });
    lsWrite(map);
    return Object.values(map);
  } catch {
    // Backend not available — return from localStorage
    return Object.values(lsRead());
  }
}

/**
 * Block a date.
 * @param {string} date   "YYYY-MM-DD"
 * @param {string} reason e.g. "Public Holiday", "Staff Training", etc.
 * @returns {{ id, date, reason }}
 */
export async function blockDate(date, reason = "") {
  try {
    const res = await _axios.post(ENDPOINT, { date, reason });
    const item = {
      id: res.data.id,
      date: res.data.date,
      reason: res.data.reason || reason,
    };
    // Keep local cache in sync
    const map = lsRead();
    map[date] = item;
    lsWrite(map);
    return item;
  } catch {
    // Fallback: store only in localStorage
    const item = {
      id: `local_${date}`,
      date,
      reason,
      createdAt: new Date().toISOString(),
    };
    const map = lsRead();
    map[date] = item;
    lsWrite(map);
    return item;
  }
}

/**
 * Unblock a previously blocked date.
 * @param {string} date  "YYYY-MM-DD"
 * @param {string} id    The backend record ID (may be a local_ prefixed string)
 */
export async function unblockDate(date, id) {
  // Remove from localStorage first (instant UI feedback)
  const map = lsRead();
  delete map[date];
  lsWrite(map);

  // Attempt backend delete (only for real IDs)
  if (id && !String(id).startsWith("local_")) {
    try {
      await _axios.delete(`${ENDPOINT}${id}/`);
    } catch {
      // Silently ignore if backend isn't available
    }
  }
}

/**
 * Quick synchronous check whether a date string is blocked.
 * Uses only the localStorage cache — no network call.
 * @param {string} dateStr "YYYY-MM-DD"
 */
export function isDateBlocked(dateStr) {
  return !!lsRead()[dateStr];
}

/**
 * Returns the Set of all blocked date strings from cache.
 * Useful for DatePicker disabledDate checks.
 */
export function getBlockedDateSet() {
  return new Set(Object.keys(lsRead()));
}
