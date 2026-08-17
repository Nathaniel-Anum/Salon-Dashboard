import _axios from "./_axios";

const ENDPOINT = "/api/portal/v1/booking/deposit-rules/";

const normalizeId = (id) => String(id ?? "").trim();

export const getDepositRules = () =>
  _axios.get(ENDPOINT).then((response) => response.data);

export const createDepositRule = (payload) =>
  _axios.post(ENDPOINT, payload).then((response) => response.data);

export const getDepositRuleById = (id) =>
  _axios
    .get(`${ENDPOINT}${normalizeId(id)}/`)
    .then((response) => response.data);

export const patchDepositRule = (id, payload) =>
  _axios
    .patch(`${ENDPOINT}${normalizeId(id)}/`, payload)
    .then((response) => response.data);

export const deleteDepositRule = (id) =>
  _axios
    .delete(`${ENDPOINT}${normalizeId(id)}/`)
    .then((response) => response.data);
