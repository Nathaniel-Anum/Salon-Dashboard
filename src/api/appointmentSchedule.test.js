import test from "node:test";
import assert from "node:assert/strict";
import {
  STAFF_SERVICE_OVERRIDE_CODE,
  buildScheduleUpdate,
  getStaffServiceOverride,
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
  assert.equal(getStaffServiceOverride({ response: { status: 400, data: {} } }), null);
});
