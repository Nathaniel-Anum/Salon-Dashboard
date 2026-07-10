import _axios from "./_axios";

const buildParams = (filters = {}) => {
  const params = {};
  if (filters.date_from) params.date_from = filters.date_from;
  if (filters.date_to) params.date_to = filters.date_to;
  if (filters.source) params.source = filters.source;
  if (filters.service_id) params.service_id = filters.service_id;
  if (filters.product_id) params.product_id = filters.product_id;
  if (filters.staff_id) params.staff_id = filters.staff_id;
  if (filters.payment_channel) params.payment_channel = filters.payment_channel;
  if (filters.purpose) params.purpose = filters.purpose;
  return params;
};

export const getAnalyticsOverview = (filters = {}) =>
  _axios
    .get("/api/portal/v1/analytics/overview/", { params: buildParams(filters) })
    .then((r) => r.data);

export const getAnalyticsRevenue = (filters = {}) =>
  _axios
    .get("/api/portal/v1/analytics/revenue/", { params: buildParams(filters) })
    .then((r) => r.data);

export const getAnalyticsBookings = (filters = {}) =>
  _axios
    .get("/api/portal/v1/analytics/bookings/", { params: buildParams(filters) })
    .then((r) => r.data);

export const getAnalyticsCommerce = (filters = {}) =>
  _axios
    .get("/api/portal/v1/analytics/commerce/", { params: buildParams(filters) })
    .then((r) => r.data);

export const getAnalyticsPayments = (filters = {}) =>
  _axios
    .get("/api/portal/v1/analytics/payments/", { params: buildParams(filters) })
    .then((r) => r.data);
