const PALETTE = ["#b99a45", "#6f7d66", "#885e6b", "#c97b63", "#496f79", "#d2b778"];

export function formatCurrency(value, currency = "GHS", compact = false) {
  if (value === null || value === undefined || value === "") return "—";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  try {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency,
      notation: compact ? "compact" : "standard",
      minimumFractionDigits: compact ? 0 : 2,
      maximumFractionDigits: compact ? 1 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

export function formatNumber(value) {
  return value === null || value === undefined ? "—" : Number(value).toLocaleString("en-US");
}

export function comparisonLabel(comparison) {
  if (!comparison) return "Comparison unavailable";
  if (comparison.reason === "NO_PREVIOUS_BASE") return "No comparable value last week";
  if (comparison.percentage_change === null || comparison.percentage_change === undefined) {
    return "Comparison unavailable";
  }
  const percentage = Number(comparison.percentage_change);
  if (percentage > 0) return `${percentage.toFixed(1)}% higher than last week`;
  if (percentage < 0) return `${Math.abs(percentage).toFixed(1)}% lower than last week`;
  return "No change from last week";
}

export function comparisonDirection(comparison) {
  const value = Number(comparison?.percentage_change);
  if (comparison?.percentage_change === null || !Number.isFinite(value) || value === 0) return "flat";
  return value > 0 ? "up" : "down";
}

export function comparisonSentiment(comparison, lowerIsBetter = false) {
  const direction = comparisonDirection(comparison);
  if (direction === "flat") return "flat";
  if (!lowerIsBetter) return direction;
  return direction === "down" ? "up" : "down";
}

function decimalToMinor(value) {
  const normalized = String(value ?? "0").trim();
  const negative = normalized.startsWith("-");
  const unsigned = normalized.replace(/^[-+]/, "");
  const [whole = "0", fraction = ""] = unsigned.split(".");
  const minor = BigInt(whole || "0") * 100n + BigInt((fraction + "00").slice(0, 2));
  return negative ? -minor : minor;
}

function minorToDecimal(value) {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  return `${negative ? "-" : ""}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}

export function aggregatePaymentMethods(data, currency) {
  const totals = new Map();
  (data?.breakdowns?.by_source ?? [])
    .filter((source) => source.currency === currency)
    .forEach((source) => {
      (source.payment_methods ?? []).forEach((method) => {
        const label = method.payment_method_label || "Not captured";
        const current = totals.get(label) ?? 0n;
        totals.set(label, current + decimalToMinor(method.received_amount));
      });
    });

  return [...totals.entries()]
    .map(([name, minor], index) => ({
      name,
      amount: minorToDecimal(minor),
      value: Number(minor) / 100,
      itemStyle: { color: PALETTE[index % PALETTE.length] },
    }))
    .sort((a, b) => b.value - a.value);
}

export function sumDecimalStrings(values) {
  return minorToDecimal(values.reduce((total, value) => total + decimalToMinor(value), 0n));
}

export function formatDate(value, options = {}) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: options.year ? "numeric" : undefined,
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export function periodLabel(period) {
  if (!period?.date_from || !period?.date_to) return period?.label || "This week";
  const inclusiveEnd = new Date(`${period.date_to}T00:00:00Z`);
  inclusiveEnd.setUTCDate(inclusiveEnd.getUTCDate() - 1);
  return `${formatDate(period.date_from)} – ${formatDate(inclusiveEnd.toISOString().slice(0, 10), { year: true })}`;
}

export function formatFreshness(value) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(value));
}

const axisLabel = { color: "#8b7d6b", fontFamily: "Poppins", fontSize: 11 };
const splitLine = { lineStyle: { color: "rgba(95, 72, 48, 0.09)" } };

function baseTooltip(formatValue) {
  return {
    trigger: "axis",
    confine: true,
    backgroundColor: "#26231f",
    borderWidth: 0,
    textStyle: { color: "#fff", fontFamily: "Poppins", fontSize: 12 },
    extraCssText: "border-radius:12px;box-shadow:0 12px 35px rgba(32,28,24,.22);",
    valueFormatter: formatValue,
  };
}

export function buildMoneyTrendOption(data, currency, periodKey = "week") {
  if (!data) return {};
  if (periodKey === "week") {
    const points = [...(data.series?.week_comparison?.currencies?.find((row) => row.currency === currency)?.points ?? [])].sort((a, b) => Number(a.position) - Number(b.position));
    return {
      animationDuration: 550,
      color: ["#b99a45", "#b7ada0"],
      tooltip: baseTooltip((value) => formatCurrency(value, currency)),
      legend: { top: 0, left: 0, itemWidth: 18, itemHeight: 8, textStyle: axisLabel },
      grid: { left: 8, right: 12, top: 44, bottom: 8, containLabel: true },
      xAxis: { type: "category", boundaryGap: false, data: points.map((point) => point.label), axisLabel, axisTick: { show: false }, axisLine: { lineStyle: { color: "#ddd3c6" } } },
      yAxis: { type: "value", axisLabel: { ...axisLabel, formatter: (value) => formatCurrency(value, currency, true) }, axisLine: { show: false }, axisTick: { show: false }, splitLine },
      series: [
        { name: "This week", type: "line", smooth: 0.35, symbol: "circle", symbolSize: 7, lineStyle: { width: 3 }, data: points.map((point) => Number(point.active_week?.received_amount ?? 0)), areaStyle: { color: "rgba(185,154,69,.11)" } },
        { name: "Same days last week", type: "line", smooth: 0.35, symbol: "none", lineStyle: { width: 2, type: "dashed" }, data: points.map((point) => Number(point.previous_week?.received_amount ?? 0)) },
      ],
    };
  }

  const history = periodKey === "30" ? data.series?.last_30_days : data.series?.last_90_days;
  const points = history?.currencies?.find((row) => row.currency === currency)?.points ?? [];
  return {
    animationDuration: 550,
    color: ["#b99a45"],
    tooltip: baseTooltip((value) => formatCurrency(value, currency)),
    grid: { left: 8, right: 12, top: 20, bottom: 8, containLabel: true },
    xAxis: { type: "category", boundaryGap: false, data: points.map((point) => formatDate(point.date_from)), axisLabel: { ...axisLabel, hideOverlap: true }, axisTick: { show: false }, axisLine: { lineStyle: { color: "#ddd3c6" } } },
    yAxis: { type: "value", axisLabel: { ...axisLabel, formatter: (value) => formatCurrency(value, currency, true) }, axisLine: { show: false }, axisTick: { show: false }, splitLine },
    series: [{ name: "Money received", type: "line", smooth: 0.3, showSymbol: points.length < 15, symbolSize: 6, lineStyle: { width: 3 }, data: points.map((point) => ({ value: Number(point.received_amount ?? 0), itemStyle: point.is_partial ? { opacity: 0.45 } : undefined })), areaStyle: { color: "rgba(185,154,69,.12)" } }],
  };
}

export function buildAppointmentsTrendOption(data, periodKey = "week") {
  if (!data) return {};
  if (periodKey === "week") {
    const points = [...(data.series?.week_comparison?.points ?? [])].sort((a, b) => Number(a.position) - Number(b.position));
    return {
      animationDuration: 550,
      color: ["#6f7d66", "#b7ada0"],
      tooltip: baseTooltip((value) => `${formatNumber(value)} appointments`),
      legend: { top: 0, left: 0, itemWidth: 18, itemHeight: 8, textStyle: axisLabel },
      grid: { left: 8, right: 12, top: 44, bottom: 8, containLabel: true },
      xAxis: { type: "category", boundaryGap: false, data: points.map((point) => point.label), axisLabel, axisTick: { show: false }, axisLine: { lineStyle: { color: "#ddd3c6" } } },
      yAxis: { type: "value", minInterval: 1, axisLabel, axisLine: { show: false }, axisTick: { show: false }, splitLine },
      series: [
        { name: "This week", type: "line", smooth: 0.35, symbol: "circle", symbolSize: 7, lineStyle: { width: 3 }, data: points.map((point) => point.active_week?.appointments_created ?? 0), areaStyle: { color: "rgba(111,125,102,.1)" } },
        { name: "Same days last week", type: "line", smooth: 0.35, symbol: "none", lineStyle: { width: 2, type: "dashed" }, data: points.map((point) => point.previous_week?.appointments_created ?? 0) },
      ],
    };
  }
  const history = periodKey === "30" ? data.series?.last_30_days : data.series?.last_90_days;
  const points = history?.points ?? [];
  return {
    animationDuration: 550,
    color: ["#6f7d66"],
    tooltip: baseTooltip((value) => `${formatNumber(value)} appointments`),
    grid: { left: 8, right: 12, top: 20, bottom: 8, containLabel: true },
    xAxis: { type: "category", boundaryGap: false, data: points.map((point) => formatDate(point.date_from)), axisLabel: { ...axisLabel, hideOverlap: true }, axisTick: { show: false }, axisLine: { lineStyle: { color: "#ddd3c6" } } },
    yAxis: { type: "value", minInterval: 1, axisLabel, axisLine: { show: false }, axisTick: { show: false }, splitLine },
    series: [{ name: "Appointments created", type: "line", smooth: 0.3, showSymbol: points.length < 15, symbolSize: 6, lineStyle: { width: 3 }, data: points.map((point) => ({ value: point.appointments_created ?? 0, itemStyle: point.is_partial ? { opacity: 0.45 } : undefined })), areaStyle: { color: "rgba(111,125,102,.1)" } }],
  };
}

export function buildRevenueComparisonOption(data, currency = "GHS") {
  const fields = ["booking_revenue", "commerce_revenue"];
  return {
    animationDuration: 550,
    color: ["#b99a45", "#b7ada0"],
    tooltip: baseTooltip((value) => formatCurrency(value, currency)),
    legend: { top: 0, left: 0, textStyle: axisLabel },
    grid: { left: 8, right: 12, top: 44, bottom: 8, containLabel: true },
    xAxis: { type: "category", data: ["Booking revenue", "Commerce revenue"], axisLabel, axisTick: { show: false }, axisLine: { lineStyle: { color: "#ddd3c6" } } },
    yAxis: { type: "value", axisLabel: { ...axisLabel, formatter: (value) => formatCurrency(value, currency, true) }, axisLine: { show: false }, axisTick: { show: false }, splitLine },
    series: [["current_week", "This week"], ["previous_week", "Same days last week"]].map(([key, name]) => ({
      name, type: "bar", barMaxWidth: 48,
      data: fields.map((field) => data?.week_comparison?.[key]?.[field] == null ? null : Number(data.week_comparison[key][field])),
    })),
  };
}

export function buildDonutOption(rows, { valueFormatter = formatNumber, centerLabel = "Total" } = {}) {
  const total = rows.reduce((sum, row) => sum + Number(row.value || 0), 0);
  return {
    animationDuration: 650,
    tooltip: {
      trigger: "item",
      confine: true,
      backgroundColor: "#26231f",
      borderWidth: 0,
      textStyle: { color: "#fff", fontFamily: "Poppins", fontSize: 12 },
      formatter: (params) => `${params.name}<br/><strong>${valueFormatter(params.value, params.data)}</strong> · ${params.percent}%`,
    },
    title: {
      text: valueFormatter(total),
      subtext: centerLabel,
      left: "center",
      top: "39%",
      textStyle: { color: "#2b2722", fontFamily: "Playfair Display", fontSize: 18, fontWeight: 600 },
      subtextStyle: { color: "#8b7d6b", fontFamily: "Poppins", fontSize: 10 },
    },
    series: [{
      type: "pie",
      radius: ["55%", "78%"],
      center: ["50%", "50%"],
      avoidLabelOverlap: true,
      padAngle: 2,
      itemStyle: { borderRadius: 10, borderColor: "#fffdf9", borderWidth: 3 },
      label: { show: false },
      emphasis: { scaleSize: 5 },
      data: rows,
    }],
  };
}

export function buildHorizontalBarOption(rows) {
  const sorted = [...rows].sort((a, b) => Number(a.value) - Number(b.value));
  return {
    animationDuration: 550,
    color: ["#6f7d66"],
    tooltip: { ...baseTooltip((value) => `${formatNumber(value)} appointments`), trigger: "item" },
    grid: { left: 8, right: 26, top: 6, bottom: 8, containLabel: true },
    xAxis: { type: "value", minInterval: 1, axisLabel, axisLine: { show: false }, axisTick: { show: false }, splitLine },
    yAxis: { type: "category", data: sorted.map((row) => row.name), axisLabel: { ...axisLabel, color: "#554c42" }, axisLine: { show: false }, axisTick: { show: false } },
    series: [{ type: "bar", data: sorted.map((row) => row.value), barWidth: 12, itemStyle: { borderRadius: [0, 8, 8, 0], color: "#6f7d66" }, label: { show: true, position: "right", color: "#554c42", fontFamily: "Poppins", fontSize: 11 } }],
  };
}

export function buildMetricComparisonOption(
  current,
  previous,
  labels = ["Selected period", "Previous period"],
  { seriesName = "Appointments", valueFormatter = formatNumber, revenue = false } = {},
) {
  return {
    animationDuration: 500,
    color: [revenue ? "#b99a45" : "#6f7d66"],
    tooltip: baseTooltip(valueFormatter),
    grid: { left: 8, right: 12, top: 20, bottom: 8, containLabel: true },
    xAxis: { type: "category", data: [labels[1], labels[0]], axisLabel, axisTick: { show: false }, axisLine: { lineStyle: { color: "#ddd3c6" } } },
    yAxis: { type: "value", minInterval: revenue ? undefined : 1, axisLabel, splitLine },
    series: [{ name: seriesName, type: "bar", barMaxWidth: 64, data: [previous, current].map((value) => value == null ? null : Number(value)) }],
  };
}

export { PALETTE };
