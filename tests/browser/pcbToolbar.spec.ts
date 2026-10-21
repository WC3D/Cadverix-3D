import { expect, test } from "@playwright/test";

for (const width of [1440, 390]) for (const dark of [false, true]) {
  test(`PCB uses the shared toolbar at ${width}px in ${dark ? "dark" : "light"} mode`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/?editor=1");
    await page.getByRole("button", { name: "Workspace settings", exact: true }).click();
    const settings = page.getByRole("dialog", { name: "Workspace settings", exact: true });
    await settings.locator(".workspace-row").filter({ hasText: "Theme preset" }).locator("select").selectOption(dark ? "sketchforge" : "light");
    await settings.getByRole("button", { name: "Close settings", exact: true }).first().click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", dark ? "dark" : "light");
    const geometryHeight = (await page.locator(".secondary-toolbar").boundingBox())!.height;
    await page.getByRole("tab", { name: "PCB", exact: true }).click();
    await expect(page.getByLabel("PCB toolbar", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Create first PCB board", exact: true }).click();
    const toolbar = page.locator(".toolbar-mode-content.pcb");
    await expect(toolbar.getByRole("button", { name: "Add Part", exact: true })).toBeAttached();
    expect((await page.locator(".secondary-toolbar").boundingBox())!.height).toBe(geometryHeight);
    await expect(page.locator(".pcb-editor-host .editor-ribbon")).toHaveCount(0);
    await expect(toolbar.locator('[data-tool-group="history"]')).toHaveCount(1);
    const groups = await toolbar.locator("[data-tool-group] > .toolbar-section-tools").evaluateAll((rows) => rows.map((row) => {
      const style = getComputedStyle(row);
      return { border: style.borderTopWidth, radius: style.borderTopLeftRadius };
    }));
    expect(groups.length).toBeGreaterThan(8);
    expect(groups.every((group) => group.border === "2px" && group.radius === "10px")).toBe(true);
    expect(await page.locator(".pcb-toolbar").evaluate((node) => getComputedStyle(node).getPropertyValue("--panel").trim()))
      .toBe(await page.locator("html").evaluate((node) => getComputedStyle(node).getPropertyValue("--panel").trim()));
    await toolbar.getByRole("button", { name: "Board", exact: true }).click();
    await expect(toolbar.getByRole("button", { name: "Board", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(toolbar.getByRole("button", { name: "Draw Board", exact: true })).toBeAttached();
    await toolbar.getByRole("button", { name: "Circuit", exact: true }).click();
    await toolbar.getByRole("button", { name: "Add Part", exact: true }).click();
    const library = page.getByRole("complementary", { name: "Component library", exact: true });
    await expect(library).toBeVisible();
    const libraryBounds = (await library.boundingBox())!;
    expect(libraryBounds.x).toBeGreaterThanOrEqual(0);
    expect(libraryBounds.x + libraryBounds.width).toBeLessThanOrEqual(width);
    await page.getByRole("button", { name: "Close component library", exact: true }).click();
    await toolbar.getByRole("button", { name: "Manage boards / exports", exact: true }).click();
    const manager = page.getByRole("complementary", { name: "PCB board management", exact: true });
    await expect(manager).toBeVisible();
    const bounds = (await manager.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    await page.getByRole("button", { name: "Close board manager", exact: true }).click();
    await page.getByRole("tab", { name: "Geometry", exact: true }).click();
    await expect(page.locator(".pcb-toolbar")).toHaveCount(0);
    await page.getByRole("tab", { name: "PCB", exact: true }).click();
    await expect(page.locator(".pcb-toolbar")).toHaveCount(1);
    await expect(page.locator(".pcb-circuit-tools-host .editor-ribbon")).toHaveCount(1);
    expect(errors).toEqual([]);
  });
}
