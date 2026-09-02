export const PORTAL_SUCCESS_EVENT = "portal:mutation-success";

const MUTATION_METHODS = new Set(["post", "put", "patch", "delete"]);

const ERROR_MESSAGES = Object.freeze({
  401: "Your session has expired. Sign in to continue.",
  403: "You do not have access to complete this action.",
  409: "This information changed since it was loaded. Refresh and try again.",
  429: "Too many requests were made. Wait a moment and try again.",
  server: "We could not complete that action. Please try again or contact support.",
  request: "We could not complete that action. Please review it and try again.",
  network: "No response was received. Check your connection and try again.",
});

function requestPath(config = {}) {
  const url = config.url;
  if (typeof url !== "string") return "";

  try {
    return new URL(url, config.baseURL || "http://portal.local").pathname;
  } catch {
    return url.split("?")[0];
  }
}

export function isPortalRequest(config) {
  return requestPath(config).startsWith("/api/portal/");
}

export function isPortalMutation(config) {
  return isPortalRequest(config)
    && MUTATION_METHODS.has(String(config?.method || "get").toLowerCase());
}

export function responseHeader(headers, name) {
  if (!headers) return null;
  if (typeof headers.get === "function") return headers.get(name) || null;

  const expected = name.toLowerCase();
  const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === expected);
  return key ? headers[key] : null;
}

export function preparePortalResponse(response) {
  if (!isPortalRequest(response?.config)) return response;

  const requestId = responseHeader(response.headers, "X-Request-ID");
  const message = isPortalMutation(response.config) && response.config.portalMessage !== false
    ? responseHeader(response.headers, "X-Portal-Message")
    : null;

  response.portal = { requestId, message };

  if (response.status === 204) {
    response.data = null;
  }

  return response;
}

export function preparePortalError(error) {
  if (!isPortalRequest(error?.config)) return error;

  if (!error.response) {
    error.portal = {
      status: null,
      code: "network_error",
      message: ERROR_MESSAGES.network,
      requestId: null,
      isNetworkError: true,
    };
    return error;
  }

  const { response } = error;
  const existing = response.data && typeof response.data === "object" ? response.data : {};
  const requestId = typeof existing.request_id === "string"
    ? existing.request_id
    : responseHeader(response.headers, "X-Request-ID");
  const message = typeof existing.message === "string"
    ? existing.message
    : typeof existing.detail === "string"
      ? existing.detail
      : ERROR_MESSAGES[response.status]
        || (response.status >= 500 ? ERROR_MESSAGES.server : ERROR_MESSAGES.request);
  const code = typeof existing.code === "string" ? existing.code : "request_failed";

  response.data = {
    ...existing,
    success: false,
    message,
    detail: typeof existing.detail === "string" ? existing.detail : message,
    code,
    request_id: requestId,
  };
  error.portal = {
    status: response.status,
    code,
    message,
    requestId,
    isNetworkError: false,
  };
  return error;
}

export function announcePortalSuccess(response, eventTarget = globalThis.window) {
  const message = response?.portal?.message;
  if (!message || !eventTarget?.dispatchEvent || typeof CustomEvent === "undefined") return;

  eventTarget.dispatchEvent(new CustomEvent(PORTAL_SUCCESS_EVENT, {
    detail: {
      message,
      requestId: response.portal.requestId,
      status: response.status,
    },
  }));
}
