import test from "node:test";
import assert from "node:assert/strict";
import {
  appointmentPaymentTime,
  appointmentServiceEditRows,
  appointmentStatusOptions,
  normalizeAppointmentStatus,
} from "./appointmentManagement.js";

test("offers only safe appointment status transitions", () => {
  assert.equal(normalizeAppointmentStatus("no_show"), "no-show");
  assert.deepEqual(
    appointmentStatusOptions("confirmed").map(({ value }) => value),
    ["confirmed", "arrived", "no-show", "cancelled"],
  );
  assert.deepEqual(
    appointmentStatusOptions("arrived").map(({ value }) => value),
    ["arrived", "completed", "no-show", "cancelled"],
  );
  assert.deepEqual(appointmentStatusOptions("completed"), [{ value: "completed", label: "Completed" }]);
});

test("normalizes editable service identifiers without changing prices", () => {
  assert.deepEqual(appointmentServiceEditRows([{
    appointment_item_id: 42,
    service: { id: 7 },
    service_option_details: { id: 9 },
    staff_member: { user_id: 11 },
    line_total_amount: "125.50",
  }])[0], {
    id: 42,
    clientId: "appointment-service-42",
    appointmentItemId: 42,
    serviceId: 7,
    optionId: 9,
    providerId: 11,
    canReassign: true,
    lineTotal: "125.50",
    raw: {
      appointment_item_id: 42,
      service: { id: 7 },
      service_option_details: { id: 9 },
      staff_member: { user_id: 11 },
      line_total_amount: "125.50",
    },
  });
});

test("uses the most precise available payment time", () => {
  assert.equal(appointmentPaymentTime({ paid_at: "paid", created_at: "created" }), "paid");
  assert.equal(appointmentPaymentTime({ recorded_at: "recorded", created_at: "created" }), "recorded");
  assert.equal(appointmentPaymentTime({ created_at: "created" }), "created");
});
