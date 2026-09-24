import { getAssignedStaffIds } from "../api/providerEligibility.js";

export function serviceFormValues(service, duplicate = false) {
  const price = Number.parseFloat(service.price);
  const priceType = service.price_type || (price === 0 ? "free" : "fixed");
  const rawOptions = service.service_options ?? service.options ?? service.service_option_details;
  const options = Array.isArray(rawOptions) ? rawOptions : [];

  return {
    name: service.name,
    description: service.description ?? "",
    duration: service.duration,
    price: priceType === "free" ? undefined : price,
    price_type: priceType,
    is_active: service.is_active,
    category: service.category ?? undefined,
    staff_ids: getAssignedStaffIds(service),
    service_options: options.map((option) => ({
      ...(!duplicate && option?.id ? { id: option.id } : {}),
      name: option?.name ?? "",
      price: String(option?.price ?? ""),
      duration: Number(option?.duration ?? service.duration ?? 15),
      description: option?.description ?? "",
      is_active: option?.is_active !== false,
    })),
  };
}
