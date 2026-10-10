import test from "node:test";
import assert from "node:assert/strict";
import {
  appointmentStaffId,
  buildAppointmentServiceSegments,
  calendarCustomerName,
  calendarStaffId,
  UNASSIGNED_STAFF_ID,
} from "./calendarAppointmentSegments.js";

test("reads client names from current appointment response shapes", () => {
  assert.equal(calendarCustomerName({ customer: { id: 442, full_name: "Ama Mensah" } }), "Ama Mensah");
  assert.equal(calendarCustomerName({ customer_details: { first_name: "Esi", last_name: "Boateng" } }), "Esi Boateng");
  assert.equal(calendarCustomerName({ guest_customer: { name: "Guest Client" } }), "Guest Client");
  assert.equal(calendarCustomerName({ client: "Walk-in Client" }), "Walk-in Client");
  assert.equal(calendarCustomerName({ customer: 42 }), "Client #42");
});

test("reads the authoritative top-level appointment staff", () => {
  assert.equal(appointmentStaffId({ staff_id: 19, staff: { id: 7 } }), 19);
  assert.equal(appointmentStaffId({ staff: { id: 7 } }), 7);
  assert.equal(appointmentStaffId({ staff_details: { user_id: 22 } }), 22);
  assert.equal(appointmentStaffId({}), null);
});

test("routes missing and unknown staff assignments to Unassigned", () => {
  const staff = [{ id: 7 }, { id: "19" }];
  assert.equal(calendarStaffId(7, staff), 7);
  assert.equal(calendarStaffId(19, staff), 19);
  assert.equal(calendarStaffId(null, staff), UNASSIGNED_STAFF_ID);
  assert.equal(calendarStaffId(99, staff), UNASSIGNED_STAFF_ID);
});

test("keeps multi-staff appointments visible when item windows are omitted", () => {
  const services = [
    { id: 1, sequence: 1, staff_id: 7, duration_minutes_snapshot: 60 },
    { id: 2, sequence: 2, staff_id: 19, duration_minutes_snapshot: 30 },
  ];

  const groups = buildAppointmentServiceSegments(services, "2026-10-10T09:00:00Z");

  assert.deepEqual(groups.map((group) => ({
    staffId: group.staffId,
    start: new Date(group.startMs).toISOString(),
    end: new Date(group.endMs).toISOString(),
  })), [
    { staffId: 7, start: "2026-10-10T09:00:00.000Z", end: "2026-10-10T10:00:00.000Z" },
    { staffId: 19, start: "2026-10-10T10:00:00.000Z", end: "2026-10-10T10:30:00.000Z" },
  ]);
});

test("uses authoritative item windows and refuses unsafe guesses", () => {
  const explicit = [
    { id: 1, staff_id: 7, scheduled_start: "2026-10-10T09:15:00Z", scheduled_end: "2026-10-10T10:00:00Z" },
    { id: 2, staff_id: 19, scheduled_start: "2026-10-10T10:15:00Z", scheduled_end: "2026-10-10T11:00:00Z" },
  ];
  assert.deepEqual(buildAppointmentServiceSegments(explicit).map((group) => group.staffId), [7, 19]);
  assert.deepEqual(buildAppointmentServiceSegments([{ id: 1, staff_id: 7 }], "2026-10-10T09:00:00Z"), []);
  assert.deepEqual(buildAppointmentServiceSegments([{ id: 1, staff_id: null, duration_minutes: 30 }], "2026-10-10T09:00:00Z"), []);
});
