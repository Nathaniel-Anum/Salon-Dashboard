import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { permissionState, storePortalSession } from "./permissions.js";

beforeEach(() => {
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
});

afterEach(() => {
  delete globalThis.localStorage;
});

test("uses explicit permission codes from the login session", () => {
  storePortalSession({ permissions: ["appointments.edit"] });
  assert.equal(permissionState("appointments.edit"), true);
  assert.equal(permissionState("booking_salon_payments.create"), false);
});

test("treats an explicit empty permission snapshot as denied", () => {
  storePortalSession({ permissions: [] });
  assert.equal(permissionState("appointments.edit"), false);
});

test("supports superuser wildcard access", () => {
  storePortalSession({ is_superuser: true, permissions: [] });
  assert.equal(permissionState("booking_price_adjustments.create"), true);
});

test("returns unknown for older sessions without permission claims", () => {
  localStorage.setItem("access", "opaque-token");
  assert.equal(permissionState("appointments.edit"), null);
});
