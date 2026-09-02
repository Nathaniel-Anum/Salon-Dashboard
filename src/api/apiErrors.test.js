import test from "node:test";
import assert from "node:assert/strict";
import { firstApiErrorMessage, getApiError, normalizePortalIssues } from "./apiErrors.js";

function apiError(status, data, headers = {}) {
  return { response: { status, data, headers } };
}

test("maps nested add-on validation to its row and aliased field", () => {
  const error = apiError(400, {
    code: "validation_error",
    errors: { addons: [{}, { staff_member: ["This staff member is unavailable."] }] },
    error_codes: { addons: [{}, { staff_member: ["invalid"] }] },
  });

  assert.deepEqual(normalizePortalIssues(error, { addonCount: 2 }), [{
    scope: "addon",
    addonIndex: 1,
    field: "staff_member_id",
    message: "This staff member is unavailable.",
    validationCode: "invalid",
    code: "validation_error",
    action: "correct",
  }]);
});

test("attaches a flat field error only when one add-on was submitted", () => {
  const error = apiError(400, {
    code: "validation_error",
    errors: { service_option_id: "Choose an option." },
  });

  assert.equal(normalizePortalIssues(error, { addonCount: 1 })[0].scope, "addon");
  assert.equal(normalizePortalIssues(error, { addonCount: 1 })[0].addonIndex, 0);
  assert.equal(normalizePortalIssues(error, { addonCount: 1 })[0].field, "service_option_id");
  assert.equal(normalizePortalIssues(error, { addonCount: 2 })[0].scope, "batch");
  assert.equal(normalizePortalIssues(error, { addonCount: 2 })[0].field, "service_option_id");
});

test("keeps permission diagnostics out of the user-facing issue", () => {
  const error = apiError(403, {
    code: "permission_denied",
    detail: "Technical backend detail",
    required_permissions: ["booking_addons.create"],
  });

  assert.equal(normalizePortalIssues(error)[0].message, "This action is not available for your account.");
  assert.deepEqual(getApiError(error).requiredPermissions, ["booking_addons.create"]);
});

test("returns an idempotency failure as a batch issue without message matching", () => {
  const error = apiError(400, {
    code: "validation_error",
    detail: "Each add-on must have a unique idempotency_key.",
    errors: { addons: "Each add-on must have a unique idempotency_key." },
  });

  const [issue] = normalizePortalIssues(error, { addonCount: 2 });
  assert.equal(issue.scope, "batch");
  assert.equal(issue.action, "correct");
});

test("normalizes a network failure into an ambiguous retry issue", () => {
  const [issue] = normalizePortalIssues(new Error("timeout"), { addonCount: 3 });
  assert.equal(issue.scope, "system");
  assert.equal(issue.action, "retry");
  assert.match(issue.message, /confirm whether/);
});

test("uses message as the display summary while preserving field errors", () => {
  const error = apiError(400, {
    message: "Review the highlighted fields.",
    detail: "Review the highlighted fields.",
    code: "validation_error",
    errors: { email: ["Enter a valid email address."] },
  });

  assert.equal(firstApiErrorMessage(error), "Review the highlighted fields.");
  assert.equal(normalizePortalIssues(error)[0].message, "Enter a valid email address.");
});

test("prefers the body request id and exposes conflict control flow", () => {
  const error = apiError(409, {
    message: "The appointment changed.",
    code: "conflict",
    request_id: "body-id",
  }, { "x-request-id": "header-id" });

  assert.equal(getApiError(error).requestId, "body-id");
  assert.equal(normalizePortalIssues(error)[0].action, "refresh");
});

test("includes a server request id in support-ready error text", () => {
  const error = apiError(503, {
    message: "The service is temporarily unavailable.",
    request_id: "support-503",
  });

  assert.equal(
    firstApiErrorMessage(error),
    "The service is temporarily unavailable. Request ID: support-503",
  );
});
