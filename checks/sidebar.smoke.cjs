// Start Vite, then playwright-cli open http://127.0.0.1:5175 and
// playwright-cli run-code --filename=checks/sidebar.smoke.cjs
async (page) => {
  const origin = page.url().split("/").slice(0, 3).join("/");
  async function mountPreview(page) {
  page.setDefaultTimeout(10000);
  await page.goto(origin + "/");
  await page.getByRole("button", { name: "Sign In", exact: true }).waitFor();
  await page.evaluate(async () => {
    const dependency = (file) => import(performance.getEntriesByType("resource")
      .find(({ name }) => name.includes(`/node_modules/.vite/deps/${file}?`)).name);
    const { default: React } = await dependency("react.js");
    const { default: { createRoot } } = await dependency("react-dom_client.js");
    const { MemoryRouter, useLocation } = await dependency("react-router-dom.js");
    const { QueryClient, QueryClientProvider } = await dependency("@tanstack_react-query.js");
    const { default: Sidebar } = await import("/Pages/Sidebar.jsx");
    const { Header } = await import("/Pages/Header.jsx");
    const { NotificationsProvider } = await import("/src/context/NotificationsContext.jsx");
    document.getElementById("root").style.display = "none";
    const host = document.createElement("div");
    document.body.append(host);
    function Preview() {
      const { pathname } = useLocation();
      return React.createElement("div", { style: { display: "flex", height: "100dvh", overflow: "hidden", background: "#F5EFE6" } },
        React.createElement(Sidebar),
        React.createElement("div", { style: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column" } },
          React.createElement(Header),
          React.createElement("main", { style: { padding: "16px", flex: 1, overflow: "auto" } },
          React.createElement("h1", null, "Sidebar browser check"),
          React.createElement("output", { id: "current-route" }, pathname))));
    }
    createRoot(host).render(React.createElement(QueryClientProvider, { client: new QueryClient() },
      React.createElement(MemoryRouter, null,
        React.createElement(NotificationsProvider, null, React.createElement(Preview)))));
  });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await mountPreview(page);
  const sidebar = page.getByRole("complementary", { name: "Sidebar", exact: true });
  await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
  await page.waitForFunction(() => document.querySelector('aside[aria-label="Sidebar"]').getBoundingClientRect().width === 64);
  await sidebar.getByRole("menuitem", { name: "Dashboard", exact: true }).hover();
  await page.getByRole("tooltip", { name: "Dashboard", exact: true }).waitFor();

  for (const [group, child, path, count] of [
    ["Commerce", "Products", "/commerce/products", 4],
    ["User Management", "Clients", "/clients", 3],
    ["Settings", "Campaigns", "/settings/campaigns", 3],
  ]) {
    await sidebar.getByRole("menuitem", { name: group, exact: true }).hover();
    const popup = page.locator(".sidebar-flyout:visible");
    await popup.getByRole("link", { name: child, exact: true }).waitFor();
    if (await popup.getByRole("link").count() !== count) throw new Error(`Missing ${group} children`);
    await popup.getByRole("link", { name: child, exact: true }).hover();
    // The menu must remain open after crossing from the icon into the popup.
    await page.waitForTimeout(400);
    await popup.getByRole("link", { name: child, exact: true }).click();
    await page.waitForFunction((expected) => document.getElementById("current-route").textContent === expected, path);
    await popup.waitFor({ state: "hidden" });
    if (await sidebar.boundingBox().then((box) => box.width) !== 64) throw new Error("Selecting a child expanded the sidebar");
  }

  const commerce = sidebar.getByRole("menuitem", { name: "Commerce", exact: true });
  await page.mouse.move(800, 100);
  await commerce.focus();
  await page.keyboard.press("ArrowRight");
  const categories = page.locator(".sidebar-flyout:visible").getByRole("link", { name: "Categories", exact: true });
  await categories.waitFor();
  await page.waitForFunction(() => document.activeElement?.textContent === "Categories");
  await page.keyboard.press("Escape");
  await page.locator(".sidebar-flyout:visible").waitFor({ state: "hidden" });
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(() => document.activeElement?.textContent === "Categories");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.getElementById("current-route").textContent === "/commerce/categories");

  await page.getByRole("button", { name: "Expand sidebar", exact: true }).click();
  await sidebar.getByRole("link", { name: "Categories", exact: true }).waitFor();
  await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
  await commerce.hover();
  await page.locator(".sidebar-flyout:visible").getByRole("link", { name: "Products", exact: true }).waitFor();
  await page.screenshot({ path: "output/playwright/sidebar-flyout.png", animations: "disabled" });
  await page.mouse.move(800, 100);
  await page.locator(".sidebar-flyout:visible").waitFor({ state: "hidden" });
  await page.setViewportSize({ width: 1280, height: 480 });
  await sidebar.getByRole("menuitem", { name: "Settings", exact: true }).hover();
  await page.locator(".sidebar-flyout:visible").getByRole("link", { name: "Support", exact: true }).waitFor();
  const popupBox = await page.locator(".sidebar-flyout:visible").boundingBox();
  if (popupBox.y < 0 || popupBox.y + popupBox.height > 480) throw new Error("Flyout exceeds the viewport");

  await page.mouse.move(800, 100);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  const mobile = page.getByRole("dialog", { name: "Navigation", exact: true });
  const mobileCommerce = mobile.getByRole("menuitem", { name: "Commerce", exact: true });
  if (await mobileCommerce.getAttribute("aria-expanded") !== "true") await mobileCommerce.click();
  await mobile.getByRole("link", { name: "Orders", exact: true }).click();
  await page.waitForFunction(() => document.getElementById("current-route").textContent === "/commerce/orders");
  if (await page.getByRole("button", { name: "Open navigation", exact: true }).getAttribute("aria-expanded") !== "false") {
    throw new Error("Mobile navigation did not close after selection");
  }
  await mobile.waitFor({ state: "hidden" });

  for (const [width, height] of [[320, 568], [390, 844], [667, 375], [767, 600], [768, 1024], [820, 1180], [1024, 768], [1180, 820], [1199, 800], [1200, 800], [1920, 1080]]) {
    await page.setViewportSize({ width, height });
    if (width < 1200) {
      await page.getByRole("button", { name: "Open navigation", exact: true }).waitFor();
    } else {
      await page.getByRole("button", { name: "Expand sidebar", exact: true }).waitFor();
    }
    if (width >= 768 && await sidebar.boundingBox().then((box) => box.width) !== 64) {
      throw new Error(`Rail width is incorrect at ${width}x${height}`);
    }
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) {
      throw new Error(`Horizontal overflow at ${width}x${height}`);
    }
    if (width < 768) {
      const toggle = await page.getByRole("button", { name: "Open navigation", exact: true }).boundingBox();
      const title = await page.locator(".portal-header h1").boundingBox();
      if (toggle.x + toggle.width > title.x) throw new Error("Navigation button overlaps the page title");
    }
    if (width < 1200) {
      await page.getByRole("button", { name: "Open navigation", exact: true }).click();
      await mobile.waitFor();
      const box = await mobile.boundingBox();
      if (box.width > width || box.height > height) throw new Error("Drawer exceeds the viewport");
      await mobile.getByRole("button", { name: "Logout", exact: true }).focus();
      await page.keyboard.press("Tab");
      if (!await page.evaluate(() => Boolean(document.activeElement.closest(".sidebar-drawer")))) {
        throw new Error("Keyboard focus escaped the drawer");
      }
      if (width === 320 || width === 820) await page.screenshot({ path: `output/playwright/sidebar-${width}.png`, animations: "disabled" });
      await page.keyboard.press("Escape");
      await mobile.waitFor({ state: "hidden" });
      if (!await page.getByRole("button", { name: "Open navigation", exact: true }).evaluate((el) => el === document.activeElement)) {
        throw new Error("Closing the drawer did not restore focus");
      }
    }
  }

  // Real touch events also cover large tablets that share desktop viewport widths.
  const touchContext = await page.context().browser().newContext({ hasTouch: true, isMobile: true, viewport: { width: 820, height: 1180 } });
  try {
    const touch = await touchContext.newPage();
    await mountPreview(touch);
    for (const [width, height] of [[820, 1180], [1180, 820], [1366, 1024]]) {
      await touch.setViewportSize({ width, height });
      if (width >= 1200) await touch.getByRole("button", { name: "Collapse sidebar", exact: true }).tap();
      const rail = touch.getByRole("complementary", { name: "Sidebar", exact: true });
      await rail.getByRole("menuitem", { name: "Commerce", exact: true }).tap();
      const popup = touch.locator(".sidebar-flyout:visible");
      await popup.getByRole("link", { name: "Orders", exact: true }).tap();
      await touch.waitForFunction(() => document.getElementById("current-route").textContent === "/commerce/orders");
      await popup.waitFor({ state: "hidden" });
      if (await rail.boundingBox().then((box) => box.width) !== 64) throw new Error("Touch navigation expanded the rail");
    }
    await touch.setViewportSize({ width: 390, height: 844 });
    await touch.getByRole("button", { name: "Open navigation", exact: true }).tap();
    await touch.getByRole("dialog", { name: "Navigation", exact: true }).waitFor();
    await touch.setViewportSize({ width: 1366, height: 1024 });
    await touch.getByRole("dialog", { name: "Navigation", exact: true }).waitFor({ state: "hidden" });
    await touch.setViewportSize({ width: 390, height: 844 });
    if (await touch.getByRole("button", { name: "Open navigation", exact: true }).getAttribute("aria-expanded") !== "false") {
      throw new Error("Drawer reopened after crossing the desktop breakpoint");
    }
  } finally {
    await touchContext.close();
  }
  return "PASS: hover, keyboard, phone/tablet/desktop sizing, drawer focus, landscape, rotation and touch flyouts";
}
