const FIELD_ALIASES = Object.freeze({
  service: "service_id",
  staff_member: "staff_member_id",
});

const DEFAULT_MESSAGES = Object.freeze({
  authentication: "Your session has expired. Sign in to continue.",
  permission: "This action is not available for your account.",
  notFound: "Some appointment information is no longer available. Refresh and review your selections.",
  throttled: "Too many requests were made. Wait a moment and try again.",
  conflict: "This information changed since it was loaded. Refresh and try again.",
  network: "We couldn’t confirm whether the request was saved. Retry or refresh to reconcile it.",
  system: "The request could not be completed. Try again or contact support.",
  validation: "Review the highlighted information and try again.",
});

function responseData(error) {
  const data = error?.response?.data;
  return data && typeof data === "object" ? data : {};
}

function headerRequestId(error) {
  const headers = error?.response?.headers ?? {};
  return headers["x-request-id"] ?? headers["X-Request-ID"] ?? null;
}

export function getApiError(error) {
  const data = responseData(error);
  const status = error?.response?.status ?? error?.portal?.status ?? null;
  const message = typeof data.message === "string"
    ? data.message
    : typeof data.detail === "string"
      ? data.detail
      : undefined;
  return {
    status,
    code: typeof data.code === "string" ? data.code : error?.portal?.code ?? "request_failed",
    message: message ?? error?.portal?.message,
    detail: typeof data.detail === "string" ? data.detail : undefined,
    errors: data.errors && typeof data.errors === "object" ? data.errors : {},
    errorCodes: data.error_codes,
    permissionError: typeof data.error === "string" ? data.error : undefined,
    requiredPermissions: Array.isArray(data.required_permissions)
      ? data.required_permissions.filter((item) => typeof item === "string")
      : [],
    requestId: typeof data.request_id === "string"
      ? data.request_id
      : error?.portal?.requestId ?? headerRequestId(error),
    isNetworkError: !error?.response,
    isServerError: status !== null && status >= 500,
  };
}

function matchingCode(codes, key) {
  if (Array.isArray(codes)) return codes[key];
  if (codes && typeof codes === "object") return codes[key];
  return codes;
}

function collectLeaves(value, codes, path = [], output = []) {
  if (value === null || value === undefined || value === "") return output;

  if (["string", "number", "boolean"].includes(typeof value)) {
    output.push({
      path,
      message: String(value),
      validationCode: typeof codes === "string" ? codes : undefined,
    });
    return output;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectLeaves(item, matchingCode(codes, index), [...path, index], output);
    });
    return output;
  }

  if (typeof value === "object") {
    if (typeof value.message === "string") {
      output.push({
        path,
        message: value.message,
        validationCode: typeof value.code === "string"
          ? value.code
          : typeof codes?.code === "string"
            ? codes.code
            : undefined,
      });
      return output;
    }

    Object.entries(value).forEach(([key, item]) => {
      collectLeaves(item, matchingCode(codes, key), [...path, key], output);
    });
  }

  return output;
}

function aliasedField(path) {
  const field = [...path].reverse().find((part) => typeof part === "string" && part !== "addons");
  return field ? FIELD_ALIASES[field] ?? field : undefined;
}

function addonIndexFrom(path) {
  const addonsPosition = path.indexOf("addons");
  if (addonsPosition < 0) return undefined;
  const possibleIndex = path[addonsPosition + 1];
  return Number.isInteger(possibleIndex) ? possibleIndex : undefined;
}

function actionFor(meta, scope) {
  if (meta.status === 401 || meta.code === "authentication_failed") return "sign_in";
  if (meta.status === 403 || meta.code === "permission_denied") return "contact_manager";
  if (meta.status === 404 || scope === "appointment") return "refresh";
  if (meta.status === 409) return "refresh";
  if (meta.status === 429 || meta.status >= 500 || meta.isNetworkError) return "retry";
  return "correct";
}

function fallbackIssue(meta) {
  if (meta.status === 401 || meta.code === "authentication_failed") {
    return { scope: "authentication", message: DEFAULT_MESSAGES.authentication, action: "sign_in" };
  }
  if (meta.status === 403 || meta.code === "permission_denied") {
    return { scope: "system", message: DEFAULT_MESSAGES.permission, action: "contact_manager" };
  }
  if (meta.status === 404 || meta.code === "not_found") {
    return { scope: "appointment", message: meta.message ?? DEFAULT_MESSAGES.notFound, action: "refresh" };
  }
  if (meta.status === 409 || meta.code === "conflict") {
    return { scope: "batch", message: meta.message ?? DEFAULT_MESSAGES.conflict, action: "refresh" };
  }
  if (meta.status === 429 || meta.code === "throttled") {
    return { scope: "system", message: meta.message ?? DEFAULT_MESSAGES.throttled, action: "retry" };
  }
  if (meta.isNetworkError) {
    return { scope: "system", message: DEFAULT_MESSAGES.network, action: "retry" };
  }
  if (meta.status === 405 || meta.status === 415 || meta.status >= 500) {
    return { scope: "system", message: DEFAULT_MESSAGES.system, action: "retry" };
  }
  return {
    scope: "batch",
    message: meta.message ?? DEFAULT_MESSAGES.validation,
    action: meta.code === "validation_error" ? "correct" : "retry",
  };
}

export function normalizePortalIssues(error, { addonCount = 0 } = {}) {
  const meta = getApiError(error);
  const leaves = collectLeaves(meta.errors, meta.errorCodes);

  if (!leaves.length) return [{ ...fallbackIssue(meta), code: meta.code }];

  return leaves.map((leaf) => {
    const addonIndex = addonIndexFrom(leaf.path);
    const topLevel = leaf.path[0];
    let scope = "batch";

    if (meta.status === 401 || meta.code === "authentication_failed") scope = "authentication";
    else if (topLevel === "appointment") scope = "appointment";
    else if (addonIndex !== undefined) scope = "addon";
    else if (topLevel === "addons") scope = "batch";
    else if (addonCount === 1 && aliasedField(leaf.path)) scope = "addon";
    else if (meta.status === 403 || meta.status === 405 || meta.status === 415 || meta.status >= 500) scope = "system";

    return {
      scope,
      ...(scope === "addon" ? { addonIndex: addonIndex ?? 0 } : {}),
      ...(aliasedField(leaf.path) ? { field: aliasedField(leaf.path) } : {}),
      message: leaf.message,
      ...(leaf.validationCode ? { validationCode: leaf.validationCode } : {}),
      ...(meta.code ? { code: meta.code } : {}),
      action: actionFor(meta, scope),
    };
  });
}

export function firstApiErrorMessage(error, fallback = DEFAULT_MESSAGES.system) {
  const meta = getApiError(error);
  const message = meta.message
    ?? normalizePortalIssues(error)[0]?.message
    ?? (meta.isNetworkError ? DEFAULT_MESSAGES.network : fallback);
  return meta.isServerError && meta.requestId
    ? `${message} Request ID: ${meta.requestId}`
    : message;
}

export function apiErrorReference(error) {
  const id = getApiError(error).requestId;
  return id ? `Request ID: ${id}` : null;
}

export function isIntegrationError(error) {
  const { status, code } = getApiError(error);
  return status === 405 || status === 415 || code === "method_not_allowed" || code === "unsupported_media_type";
}

export { FIELD_ALIASES };
