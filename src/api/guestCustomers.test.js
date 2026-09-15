import test from "node:test";
import assert from "node:assert/strict";
import _axios from "./_axios.js";
import { searchGuestCustomers } from "./guestCustomers.js";

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

test("does not accept a paginated guest-directory envelope", async () => {
  const originalGet = _axios.get;
  _axios.get = async () => ({ data: { results: [{ id: 184 }] } });
  try {
    assert.deepEqual(await searchGuestCustomers("ama"), []);
  } finally {
    _axios.get = originalGet;
  }
});
