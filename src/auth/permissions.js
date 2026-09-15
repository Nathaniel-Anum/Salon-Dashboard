const PERMISSION_KEYS = [
  "permissions",
  "permission_codes",
  "effective_permissions",
  "allowed_permissions",
];

function safeJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function decodeJwt(token) {
  const payload = String(token || "").split(".")[1];
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(decodeURIComponent(
      atob(padded)
        .split("")
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join(""),
    ));
  } catch {
    return null;
  }
}

function permissionCode(permission) {
  if (typeof permission === "string") return permission;
  if (!permission || typeof permission !== "object") return null;
  return permission.codename || permission.code || permission.permission || permission.name || null;
}

function collectPermissions(source, output = new Set()) {
  if (!source || typeof source !== "object") return output;

  PERMISSION_KEYS.forEach((key) => {
    const value = source[key];
    if (!Array.isArray(value)) return;
    value.forEach((permission) => {
      const code = permissionCode(permission);
      if (code) output.add(String(code));
    });
  });

  [source.user, source.account, source.profile, source.role].forEach((nested) => {
    if (nested && nested !== source) collectPermissions(nested, output);
  });
  return output;
}

function containsPermissionSnapshot(source) {
  if (!source || typeof source !== "object") return false;
  if (PERMISSION_KEYS.some((key) => Array.isArray(source[key]))) return true;
  return [source.user, source.account, source.profile, source.role]
    .some((nested) => nested && nested !== source && containsPermissionSnapshot(nested));
}

function isSuperuser(source) {
  return Boolean(
    source?.is_superuser ||
    source?.user?.is_superuser ||
    source?.account?.is_superuser ||
    source?.profile?.is_superuser,
  );
}

/**
 * Returns true/false when the session contains an explicit permission snapshot,
 * and null for older sessions where the backend must remain the capability check.
 */
export function permissionState(permission, contextualSource) {
  const storedSession = safeJson(localStorage.getItem("portalSession"));
  const storedUser = safeJson(localStorage.getItem("portalUser"));
  const tokenClaims = decodeJwt(localStorage.getItem("access"));
  const sources = [contextualSource, storedSession, storedUser, tokenClaims].filter(Boolean);

  if (sources.some(isSuperuser)) return true;

  const codes = new Set();
  sources.forEach((source) => collectPermissions(source, codes));
  if (!codes.size) return sources.some(containsPermissionSnapshot) ? false : null;
  return codes.has(permission) || codes.has("*");
}

export function storePortalSession(loginResponse) {
  if (!loginResponse || typeof loginResponse !== "object") return;
  const session = {
    user: loginResponse.user || loginResponse.account || loginResponse.profile || null,
    permissions:
      loginResponse.permissions ||
      loginResponse.permission_codes ||
      loginResponse.effective_permissions ||
      null,
    is_superuser: Boolean(
      loginResponse.is_superuser ||
      loginResponse.user?.is_superuser ||
      loginResponse.account?.is_superuser,
    ),
  };
  if (session.user || session.permissions || session.is_superuser) {
    localStorage.setItem("portalSession", JSON.stringify(session));
  }
}

export function clearPortalSession() {
  localStorage.removeItem("portalSession");
  localStorage.removeItem("portalUser");
}
