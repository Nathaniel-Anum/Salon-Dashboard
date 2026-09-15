export function getStaffReferenceId(reference) {
  if (reference && typeof reference === "object") {
    return reference.id ?? reference.staff_id ?? reference.user_id ?? reference.account_id;
  }
  return reference;
}

export function getAssignedStaffIds(service = {}) {
  const assignedStaff = [service.assigned_staff_ids, service.staff_ids, service.assigned_staff]
    .find((candidate) => Array.isArray(candidate) && candidate.length > 0);
  if (!assignedStaff) return [];
  return assignedStaff.map(getStaffReferenceId)
    .filter((id) => id !== null && id !== undefined && id !== "")
    .filter((id, index, ids) => ids.findIndex((candidate) => String(candidate) === String(id)) === index);
}

export function normalizeRoleIds(values = []) {
  return (Array.isArray(values) ? values : [])
    .map((value) => Number(value?.id ?? value))
    .filter((value) => Number.isFinite(value) && value > 0)
    .filter((value, index, valuesList) => valuesList.indexOf(value) === index);
}

export function getCategoryRoleIds(category = {}) {
  return normalizeRoleIds(Array.isArray(category.eligible_role_ids) ? category.eligible_role_ids : category.eligible_roles);
}

export function isActiveRole(role = {}) {
  const status = String(role?.status ?? "").trim().toLowerCase();
  return role != null && role.is_active !== false && role.active !== false && !["inactive", "disabled", "archived"].includes(status);
}

export function isStaffEligibleForService(service, staff, categories = []) {
  if (!isActiveRole(staff)) return false;
  const staffIds = [staff.id, staff.user, staff.user_id, staff.account_id].filter((id) => id != null).map(String);
  if (getAssignedStaffIds(service).some((id) => staffIds.includes(String(id)))) return true;
  const categoryId = service.category_id ?? service.category?.id ?? service.category;
  const category = categories.find((row) => String(row.id) === String(categoryId)) ?? service.category;
  const eligibleRoles = getCategoryRoleIds(category && typeof category === "object" ? category : {});
  return (staff.roles ?? []).some((role) => isActiveRole(role) && eligibleRoles.includes(Number(role?.id ?? role)));
}

export function isStaffEligibleForCorrection(service, staff, categories = []) {
  const roles = (staff?.roles ?? []).filter(isActiveRole);
  if (!staff || !isActiveRole(staff) || !roles.length || staff.is_external === true ||
    (staff.account_type != null && staff.account_type !== "staff")) return false;
  const categoryId = service.category_id ?? service.category?.id ?? service.category;
  const category = categories.find((row) => String(row.id) === String(categoryId)) ?? service.category;
  const activeService = { ...service, category: category && typeof category === "object" && isActiveRole(category) ? category : null };
  if (isStaffEligibleForService(activeService, staff, categories.filter(isActiveRole))) return true;
  return !roles.some((role) => ["admin", "front_desk"].includes(
    String(role.code ?? role.slug ?? role.name ?? role).toLowerCase().replaceAll(" ", "_"),
  ));
}
