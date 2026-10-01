import { expect, test } from "@playwright/test";

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
    window.fetch = (input, init) => String(input).includes("/api/sketchforge-mcp")
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
