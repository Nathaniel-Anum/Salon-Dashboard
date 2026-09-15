function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function subtractDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() - days);
  return next;
}

export function reportingRange(period, customStart, customEnd, now = new Date()) {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  let start;

  if (period === "custom" && customStart && customEnd) {
    start = new Date(`${customStart}T00:00:00Z`);
    const customEndDate = new Date(`${customEnd}T00:00:00Z`);
    const duration = Math.max(1, Math.round((customEndDate - start) / 86400000) + 1);
    const previousEnd = subtractDays(start, 1);
    return {
      current: { date_from: customStart, date_to: customEnd },
      previous: { date_from: isoDate(subtractDays(previousEnd, duration - 1)), date_to: isoDate(previousEnd) },
      currentLabel: `${customStart} to ${customEnd}`,
      previousLabel: "Previous matching period",
    };
  }

  if (period === "week") {
    const weekday = end.getUTCDay() || 7;
    start = subtractDays(end, weekday - 1);
  } else {
    start = subtractDays(end, period === "90" ? 89 : 29);
  }

  const duration = Math.round((end - start) / 86400000) + 1;
  const previousEnd = subtractDays(start, 1);
  return {
    current: { date_from: isoDate(start), date_to: isoDate(end) },
    previous: { date_from: isoDate(subtractDays(previousEnd, duration - 1)), date_to: isoDate(previousEnd) },
    currentLabel: period === "week" ? "This week" : period === "90" ? "Last 3 months" : "Last 30 days",
    previousLabel: period === "week" ? "Same days last week" : "Previous matching period",
  };
}

export { isoDate, subtractDays };
