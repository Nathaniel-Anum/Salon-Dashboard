import _axios from "./_axios.js";

const BASE = "/api/portal/v1/booking/guest-customers/";

export async function searchGuestCustomers(query = "", signal) {
  const search = String(query).trim();
  const response = await _axios.get(BASE, {
    ...(search ? { params: { search } } : {}),
    signal,
    portalMessage: false,
  });
  return Array.isArray(response.data) ? response.data : [];
}
