import test, { mock } from "node:test";
import assert from "node:assert/strict";
import _axios from "./_axios.js";
import { QueryClient } from "@tanstack/react-query";
import {
  calendarSchedulesV2,
  calendarShiftQuery,
  createAndConfirmPortalBooking,
  createIdempotencyKey,
  explicitOffsetStart,
  formatBookingTime,
  holdIdentity,
  isSlotInsideSchedule,
  listFrom,
  repeatingShiftDay,
  timeOffCoversDate,
} from "./bookingV2.js";
import { normalizeBookingStaffOptions } from "./walkIn.js";

test("reuses prefetched monthly shifts across days and refreshes after schedule edits", async () => {
  const client = new QueryClient();
  const get = mock.method(_axios, "get", async (_url, { params }) => ({ data: [{ date: params.starts_on }] }));
  try {
    const first = calendarShiftQuery("2026-09-01");
    const otherDay = calendarShiftQuery("2026-09-18");
    assert.deepEqual(first.queryKey, otherDay.queryKey);
    assert.deepEqual(otherDay.queryKey[2], { starts_on: "2026-09-01", ends_on: "2026-09-30" });
    assert.deepEqual(calendarShiftQuery("2028-02-29").queryKey[2], { starts_on: "2028-02-01", ends_on: "2028-02-29" });
    await client.prefetchQuery(first);
    assert.deepEqual(await client.fetchQuery(otherDay), [{ date: "2026-09-01" }]);
    assert.equal(get.mock.callCount(), 1);
    const neighbor = calendarShiftQuery("2026-10-01");
    await client.prefetchQuery(neighbor);
    await client.fetchQuery(calendarShiftQuery("2026-10-18"));
    assert.equal(get.mock.callCount(), 2);
    await client.invalidateQueries({ queryKey: ["booking-v2", "shifts"] });
    await client.fetchQuery(otherDay);
    assert.equal(get.mock.callCount(), 3);
  } finally {
    get.mock.restore();
    client.clear();
  }
  const windows = [{ startMins: 540, endMins: 720, is_available: true }, { startMins: 780, endMins: 1020, is_available: true }];
  for (let minute = 0; minute < 1440; minute += 15) {
    assert.equal(isSlotInsideSchedule(windows, minute), (minute >= 540 && minute < 720) || (minute >= 780 && minute < 1020));
  }
  assert.equal(isSlotInsideSchedule([...windows, { startMins: 600, endMins: 630, is_available: false }], 615), false);
});

test("calendar working windows include dated and repeating shifts and respect time off", () => {
  const dated = [
    { staff_id: { id: 7 }, date: "2026-09-14", starts_at: "2026-09-14T13:00:00Z", ends_at: "2026-09-14T16:00:00Z" },
    { staff_id: 7, date: "2026-09-14", starts_at: "2026-09-14T17:00:00Z", ends_at: "2026-09-14T21:00:00Z" },
    { staff_id: 7, date: "2026-09-15", starts_at: "2026-09-15T13:00:00Z", ends_at: "2026-09-15T21:00:00Z" },
  ];
  const repeating = [{ staff_id: 19, is_active: true, frequency_weeks: 2, start_date: "2026-09-14", days: [{ day_of_week: 0, is_available: true, start_time: "10:00", end_time: "18:00" }] }];
  const expected = [
    { staff: 7, day_of_week: 0, start_time: "09:00", end_time: "12:00", is_available: true },
    { staff: 7, day_of_week: 0, start_time: "13:00", end_time: "17:00", is_available: true },
    { staff: 19, day_of_week: 0, start_time: "10:00", end_time: "18:00", is_available: true },
  ];
  assert.deepEqual(calendarSchedulesV2(dated, repeating, [], "2026-09-14", "America/New_York"), expected);
  const timeOff = [{ staff_id: 7, active: true, start_date: "2026-09-14", end_date: null }];
  assert.deepEqual(calendarSchedulesV2(dated, repeating, timeOff, "2026-09-14", "America/New_York").map((row) => row.is_available), [false, false, true]);
  assert.deepEqual(calendarSchedulesV2(dated, repeating, [{ ...timeOff[0], active: false }], "2026-09-14", "America/New_York"), expected);
  assert.deepEqual(calendarSchedulesV2(dated, repeating, [], "2026-09-21", "America/New_York"), []);
  assert.equal(calendarSchedulesV2([], repeating, [], "2026-09-28", "America/New_York")[0].end_time, "18:00");
  assert.deepEqual(calendarSchedulesV2([], [{ ...repeating[0], is_active: false }], [], "2026-09-14", "America/New_York"), []);
  assert.deepEqual(calendarSchedulesV2([], [], [], "2026-09-14", "Africa/Accra"), []);
});

test("uses the returned timezone and ordered V2 staff windows before creating a hold", async () => {
  assert.equal(formatBookingTime("2026-09-18T09:00:00Z", "Africa/Accra"), "9:00 AM");
  assert.equal(formatBookingTime("2026-09-18T09:00:00Z", "America/New_York"), "5:00 AM");
  const services = [{ service_id: 12, staff_id: 7 }, { service_id: 27, service_option_id: 41, staff_id: 19 }];
  const slot = {
    is_bookable: true,
    items: services.map((service, index) => ({
      ...service,
      scheduled_start: `2026-09-18T${index + 9}:00:00Z`,
      scheduled_end: `2026-09-18T${index + 10}:00:00Z`,
      available_staff: { count: 1, members: [{ id: service.staff_id, name: "Provider" }] },
    })),
  };
  const rows = normalizeBookingStaffOptions(slot, services);
  assert.deepEqual(rows.map((row) => row.staff[0].id), [7, 19]);
  assert.equal(rows[1].scheduled_start, slot.items[1].scheduled_start);
  assert.ok(normalizeBookingStaffOptions({ ...slot, is_bookable: false }, services).every((row) => !row.available));
  const payload = { services, scheduled_start: "2026-09-18T09:00:00Z", timezone: "Africa/Accra" };
  const calls = [];
  let currentSlot = slot;
  const post = mock.method(_axios, "post", async (url, body) => {
    calls.push({ url, body });
    if (url.endsWith("/availability/staff/")) return { data: currentSlot };
    if (url.endsWith("/checkout-holds/")) return { data: { public_id: "hold-1" } };
    return { data: { id: "appointment-1" } };
  });
  try {
    assert.deepEqual(await createAndConfirmPortalBooking(payload), { id: "appointment-1" });
    assert.deepEqual(calls.map((call) => call.url), [
      "/api/portal/v2/booking/availability/staff/",
      "/api/portal/v2/booking/checkout-holds/",
      "/api/portal/v2/booking/checkout-holds/hold-1/confirm/",
    ]);
    assert.deepEqual(calls[0].body, {
      services: [{ service_id: 12, service_option_id: null }, { service_id: 27, service_option_id: 41 }],
      scheduled_start: payload.scheduled_start,
      timezone: payload.timezone,
    });
    for (const unavailable of [
      { ...slot, is_bookable: false },
      { ...slot, items: slot.items.slice(0, 1) },
      { ...slot, items: slot.items.map((item) => ({ ...item, available_staff: { count: 0, members: [] } })) },
    ]) {
      currentSlot = unavailable;
      calls.length = 0;
      await assert.rejects(createAndConfirmPortalBooking(payload), { code: "staff_window_unavailable" });
      assert.equal(calls.length, 1);
    }
    currentSlot = slot;
    calls.length = 0;
    await assert.rejects(createAndConfirmPortalBooking({ ...payload, services: [{ service_id: 12, staff_id: 99 }] }), /Unavailable/);
    assert.equal(calls.length, 1);
    calls.length = 0;
    post.mock.mockImplementation(async () => { calls.push({}); throw new Error("Network error"); });
    await assert.rejects(createAndConfirmPortalBooking(payload), /Network error/);
    assert.equal(calls.length, 1);
  } finally {
    post.mock.restore();
  }
});

test("decodes current array responses and future paginated responses", () => {
  assert.deepEqual(listFrom([{ id: 1 }]), [{ id: 1 }]);
  assert.deepEqual(listFrom({ results: [{ id: 2 }] }), [{ id: 2 }]);
  assert.deepEqual(listFrom({ data: [{ id: 3 }] }), [{ id: 3 }]);
  assert.deepEqual(listFrom(null), []);
});

test("creates explicit-offset appointment timestamps", () => {
  const value = explicitOffsetStart("2026-09-18", "10:30", "Africa/Accra");
  assert.equal(value, "2026-09-18T10:30:00+00:00");
});

test("keeps exactly one customer identity shape", () => {
  assert.deepEqual(holdIdentity({ customer_id: "42" }), { customer_id: "42" });
  assert.deepEqual(holdIdentity({ guest_customer_id: "7" }), { guest_customer_id: "7" });
  assert.deepEqual(holdIdentity({ guest: { full_name: "Ama", phone_number: "+2331" } }), { guest: { full_name: "Ama", phone_number: "+2331" } });
  assert.throws(() => holdIdentity({}), /Choose a customer/);
});

test("scopes idempotency keys to an operator intent", () => {
  const first = createIdempotencyKey("portal-booking");
  const second = createIdempotencyKey("portal-booking");
  assert.match(first, /^portal-booking:/);
  assert.notEqual(first, second);
});

test("expands repeating shifts and lets active time off override calendar days", () => {
  const rule = {
    is_active: true,
    frequency_weeks: 2,
    start_date: "2026-09-14",
    end_date: null,
    days: [{ day_of_week: 0, is_available: true, start_time: "09:00", end_time: "17:00" }],
  };
  assert.equal(repeatingShiftDay(rule, "2026-09-14")?.start_time, "09:00");
  assert.equal(repeatingShiftDay(rule, "2026-09-21"), null);
  assert.equal(repeatingShiftDay(rule, "2026-09-28")?.end_time, "17:00");
  assert.equal(timeOffCoversDate({ active: true, start_date: "2025-12-30", end_date: "2026-01-02", repeat: true }, "2027-01-01"), true);
  assert.equal(timeOffCoversDate({ active: false, start_date: "2026-09-14" }, "2026-09-14"), false);
});
