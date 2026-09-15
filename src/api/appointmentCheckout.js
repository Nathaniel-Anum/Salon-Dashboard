import _axios from "./_axios";
import { correctNoShowV2, getAppointmentV2, updateAppointmentStatusV2 } from "./bookingV2.js";

const base = (appointmentId) =>
  `/api/portal/v1/booking/appointments/${appointmentId}`;

export const getCheckoutAppointment = (appointmentId, { v2 = false } = {}) =>
  v2 ? getAppointmentV2(appointmentId) : _axios.get(`${base(appointmentId)}/`).then((response) => response.data);

export const getAppointmentAddons = (appointmentId) =>
  _axios.get(`${base(appointmentId)}/addons/`).then((response) => response.data);

export const getAppointmentFinancialSummary = (appointmentId) =>
  _axios
    .get(`${base(appointmentId)}/financial-summary/`)
    .then((response) => response.data);

export const getAppointmentReceipts = (appointmentId) =>
  _axios.get(`${base(appointmentId)}/receipts/`).then((response) => response.data);

export const updateCheckoutStatus = (appointmentId, status, { v2 = false } = {}) =>
  v2 ? updateAppointmentStatusV2(appointmentId, status) : _axios.post(`${base(appointmentId)}/status/`, { status }).then((response) => response.data);

export const createAppointmentAddon = (appointmentId, payload) =>
  _axios
    .post(`${base(appointmentId)}/addons/`, payload)
    .then((response) => response.data);

export const voidAppointmentAddon = (appointmentId, addonPublicId, payload) =>
  _axios
    .post(`${base(appointmentId)}/addons/${addonPublicId}/void/`, payload)
    .then((response) => response.data);

export const recordAppointmentPayment = (appointmentId, payload) =>
  _axios
    .post(`${base(appointmentId)}/salon-payments/`, payload)
    .then((response) => response.data);

export const reverseAppointmentPayment = (appointmentId, paymentPublicId, payload) =>
  _axios
    .post(`${base(appointmentId)}/salon-payments/${paymentPublicId}/reverse/`, payload)
    .then((response) => response.data);

export const finalizeAppointmentSettlement = (appointmentId, payload) =>
  _axios
    .post(`${base(appointmentId)}/settlement/finalize/`, payload)
    .then((response) => response.data);

export const correctAppointmentNoShow = (appointmentId, payload, { v2 = false } = {}) =>
  v2 ? correctNoShowV2(appointmentId, payload) : _axios.post(`${base(appointmentId)}/correct-no-show/`, payload).then((response) => response.data);
