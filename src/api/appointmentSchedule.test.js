import test, { mock } from "node:test";
import assert from "node:assert/strict";
import _axios from "./_axios.js";
import {
  STAFF_SERVICE_OVERRIDE_CODE,
  buildPriceAdjustment,
  buildScheduleUpdate,
  buildAppointmentEdit,
  buildServiceOperations,
  editAppointment,
  getAppointmentEditConfirmation,
  getStaffServiceOverride,
  hasStructuralServiceOperations,
} from "./appointmentSchedule.js";

test("builds the portal schedule payload without empty optional fields", () => {
  assert.deepEqual(buildScheduleUpdate({
    date: "2026-09-10",
    start_time: "14:30",
    staff_id: 7,
    reason: "",
  }), {
    date: "2026-09-10",
    start_time: "14:30",
    staff_id: 7,
  });
});

test("preserves explicit staff removal and override confirmation", () => {
  assert.deepEqual(buildScheduleUpdate({
    staff_id: null,
    confirm_unassigned_staff: true,
  }), {
    staff_id: null,
    confirm_unassigned_staff: true,
  });
});

test("rejects an update with no schedule field", () => {
  assert.throws(
    () => buildScheduleUpdate({ reason: "Customer request" }),
    /date, start time, or staff member/,
  );
});

test("recognizes only the staff-service confirmation conflict", () => {
  const override = getStaffServiceOverride({
    response: {
      status: 409,
      data: {
        code: STAFF_SERVICE_OVERRIDE_CODE,
        detail: "Confirm the provider override.",
        requires_confirmation: true,
        can_proceed: true,
        staff: { id: 7, full_name: "Jane Doe" },
        unassigned_services: [{ service_id: 12, service_name: "Swedish Massage" }],
      },
    },
  });

  assert.equal(override.staff.full_name, "Jane Doe");
  assert.deepEqual(override.services, [
    { service_id: 12, service_name: "Swedish Massage" },
  ]);
  assert.ok(getStaffServiceOverride({ response: { status: 409, data: { requires_confirmation: true } } }));
  assert.equal(getStaffServiceOverride({ response: { status: 400, data: {} } }), null);
});

test("builds an idempotent standalone price adjustment", () => {
  assert.deepEqual(buildPriceAdjustment({
    final_total_amount_due: "125.5",
    reason: "  Added onsite service  ",
    idempotency_key: "price:123",
  }), {
    final_total_amount_due: "125.50",
    reason: "Added onsite service",
    idempotency_key: "price:123",
  });
});

test("recognizes appointment edit confirmation conflicts", () => {
  const confirmation = getAppointmentEditConfirmation({ response: { status: 409, data: {
    code: "APPOINTMENT_EDIT_CONFIRMATION_REQUIRED",
    detail: "Provider is unavailable.",
    can_proceed: true,
    conflicts: [{ appointment_item_id: 101, staff_id: 19, reason: "provider_unavailable" }],
  } } });
  assert.equal(confirmation.canProceed, true);
  assert.equal(confirmation.conflicts[0].reason, "provider_unavailable");
  assert.equal(getAppointmentEditConfirmation({ response: { status: 409, data: { code: "OTHER" } } }), null);
});

test("builds update, add, remove, unassigned, and price operations together", async () => {
  const rows = [
    { id: 101, serviceId: 12, optionId: 41, providerId: 7, canReassign: true },
    { id: 102, serviceId: 13, optionId: null, providerId: 19, canReassign: true },
    { id: 103, serviceId: 14, optionId: null, providerId: 20, canReassign: true },
  ];
  const unchanged = rows.map((row) => ({ appointmentItemId: row.id, serviceId: row.serviceId, optionId: row.optionId, staffId: row.providerId }));
  assert.deepEqual(buildServiceOperations(rows, unchanged), []);
  const services = buildServiceOperations(rows, [
    { appointmentItemId: 101, serviceId: 27, optionId: null, staffId: 19 },
    { appointmentItemId: 102, serviceId: 13, optionId: null, staffId: null },
    { appointmentItemId: null, serviceId: 44, optionId: 81, staffId: null },
  ]);
  const input = {
    services,
    price_adjustment: { final_total_amount_due: "85.00", reason: " Agreed price ", idempotency_key: "same-retry-key" },
    reason: " Correct the providers ",
  };
  const payload = buildAppointmentEdit(input, "100.00");
  assert.deepEqual(payload, {
    services: [
      { operation: "update", appointment_item_id: 101, service_id: 27, service_option_id: null, staff_id: 19 },
      { operation: "update", appointment_item_id: 102, staff_id: null },
      { operation: "add", service_id: 44, service_option_id: 81, staff_id: null },
      { operation: "remove", appointment_item_id: 103 },
    ],
    price_adjustment: { final_total_amount_due: "85.00", reason: "Agreed price", idempotency_key: "same-retry-key" },
    reason: "Correct the providers",
  });
  assert.deepEqual(buildAppointmentEdit({ services }), { services });
  assert.deepEqual(buildAppointmentEdit({ price_adjustment: input.price_adjustment }), { price_adjustment: payload.price_adjustment });
  assert.equal(hasStructuralServiceOperations(payload), true);
  assert.equal(hasStructuralServiceOperations({ services: [{ operation: "update", appointment_item_id: 1, staff_id: null }] }), false);
  assert.deepEqual(buildAppointmentEdit({ services: [{ appointment_item_id: 101, staff_id: null }] }), { services: [{ appointment_item_id: 101, staff_id: null, operation: "update" }] });
  assert.deepEqual(buildAppointmentEdit({ services: [{ operation: "remove", appointment_item_id: 101 }], reason: "  Client changed plans ", confirm_provider_override: true }), { services: [{ operation: "remove", appointment_item_id: 101 }], reason: "Client changed plans", confirm_provider_override: true });
  for (const invalid of [{}, { services: [] }, { status: "completed" }, { services: [{ appointment_item_id: 101 }] }, { services: [{ operation: "add", staff_id: 7 }] }, { services: [{ operation: "remove", appointment_item_id: 101, staff_id: null }] }, { services: [{ appointment_item_id: 101, service_id: null }] }, { services: [{ appointment_item_id: 101, price: "9" }] }, { services: [{ operation: "add", appointment_item_id: 101, service_id: 7 }] }, { services: [{ appointment_item_id: 101, staff_id: 7 }, { appointment_item_id: "101", staff_id: 19 }] }, { services: [{ operation: "remove", appointment_item_id: 101 }], confirm_provider_override: true }]) assert.throws(() => buildAppointmentEdit(invalid));
  assert.throws(() => buildAppointmentEdit(input, "85.00"), /different final total/);
  for (const value of ["", " ", null, "-1", "1.001", "1e2", "Infinity"]) assert.throws(() => buildPriceAdjustment({ ...input.price_adjustment, final_total_amount_due: value }));
  assert.throws(() => buildPriceAdjustment({ ...input.price_adjustment, idempotency_key: "x".repeat(256) }));
  assert.throws(() => buildPriceAdjustment({ ...input.price_adjustment, reason: "ab" }));
  assert.throws(() => buildPriceAdjustment({ ...input.price_adjustment, ignored: true }));
  assert.throws(() => buildPriceAdjustment({ ...input.price_adjustment, reason: 123 }));
  assert.equal(buildPriceAdjustment({ ...input.price_adjustment, final_total_amount_due: "90071992547409.93" }).final_total_amount_due, "90071992547409.93");
  assert.equal(buildPriceAdjustment({ ...input.price_adjustment, final_total_amount_due: "0" }).final_total_amount_due, "0.00");
  const patch = mock.method(_axios, "patch", async () => ({ data: { id: 1, status: "arrived" } }));
  try {
    await editAppointment(1, payload);
    await editAppointment(1, payload);
    assert.deepEqual(patch.mock.calls.map((call) => call.arguments), [
      ["/api/portal/v2/booking/appointments/1/edit/", payload],
      ["/api/portal/v2/booking/appointments/1/edit/", payload],
    ]);
  } finally {
    patch.mock.restore();
  }
});
