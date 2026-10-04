import { expect, test } from "@playwright/test";
import catalog from "../../apps/web/src/lib/printerPresets.layerling.json";

test("all upstream printers are offered, fractional/tall volumes persist, and legacy sizes are retained", async ({ page }) => {
  await page.addInitScript(() => {
    const fetch = window.fetch.bind(window);
    window.fetch = (input, init) => /\/api\/(?:cadverix|sketchforge)-mcp/.test(String(input)) ? Promise.resolve(new Response("", { status: 404 })) : fetch(input, init);
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Create new 3D design", exact: true }).click();
  await page.getByRole("button", { name: "Workspace settings", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Workspace settings", exact: true });
  await dialog.getByRole("button", { name: "Workplane", exact: true }).click();
  const picker = page.getByLabel("Printer preset", { exact: true });
  await expect(picker.locator("option")).toHaveCount(200);
  const ids = await picker.locator("option").evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
  for (const printer of catalog.printers) expect(ids).toContain(printer.id);
  await picker.selectOption("snapmaker-u1");
  await expect(page.getByLabel("Printer build height", { exact: true })).toHaveValue("270.05");
  expect(await page.getByLabel("Printer build height", { exact: true }).evaluate((input) => (input as HTMLInputElement).checkValidity())).toBe(true);
  await picker.selectOption("neptune4");
  await expect(page.locator(".printer-status")).toContainText("225 × 225 × 265");
  await picker.selectOption("elegoo-neptune-4");
  await expect(page.locator(".printer-status")).toContainText("230 × 230 × 265");
  await page.setViewportSize({ width: 390, height: 844 });
  const bounds = (await picker.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  await picker.selectOption("raise3d-pro3-plus");
  await dialog.getByRole("button", { name: "Close settings", exact: true }).first().click();
  await expect(page.locator(".printer-status")).toContainText("255 × 300 × 605");
  await page.reload();
  await expect(page.locator(".printer-status")).toContainText("255 × 300 × 605");
});
