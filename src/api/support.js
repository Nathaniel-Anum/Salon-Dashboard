import _axios from "./_axios";

const normalizeTicketId = (publicId) => String(publicId || "").trim();

const buildTicketParams = (filters = {}) => {
  const params = {};
  const allowed = [
    "status",
    "priority",
    "category",
    "assignee",
    "customer",
    "search",
    "date_from",
    "date_to",
    "aging_bucket",
  ];

  allowed.forEach((key) => {
    const value = filters[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      params[key] = value;
    }
  });

  if (filters.unassigned === true) {
    params.unassigned = true;
  }

  return params;
};

export const getSupportTickets = (filters = {}) =>
  _axios
    .get("/api/portal/v1/support/tickets/", { params: buildTicketParams(filters) })
    .then((r) => r.data);

export const getSupportTicket = (publicId) =>
  _axios
    .get(`/api/portal/v1/support/tickets/${normalizeTicketId(publicId)}/`)
    .then((r) => r.data);

export const getSupportTicketMessages = (publicId) =>
  _axios
    .get(
      `/api/portal/v1/support/tickets/${normalizeTicketId(publicId)}/messages/`,
    )
    .then((r) => r.data);

export const getSupportTicketNotes = (publicId) =>
  _axios
    .get(`/api/portal/v1/support/tickets/${normalizeTicketId(publicId)}/notes/`)
    .then((r) => r.data);

export const getSupportTicketAttachments = (publicId) =>
  _axios
    .get(`/api/portal/v1/support/tickets/${normalizeTicketId(publicId)}/attachments/`)
    .then((r) => r.data);

export const replyToSupportTicket = (publicId, data) =>
  _axios.post(
    `/api/portal/v1/support/tickets/${normalizeTicketId(publicId)}/reply/`,
    data,
  );

export const addSupportTicketNote = (publicId, data) =>
  _axios.post(
    `/api/portal/v1/support/tickets/${normalizeTicketId(publicId)}/notes/`,
    data,
  );

export const assignSupportTicket = (publicId, data) =>
  _axios.post(
    `/api/portal/v1/support/tickets/${normalizeTicketId(publicId)}/assign/`,
    data,
  );

export const updateSupportTicketPriority = (publicId, data) =>
  _axios.post(
    `/api/portal/v1/support/tickets/${normalizeTicketId(publicId)}/priority/`,
    data,
  );

export const resolveSupportTicket = (publicId, data) =>
  _axios.post(
    `/api/portal/v1/support/tickets/${normalizeTicketId(publicId)}/resolve/`,
    data,
  );

export const closeSupportTicket = (publicId, data) =>
  _axios.post(
    `/api/portal/v1/support/tickets/${normalizeTicketId(publicId)}/close/`,
    data,
  );

export const reopenSupportTicket = (publicId, data) =>
  _axios.post(
    `/api/portal/v1/support/tickets/${normalizeTicketId(publicId)}/reopen/`,
    data,
  );

export const getSupportAssignees = () =>
  _axios.get("/api/portal/v1/accounts/staff/").then((r) => r.data);
