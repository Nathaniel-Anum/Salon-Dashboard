import test from "node:test";
import assert from "node:assert/strict";
import {
  buildWalkInAppointmentPayload,
  normalizeBookingStaffOptions,
  normalizeStaffRecommendation,
} from "./walkIn.js";

test("keeps batch service windows in requested order and preserves override eligibility", () => {
  const result = normalizeBookingStaffOptions({ services: [
    {
      service_id: 35,
      scheduled_start: "2026-09-10T10:45:00Z",
      scheduled_end: "2026-09-10T11:15:00Z",
      eligible_staff: [{ id: 18, full_name: "Second Provider", assigned_to_service: true }],
    },
    {
      service_id: 21,
      scheduled_start: "2026-09-10T10:00:00Z",
      scheduled_end: "2026-09-10T10:45:00Z",
      eligible_staff: [{ id: 12, full_name: "Override Provider", assigned_to_service: false }],
    },
  ] }, [
    { service_id: 21, service_option_id: 84 },
    { service_id: 35, service_option_id: 102 },
  ]);

  assert.deepEqual(result.map((row) => row.service_id), [21, 35]);
  assert.equal(result[0].scheduled_end, "2026-09-10T10:45:00Z");
  assert.equal(result[0].staff[0].assigned_to_service, false);
});

test("normalizes a recommendation without inventing availability", () => {
  const unavailable = normalizeStaffRecommendation({
    available: false,
    reason: "No eligible provider is free.",
    retry_after_seconds: 60,
  });
  assert.equal(unavailable.available, false);
  assert.equal(unavailable.staff, null);
});

test("does not borrow another service's staff when a keyed response row is missing", () => {
  const result = normalizeBookingStaffOptions({ services: [{
    service_id: 35,
    eligible_staff: [{ id: 18, full_name: "Provider" }],
  }] }, [
    { service_id: 21, service_option_id: 84 },
    { service_id: 35, service_option_id: 102 },
  ]);

  assert.deepEqual(result[0].staff, []);
  assert.equal(result[0].available, false);
  assert.equal(result[1].staff[0].id, 18);
});

test("honors an unavailable window even if a stale staff list is present", () => {
  const [result] = normalizeBookingStaffOptions({ services: [{
    service_id: 21,
    available: false,
    reason: "The salon is closed.",
    eligible_staff: [{ id: 12, full_name: "Stale Provider" }],
  }] }, [{ service_id: 21, service_option_id: 84 }]);

  assert.equal(result.available, false);
  assert.deepEqual(result.staff, []);
});

test("builds an ordered walk-in payload with explicit staff and no top-level staff", () => {
  const payload = buildWalkInAppointmentPayload({
    customerId: 7,
    appointmentDate: "2026-09-10",
    startTime: "10:00:00",
    services: [
      { service_id: 21, service_option_id: 84, staff_id: 12 },
      { service_id: 35, service_option_id: 102, staff_id: 18 },
    ],
  });

  assert.equal(payload.booking_source, "walk-in");
  assert.deepEqual(payload.services.map((service) => service.staff_id), [12, 18]);
  assert.equal(Object.hasOwn(payload, "staff"), false);
});

test("refuses to create a payload with an unresolved service provider", () => {
  assert.throws(() => buildWalkInAppointmentPayload({
    guest: { full_name: "Walk-in Guest", phone_number: "0240000000" },
    appointmentDate: "2026-09-10",
    startTime: "10:00:00",
    services: [{ service_id: 21, service_option_id: 84 }],
  }), /Every service/);
});
