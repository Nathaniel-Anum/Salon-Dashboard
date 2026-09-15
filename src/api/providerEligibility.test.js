import test from "node:test";
import assert from "node:assert/strict";
import { getAssignedStaffIds, isStaffEligibleForService, isStaffEligibleForCorrection } from "./providerEligibility.js";

test("offers direct service assignments or matching active category roles", () => {
  const staff = { id: 7, user_id: 70, roles: [{ id: 3, is_active: true }] };
  assert.equal(isStaffEligibleForService({ assigned_staff_ids: [7] }, staff), true);
  assert.equal(isStaffEligibleForService({ assigned_staff: [{ user_id: 70 }] }, staff), true);
  assert.equal(isStaffEligibleForService({ assigned_staff_ids: [8] }, staff), false);
  assert.deepEqual(getAssignedStaffIds({ assigned_staff_ids: [], assigned_staff: [{ id: 7 }, { id: "7" }] }), [7]);
  const service = { category: 12, assigned_staff_ids: [] };
  const categories = [{ id: 12, eligible_role_ids: [3] }];
  assert.equal(isStaffEligibleForService(service, staff, categories), true);
  assert.equal(isStaffEligibleForService(service, { ...staff, roles: [{ id: 3, is_active: false }] }, categories), false);
  assert.equal(isStaffEligibleForService(service, { ...staff, roles: [{ id: 3, status: "disabled" }] }, categories), false);
  assert.equal(isStaffEligibleForService(service, { ...staff, roles: [null] }, categories), false);
  assert.equal(isStaffEligibleForService(service, { ...staff, roles: [{ id: 4 }] }, categories), false);
  assert.equal(isStaffEligibleForService(service, { ...staff, is_active: false }, categories), false);
  assert.equal(isStaffEligibleForService(service, staff, [{ id: 13, eligible_role_ids: [3] }]), false);
  assert.equal(isStaffEligibleForService(service, staff), false);
  assert.equal(isStaffEligibleForService({ category: { id: 12, eligible_roles: [{ id: 3 }] } }, staff), true);
});

test("corrections require active internal providers and limit administrative overrides", () => {
  const service = { id: 12, category_id: 3, assigned_staff_ids: [7] };
  const staff = { id: 7, account_type: "staff", roles: [{ id: 2, code: "stylist", is_active: true }] };
  assert.equal(isStaffEligibleForCorrection(service, staff), true);
  assert.equal(isStaffEligibleForCorrection(service, { ...staff, id: 8 }), true);
  for (const invalid of [{ ...staff, is_active: false }, { ...staff, is_external: true }, { ...staff, account_type: "customer" }, { ...staff, roles: [] }, { ...staff, roles: [{ ...staff.roles[0], is_active: false }] }]) assert.equal(isStaffEligibleForCorrection(service, invalid), false);
  for (const code of ["admin", "front_desk"]) {
    const admin = { ...staff, id: 8, roles: [{ id: 2, code }] };
    assert.equal(isStaffEligibleForCorrection(service, admin), false);
    assert.equal(isStaffEligibleForCorrection(service, { ...admin, id: 7 }), true);
    assert.equal(isStaffEligibleForCorrection(service, admin, [{ id: 3, eligible_role_ids: [2], is_active: true }]), true);
    assert.equal(isStaffEligibleForCorrection(service, admin, [{ id: 3, eligible_role_ids: [2], is_active: false }]), false);
  }
});
