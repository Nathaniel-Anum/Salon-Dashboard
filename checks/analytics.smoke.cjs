// Start Vite and open it with playwright-cli, then:
// playwright-cli run-code --filename=checks/analytics.smoke.cjs
async (page) => {
  page.setDefaultTimeout(10000);
  const requests = [];
  const errors = [];
  let failRevenue = false;
  page.on("pageerror", (error) => errors.push(error.message));
  const period = (values, date_from = "2026-09-21", date_to = "2026-09-25") => ({ date_from, date_to, ...values });
  const revenue = (booking_revenue, commerce_revenue) => ({ booking_revenue, commerce_revenue });
  const bookings = (completed, noShow, rescheduled, arrived) => ({ appointments_completed: completed, appointments_no_show: noShow, appointments_rescheduled: rescheduled, appointments_arrived: arrived });
  await page.unroute("**/api/portal/v1/**");
  await page.route("**/api/portal/v1/**", async (route) => {
    const [pathname, search = ""] = route.request().url().replace(/^https?:\/\/[^/]+/, "").split("?");
    const url = { pathname, params: Object.fromEntries(search.split("&").filter(Boolean).map((entry) => entry.split("=").map(decodeURIComponent))) };
    requests.push(url);
    const isRevenue = url.pathname.endsWith("/analytics/revenue/");
    const isBookings = url.pathname.endsWith("/analytics/bookings/");
    if (isRevenue && failRevenue) return route.fulfill({ status: 503, json: { detail: "Unavailable" } });
    if (isRevenue || isBookings) {
      const current = isRevenue ? revenue("2500.00", "900.00") : bookings(45, 5, 8, 52);
      const previous = isRevenue ? revenue("2000.00", "1000.00") : bookings(40, 8, 6, 47);
      const changes = Object.fromEntries(Object.keys(current).map((key) => [key, {
        current: current[key], previous: previous[key], absolute_change: Number(current[key]) - Number(previous[key]),
        percentage_change: ((Number(current[key]) / Number(previous[key]) - 1) * 100).toFixed(2), reason: null,
      }]));
      return route.fulfill({ json: {
        today: period(isRevenue ? revenue("500.00", "250.00") : bookings(12, 2, 3, 15), "2026-09-25"),
        week_comparison: { current_week: period(current), previous_week: period(previous, "2026-09-14", "2026-09-18"), changes },
        last_30_days: period(isRevenue ? revenue("12000.00", "4500.00") : bookings(190, 18, 29, 220), "2026-08-27"),
        last_90_days: period(isRevenue ? revenue("36000.00", "14000.00") : bookings(570, 48, 76, 640), "2026-06-28"),
        custom_period: period(isRevenue ? revenue("11000.00", "4200.00") : bookings(180, 16, 24, 205), url.params.date_from || "2026-08-27", url.params.date_to || "2026-09-25"),
      } });
    }
    if (url.pathname.endsWith("/money-received/")) return route.fulfill({ json: {
      summary: { currencies: [{ currency: "GHS", paystack_received_amount: "2400.00", paystack_received_transaction_count: 18, paystack_reversed_amount: "100.00", paystack_received_after_reversals_amount: "2300.00", on_site_received_amount: "1000.00", on_site_received_transaction_count: 9, on_site_reversed_amount: "50.00", on_site_received_after_reversals_amount: "950.00", other_received_amount: "0.00", other_received_transaction_count: 0 }], period: period({}, "2026-09-21", "2026-09-26") },
      comparison: { currencies: [{ currency: "GHS", paystack_received_amount: { current: "2400.00", previous: "2000.00", percentage_change: "20.00", reason: null }, on_site_received_amount: { current: "1000.00", previous: "800.00", percentage_change: "25.00", reason: null }, other_received_amount: { current: "0.00", previous: "0.00", percentage_change: null, reason: "NO_PREVIOUS_BASE" } }] },
      series: { week_comparison: { currencies: [{ currency: "GHS", points: [
        { label: "Mon", position: 1, active_week: { paystack_received_amount: "900.00", on_site_received_amount: "300.00" }, previous_week: { paystack_received_amount: "750.00", on_site_received_amount: "250.00" } },
        { label: "Tue", position: 2, active_week: { paystack_received_amount: "1500.00", on_site_received_amount: "700.00" }, previous_week: { paystack_received_amount: "1250.00", on_site_received_amount: "550.00" } },
      ] }] } },
      breakdowns: {
        by_domain: [{ currency: "GHS", domain: "booking", paystack_received_amount: "1800.00", on_site_received_amount: "750.00", other_received_amount: "0.00" }, { currency: "GHS", domain: "commerce", paystack_received_amount: "600.00", on_site_received_amount: "250.00", other_received_amount: "0.00" }],
        by_source: [{ currency: "GHS", source: "paystack", received_amount: "2400.00", received_transaction_count: 18, payment_methods: [{ payment_method: "mobile_money", payment_method_label: "Mobile money", received_amount: "2400.00" }] }, { currency: "GHS", source: "on_site", received_amount: "1000.00", received_transaction_count: 9, payment_methods: [{ payment_method: "cash", payment_method_label: "Cash", received_amount: "1000.00" }] }],
      },
    } });
    if (url.pathname.endsWith("/appointments-created/")) return route.fulfill({ json: { summary: { appointments_created: 60, period: period({}, "2026-09-21", "2026-09-26") } } });
    return route.fulfill({ json: {} });
  });
  await page.goto(page.url().split("/").slice(0, 3).join("/"));
  await page.getByRole("button", { name: "Sign In", exact: true }).waitFor();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(async () => {
    const dependency = (file) => import(performance.getEntriesByType("resource").find(({ name }) => name.includes(`/node_modules/.vite/deps/${file}?`)).name);
    const { default: React } = await dependency("react.js");
    const { default: { createRoot } } = await dependency("react-dom_client.js");
    const { MemoryRouter } = await dependency("react-router-dom.js");
    const { QueryClient, QueryClientProvider } = await dependency("@tanstack_react-query.js");
    const { default: Dashboard } = await import("/Pages/DashboardPage.jsx");
    const { default: Analytics } = await import("/Pages/AnalyticsPage.jsx");
    document.getElementById("root").style.display = "none";
    const host = document.createElement("div");
    host.style.cssText = "padding:24px;background:#f5efe6;min-height:100vh";
    document.body.append(host);
    const root = createRoot(host);
    const client = new QueryClient();
    window.analyticsSmoke = {
      render: (view) => root.render(React.createElement(QueryClientProvider, { client }, React.createElement(MemoryRouter, null, React.createElement(view === "dashboard" ? Dashboard : Analytics)))),
      clear: () => client.clear(),
    };
    window.analyticsSmoke.render("dashboard");
  });
  await page.locator(".change-pill").filter({ hasText: "25.0% higher than last week" }).waitFor();
  await page.locator(".change-pill").filter({ hasText: "37.5% lower than last week" }).waitFor();
  await page.screenshot({ path: "output/playwright/analytics-dashboard.png", fullPage: true, animations: "disabled" });
  await page.evaluate(() => window.analyticsSmoke.render("analytics"));
  const card = (title) => page.locator(".analytics-metric-card").filter({ has: page.getByText(title, { exact: true }) });
  await card("Arrived appointments").getByText("52", { exact: true }).waitFor();
  if (await page.getByText("Cancelled appointments", { exact: true }).count()) throw new Error("Removed appointment metric still displayed");
  await page.screenshot({ path: "output/playwright/analytics-cards.png", fullPage: true, animations: "disabled" });
  await card("Arrived appointments").click();
  const dialog = page.getByRole("dialog");
  const headline = dialog.locator(".drawer-portfolio > strong");
  const checkHeadline = async (value) => {
    await headline.filter({ hasText: new RegExp(`^${value}$`) }).waitFor();
  };
  for (const [label, value] of [["Today", "15"], ["Previous week", "47"], ["Last 30 days", "220"], ["Last 90 days", "640"], ["This week", "52"]]) {
    await dialog.getByRole("button", { name: label, exact: true }).click();
    await checkHeadline(value);
  }
  if (requests.filter((url) => url.pathname.endsWith("/analytics/bookings/")).length !== 1) throw new Error("Fixed periods fetched redundant or client-defined ranges");
  await dialog.getByRole("button", { name: "Custom", exact: true }).click();
  await dialog.getByLabel("From", { exact: true }).fill("2026-08-01");
  await dialog.getByLabel("To", { exact: true }).fill("2026-08-31");
  await checkHeadline("205");
  await dialog.getByText("2026-08-01 to 2026-08-31", { exact: true }).waitFor();
  await dialog.getByText("Drilldown filters", { exact: true }).click();
  await dialog.getByRole("combobox", { name: "Source", exact: true }).selectOption("portal");
  for (const [label, value] of [["Service ID", "service-1"], ["Staff ID", "staff-2"], ["Product ID", "product-3"], ["Payment channel", "cash"], ["Payment purpose", "deposit"]]) await dialog.getByLabel(label, { exact: true }).fill(value);
  const filteredResponse = page.waitForResponse((response) => response.url().includes("purpose=deposit"));
  await dialog.getByRole("button", { name: "Apply filters", exact: true }).click();
  await filteredResponse;
  const last = requests.filter((url) => url.pathname.endsWith("/analytics/bookings/")).at(-1);
  for (const [key, value] of Object.entries({ date_from: "2026-08-01", date_to: "2026-08-31", source: "portal", service_id: "service-1", staff_id: "staff-2", product_id: "product-3", payment_channel: "cash", purpose: "deposit" })) {
    if (last.params[key] !== value) throw new Error(`Incorrect filter: ${key}`);
  }
  await dialog.getByRole("button", { name: "Today", exact: true }).click();
  await checkHeadline("15");
  const fixed = requests.filter((url) => url.pathname.endsWith("/analytics/bookings/")).at(-1);
  if (fixed.params.date_from || fixed.params.source !== "portal") throw new Error("Custom dates leaked into a fixed period or filters were lost");
  await dialog.getByRole("button", { name: "Custom", exact: true }).click();
  const count = requests.length;
  await dialog.getByLabel("From", { exact: true }).fill("");
  await dialog.getByRole("alert").filter({ hasText: "Choose a valid start and end date" }).waitFor();
  if (requests.length !== count) throw new Error("Invalid dates sent a request");
  await dialog.getByLabel("From", { exact: true }).fill("2026-08-01");
  await checkHeadline("205");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "output/playwright/analytics-mobile-drawer.png", fullPage: true, animations: "disabled" });
  if (await dialog.evaluate((el) => el.scrollWidth > el.clientWidth)) throw new Error("Mobile drawer overflows");
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  await card("Commerce revenue").click();
  await checkHeadline("GH₵900.00");
  await dialog.getByRole("button", { name: "Today", exact: true }).click();
  await checkHeadline("GH₵250.00");
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  failRevenue = true;
  await page.getByRole("button", { name: "Refresh data", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Revenue is unavailable" }).waitFor();
  await card("Booking revenue").click();
  await dialog.getByRole("alert").waitFor();
  failRevenue = false;
  await dialog.getByRole("button", { name: "Retry", exact: true }).click();
  await checkHeadline("GH₵2,500.00");
  if (errors.length) throw new Error(errors.join("\n"));
  return "PASS: dashboard/cards, six server periods, inclusive custom dates, all eight filters, invalid dates, mobile drawer, separate revenue and error/retry";
}
