import test from "node:test";
import assert from "node:assert/strict";
import {
  appointmentGuestCustomerId,
  bookingIdentityPayload,
  isSavedGuestSelectionMissing,
  waitlistGuestCustomerId,
} from "./bookingIdentity.js";

test("builds exactly one identity field for each supported identity", () => {
  assert.deepEqual(
    bookingIdentityPayload({ kind: "registered", id: 42, label: "Akua" }),
    { customer_id: 42 },
  );
  assert.deepEqual(
    bookingIdentityPayload({ kind: "guest", id: 42, label: "Ama" }),
    { guest_customer_id: 42 },
  );
  assert.deepEqual(
    bookingIdentityPayload({
      kind: "new_guest",
      fullName: "  Efua Owusu  ",
      email: " EFUA@EXAMPLE.COM ",
      phoneNumber: "",
    }),
    { guest: { full_name: "Efua Owusu", email: "efua@example.com", phone_number: null } },
  );
});

test("new guests require a name and either contact method", () => {
  assert.throws(
    () => bookingIdentityPayload({ kind: "new_guest", fullName: "Efua" }),
    /phone number or email/i,
  );
  assert.throws(
    () => bookingIdentityPayload({ kind: "new_guest", phoneNumber: "0240000000" }),
    /name is required/i,
  );
});

test("registered and guest ids cannot be confused by their numeric value", () => {
  assert.notDeepEqual(
    bookingIdentityPayload({ kind: "registered", id: 42 }),
    bookingIdentityPayload({ kind: "guest", id: 42 }),
  );
  assert.throws(() => bookingIdentityPayload({ kind: "guest", id: 0 }), /positive integer/i);
});

test("reads guest ids from the different appointment and waitlist response shapes", () => {
  assert.equal(appointmentGuestCustomerId({ guest_customer: { id: 184 } }), 184);
  assert.equal(waitlistGuestCustomerId({ guest_customer: 184 }), 184);
});

test("recognizes a stale saved-guest selection only on a guest 404", () => {
  const notFound = { response: { status: 404 } };
  assert.equal(isSavedGuestSelectionMissing(notFound, { guest_customer_id: 184 }), true);
  assert.equal(isSavedGuestSelectionMissing(notFound, { customer_id: 184 }), false);
});
