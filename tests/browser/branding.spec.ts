import { expect, test } from "@playwright/test";
import path from "node:path";

test("Cadverix branding and legacy project loading", async ({ page, browserName }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page).toHaveTitle("Cadverix 3D editor");
  await expect(page.getByRole("link", { name: "Cadverix 3D home", exact: true })).toBeVisible();
  expect(await page.locator("body").innerText()).not.toContain("SketchForge");
  const logo = await page.request.get("/assets/cadverix/cadverix-logo.svg");
  expect(logo.ok()).toBe(true);
  if (process.env.CADVERIX_CAPTURE_BRAND_DOCS && browserName === "chromium") {
    await page.screenshot({ path: path.resolve("docs/media/cadverix-dashboard.png") });
  }
  await page.goto("/?editor=1");
  await expect(page.locator(".cadverix-editor")).toBeVisible();
  expect(await page.locator("body").innerText()).not.toContain("SketchForge");
  await page.getByRole("button", { name: "Add shape", exact: true }).tap();
  await page.getByRole("button", { name: "Box", exact: true }).tap();
  await expect.poll(async () => JSON.parse((await page.locator("[data-codex-state]").textContent())!).shapeCount).toBe(1);
  if (process.env.CADVERIX_CAPTURE_BRAND_DOCS && browserName === "chromium") {
    await page.screenshot({ path: path.resolve("docs/media/cadverix-editor.png") });
  }
  await page.locator('input[type="file"][accept=".skf,.lyl"]').setInputFiles(path.resolve("tests/fixtures/version-1-project.skf"));
  await expect.poll(async () => JSON.parse((await page.locator("[data-codex-state]").textContent())!).notice).toContain("Opened version-1-project.skf");
  await expect(page.locator(".cadverix-editor")).toBeVisible();
  for (const route of ["/api/cadverix-mcp", "/api/sketchforge-mcp"]) {
    const response = await page.request.get(route);
    expect(response.ok()).toBe(true);
    expect(Array.isArray((await response.json()).editors)).toBe(true);
  }
  expect(errors).toEqual([]);
});
