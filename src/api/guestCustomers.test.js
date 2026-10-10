import test from "node:test";
import assert from "node:assert/strict";
import _axios from "./_axios.js";
import { guestHistoryLabel, searchGuestCustomers } from "./guestCustomers.js";

test("searches the read-only guest directory as a plain array with cancellation support", async () => {
  const originalGet = _axios.get;
  const controller = new AbortController();
  let request;
  _axios.get = async (url, config) => {
    request = { url, config };
    return { data: [{ id: 184, full_name: "Ama Mensah" }] };
  };

  try {
    const guests = await searchGuestCustomers("  ama  ", controller.signal);
    assert.equal(guests[0].id, 184);
    assert.equal(request.url, "/api/portal/v1/booking/guest-customers/");
    assert.deepEqual(request.config.params, { search: "ama" });
    assert.equal(request.config.signal, controller.signal);
    assert.equal(request.config.portalMessage, false);
  } finally {
    _axios.get = originalGet;
  }
});

test("accepts a paginated guest-directory response", async () => {
  const originalGet = _axios.get;
  _axios.get = async () => ({ data: { results: [{ id: 184 }] } });
  try {
    assert.deepEqual(await searchGuestCustomers("ama"), [{ id: 184 }]);
  } finally {
    _axios.get = originalGet;
  }
});

test("summarizes saved-guest booking history", () => {
  assert.equal(guestHistoryLabel({ appointment_count: 2, last_appointment_date: "2026-10-01" }), "2 previous appointments · Last visit 1 Oct 2026");
  assert.equal(guestHistoryLabel({ booking_count: 0 }), "No appointment history");
  assert.equal(guestHistoryLabel({}), null);
});
