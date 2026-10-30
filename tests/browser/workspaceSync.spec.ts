import { expect, test } from "@playwright/test";

test("a dashboard with a saved angled face plane settles instead of repeatedly saving", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const plane = {
      origin: { x: 0, y: 0, z: 10 }, normal: { x: 0, y: 0, z: 1 },
      xAxis: { x: 0.9527478871072962, y: -0.3037621826570634, z: 0 },
      zAxis: { x: -0.30376218265706334, y: -0.952747887107296, z: 0 },
    };
    const key = "sketchForge.projects";
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify([{
      id: "angled-plane-project", name: "Angled plane", createdAt: 1, updatedAt: 1, revision: 1,
      shapes: 0, placementWorkplane: plane, sketchPlacementWorkplane: plane,
    }]));
    const probe = { writes: 0, ticks: 0 };
    (window as Window & { dashboardProbe?: typeof probe }).dashboardProbe = probe;
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "sketchForge.projects") probe.writes++;
      return setItem.call(this, key, value);
    };
    setInterval(() => probe.ticks++, 50);
  });
  for (let load = 0; load < 2; load++) {
    await page.goto("/");
    await expect(page.locator(".project-card")).toHaveCount(1);
    await page.waitForFunction(() => {
      const probe = (window as Window & { dashboardProbe?: { writes: number; ticks: number } }).dashboardProbe!;
      return probe.ticks >= 40 || probe.writes >= 20;
    });
    const probe = await page.evaluate(() => (window as Window & { dashboardProbe?: { writes: number; ticks: number } }).dashboardProbe!);
    expect(probe.writes).toBeLessThanOrEqual(3);
    expect(probe.ticks).toBeGreaterThanOrEqual(40);
    await expect(page.locator("[data-codex-state]")).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test("workspace theme and snap changes settle without an update loop", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (/maximum update depth|too many re-renders|cannot update a component/i.test(message.text())) errors.push(message.text());
  });
  await page.addInitScript(() => {
    // Settings do not use the dev-only MCP bridge. Keep its requests local so
    // WebKit reload cancellation cannot surface an unrelated network error.
    const fetch = window.fetch.bind(window);
    window.fetch = (input, init) => /\/api\/(?:cadverix|sketchforge)-mcp/.test(String(input))
      ? Promise.resolve(new Response("", { status: 404 }))
      : fetch(input, init);
    const key = "sketchForge.workspaceDefault.local-workplane";
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ workspace: { themeId: "light", width: 250, depth: 200 }, snap: "5.0 mm" }));
  });
  await page.goto("/?editor=1");
  await expect(page.locator(".snap-select").first()).toContainText("5.0 mm");
  await page.getByRole("button", { name: "Workspace settings", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Workspace settings", exact: true });
  const theme = dialog.locator(".workspace-row").filter({ hasText: "Theme preset" }).locator("select");
  for (const value of ["sketchforge", "light", "sketchforge"]) {
    await theme.selectOption(value);
    await expect(theme).toHaveValue(value);
    await page.waitForTimeout(250);
    expect(errors).toEqual([]);
  }
  await dialog.getByRole("button", { name: "Close settings", exact: true }).first().click();
  await page.locator(".snap-select").first().click();
  await page.locator(".snap-menu").getByRole("button", { name: "0.25 mm", exact: true }).click();
  await expect(page.locator(".snap-select").first()).toContainText("0.25 mm");
  await page.getByRole("button", { name: "Add shape", exact: true }).click();
  await page.getByRole("button", { name: "Box", exact: true }).click();
  await expect(page.locator(".snap-select").first()).toContainText("0.25 mm");
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
  await page.getByRole("button", { name: "Workspace settings", exact: true }).click();
  await dialog.getByRole("button", { name: "Make default", exact: true }).click();
  await page.reload();
  await expect(page.locator(".snap-select").first()).toContainText("0.25 mm");
  expect(errors).toEqual([]);
});
