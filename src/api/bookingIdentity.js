function positiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return number;
}

export function normalizeGuestContact({ fullName, full_name, email, phoneNumber, phone_number } = {}) {
  return {
    full_name: String(fullName ?? full_name ?? "").trim(),
    email: String(email ?? "").trim().toLowerCase() || null,
    phone_number: String(phoneNumber ?? phone_number ?? "").trim() || null,
  };
}

export function bookingIdentityPayload(identity) {
  switch (identity?.kind) {
    case "registered":
      return { customer_id: positiveInteger(identity.id, "Customer ID") };
    case "guest":
      return { guest_customer_id: positiveInteger(identity.id, "Guest customer ID") };
    case "new_guest": {
      const guest = normalizeGuestContact(identity);
      if (!guest.full_name) throw new Error("Guest name is required.");
      if (!guest.email && !guest.phone_number) {
        throw new Error("Enter a phone number or email for the guest.");
      }
      return { guest };
    }
    default:
      throw new Error("Select a registered customer, saved guest, or new guest.");
  }
}

export function appointmentGuestCustomerId(appointment = {}) {
  const guest = appointment.guest_customer;
  if (guest && typeof guest === "object") return guest.id ?? null;
  return appointment.guest_customer_id ?? (Number.isInteger(guest) ? guest : null);
}

export function waitlistGuestCustomerId(entry = {}) {
  const guest = entry.guest_customer;
  if (Number.isInteger(guest)) return guest;
  if (guest && typeof guest === "object") return guest.id ?? null;
  return entry.guest_customer_id ?? null;
}

export function isSavedGuestSelectionMissing(error, payload) {
  return error?.response?.status === 404 && Number.isInteger(payload?.guest_customer_id);
}
