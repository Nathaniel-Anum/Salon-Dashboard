export const REVENUE_METRICS = [
  { key: "booking_revenue", field: "booking_revenue", title: "Booking revenue", description: "Successful deposits, full payments and balance payments", revenue: true, accent: "gold" },
  { key: "commerce_revenue", field: "commerce_revenue", title: "Commerce revenue", description: "Successful shop-order payments", revenue: true, accent: "gold" },
];

export const APPOINTMENT_METRICS = [
  { key: "completed", field: "appointments_completed", title: "Completed appointments", description: "Appointments marked as completed", accent: "sage" },
  { key: "no_show", field: "appointments_no_show", title: "No-shows", description: "Appointments marked as no-show", accent: "rose", lowerIsBetter: true },
  { key: "rescheduled", field: "appointments_rescheduled", title: "Rescheduled appointments", description: "Recorded appointment reschedules", accent: "sage" },
  { key: "arrived", field: "appointments_arrived", title: "Arrived appointments", description: "Appointments marked as arrived", accent: "sage" },
];

export const PORTAL_METRICS = [...REVENUE_METRICS, ...APPOINTMENT_METRICS];

export function reportPeriod(data, period) {
  if (period === "week") return data?.week_comparison?.current_week;
  if (period === "previous_week") return data?.week_comparison?.previous_week;
  return data?.[{ today: "today", 30: "last_30_days", 90: "last_90_days", custom: "custom_period" }[period]];
}

// Portal analytics use inclusive dates; insight endpoints use exclusive ends.
export function reportPeriodLabel(period) {
  return period?.date_from && period?.date_to ? `${period.date_from} to ${period.date_to}` : "Period unavailable";
}
