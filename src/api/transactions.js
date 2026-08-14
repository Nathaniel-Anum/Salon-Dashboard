import _axios from "./_axios";

export const getTransactionAppointments = (params = {}) =>
  _axios
    .get("/api/portal/v1/booking/appointments/", {
      params,
    })
    .then((response) => response.data);

export const createSalonPayment = (appointmentId, payload) =>
  _axios.post(
    `/api/portal/v1/booking/appointments/${appointmentId}/salon-payments/`,
    payload,
  );