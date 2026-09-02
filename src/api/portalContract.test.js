import test from "node:test";
import assert from "node:assert/strict";
import {
  isPortalMutation,
  isPortalRequest,
  preparePortalError,
  preparePortalResponse,
} from "./portalContract.js";

test("limits the contract to portal routes", () => {
  assert.equal(isPortalRequest({ url: "/api/portal/v1/booking/appointments/" }), true);
  assert.equal(isPortalRequest({ url: "/api/app/v1/accounts/refresh/" }), false);
  assert.equal(isPortalMutation({ url: "/api/portal/v1/roles/", method: "delete" }), true);
  assert.equal(isPortalMutation({ url: "/api/portal/v1/roles/", method: "get" }), false);
});

test("keeps successful detail bodies and captures mutation headers", () => {
  const response = preparePortalResponse({
    status: 200,
    data: { detail: "Notification sent successfully." },
    headers: {
      "x-portal-message": "Notification sent successfully.",
      "x-request-id": "request-123",
    },
    config: { url: "/api/portal/v1/notifications/send/", method: "post" },
  });

  assert.deepEqual(response.data, { detail: "Notification sent successfully." });
  assert.deepEqual(response.portal, {
    message: "Notification sent successfully.",
    requestId: "request-123",
  });
});

test("allows read-like portal posts to suppress success announcements", () => {
  const response = preparePortalResponse({
    status: 200,
    data: { available: true },
    headers: { "x-portal-message": "Staff options loaded." },
    config: {
      url: "/api/portal/v1/booking/services/booking-staff-options/",
      method: "post",
      portalMessage: false,
    },
  });

  assert.equal(response.portal.message, null);
});

test("normalizes portal 204 responses to null without affecting public responses", () => {
  const portal = preparePortalResponse({
    status: 204,
    data: "",
    headers: { "X-Portal-Message": "Role deleted successfully." },
    config: { url: "/api/portal/v1/roles/1/", method: "DELETE" },
  });
  const publicResponse = preparePortalResponse({
    status: 204,
    data: "",
    headers: {},
    config: { url: "/api/public/v1/roles/1/", method: "DELETE" },
  });

  assert.equal(portal.data, null);
  assert.equal(publicResponse.data, "");
});

test("converts malformed portal failures to safe structured errors", () => {
  const error = preparePortalError({
    config: { url: "/api/portal/v1/roles/1/", method: "patch" },
    response: {
      status: 500,
      data: "upstream html",
      headers: { "x-request-id": "request-500" },
    },
  });

  assert.deepEqual(error.response.data, {
    success: false,
    message: "We could not complete that action. Please try again or contact support.",
    detail: "We could not complete that action. Please try again or contact support.",
    code: "request_failed",
    request_id: "request-500",
  });
});

test("keeps network failures distinct from HTTP failures", () => {
  const error = preparePortalError({
    config: { url: "/api/portal/v1/roles/", method: "get" },
  });

  assert.equal(error.portal.code, "network_error");
  assert.equal(error.portal.isNetworkError, true);
  assert.match(error.portal.message, /connection/);
});
