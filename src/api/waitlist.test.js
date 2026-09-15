import test from "node:test";
import assert from "node:assert/strict";
import {
  buildWaitlistPayload,
  normalizeWaitlistEntry,
  waitlistCustomerName,
} from "./waitlist.js";

test("builds a saved guest waitlist request with walk-in source", () => {
  const payload = buildWaitlistPayload({
    identity: { kind: "guest", id: 184, label: "Ama Mensah" },
    appointmentDate: "2026-09-12",
    startTime: "15:00:00",
    waitlistDate: "2026-09-13",
    services: [{ service_id: 21, service_option_id: 7, staff_id: 12 }],
    reason: "preferred_provider_unavailable",
  });

  assert.equal(payload.guest_customer_id, 184);
  assert.equal(payload.booking_source, "walk-in");
  assert.equal(Object.hasOwn(payload, "customer_id"), false);
  assert.equal(Object.hasOwn(payload, "guest"), false);
});

test("builds a phone-only new guest waitlist request", () => {
  const payload = buildWaitlistPayload({
    identity: { kind: "new_guest", fullName: "Efua Owusu", phoneNumber: "0551234567" },
    appointmentDate: "2026-09-12",
    startTime: "15:00:00",
    waitlistDate: "2026-09-13",
    services: [{ service_id: 21, staff_id: 12 }],
  });

  assert.deepEqual(payload.guest, {
    full_name: "Efua Owusu",
    email: null,
    phone_number: "0551234567",
  });
});

test("normalizes the numeric waitlist guest response and its guest-specific name", () => {
  const entry = normalizeWaitlistEntry({
    id: 311,
    customer: null,
    customer_name: "",
    guest_customer: 184,
    guest_customer_name: "Ama Mensah",
  });

  assert.equal(entry.guest_customer_id, 184);
  assert.equal(entry.resolved_customer_name, "Ama Mensah");
  assert.equal(waitlistCustomerName(entry), "Ama Mensah");
});
