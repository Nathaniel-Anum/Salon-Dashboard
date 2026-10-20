const STATUS_LABELS = {
  pending: "Pending",
  "pending-deposit": "Pending deposit",
  "pending-payment": "Pending payment",
  confirmed: "Confirmed",
  arrived: "Arrived",
  completed: "Completed",
  "no-show": "No-show",
  cancelled: "Cancelled",
};

export const normalizeAppointmentStatus = (status) =>
  String(status || "pending").trim().toLowerCase().replaceAll("_", "-");

export function appointmentStatusOptions(status) {
  const current = normalizeAppointmentStatus(status);
  const transitions = {
    pending: ["confirmed", "cancelled"],
    "pending-deposit": ["confirmed", "cancelled"],
    "pending-payment": ["confirmed", "cancelled"],
    confirmed: ["arrived", "no-show", "cancelled"],
    arrived: ["completed", "no-show", "cancelled"],
  }[current] ?? [];

  return [current, ...transitions]
    .filter((value, index, values) => values.indexOf(value) === index)
    .map((value) => ({ value, label: STATUS_LABELS[value] ?? value.replaceAll("-", " ") }));
}

function relatedId(value) {
  return value && typeof value === "object"
    ? value.id ?? value.user_id ?? value.account_id ?? null
    : value ?? null;
}

export function appointmentServiceEditRows(services = []) {
  return services.map((service, index) => {
    const appointmentItemId = service.appointment_item_id ?? service.item_id ?? service.id ?? null;
    return {
      id: appointmentItemId,
      clientId: appointmentItemId == null ? `recorded-service-${index}` : `appointment-service-${appointmentItemId}`,
      appointmentItemId,
      serviceId: service.service_id ?? relatedId(service.service_details) ?? relatedId(service.service),
      optionId: service.service_option_id ?? relatedId(service.service_option_details) ?? relatedId(service.service_option),
      providerId: service.staff_id ?? service.provider_id ?? service.staff_member_id ??
        relatedId(service.staff_details) ?? relatedId(service.staff_member) ?? relatedId(service.provider) ?? relatedId(service.staff),
      canReassign: appointmentItemId != null,
      lineTotal: service.line_total_amount ?? service.total ?? service.price_snapshot ?? service.price ?? null,
      raw: service,
    };
  });
}

export const appointmentPaymentTime = (payment = {}) =>
  payment.paid_at ?? payment.completed_at ?? payment.received_at ?? payment.recorded_at ?? payment.created_at ?? null;
