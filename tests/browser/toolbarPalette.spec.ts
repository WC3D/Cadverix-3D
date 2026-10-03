import { expect, test } from "@playwright/test";
import path from "node:path";

const layouts = [
  { width: 1440, height: 1000, touch: false, dark: false, columns: 3 },
  { width: 1440, height: 1000, touch: false, dark: true, columns: 3 },
  { width: 820, height: 1180, touch: true, dark: true, columns: 3 },
  { width: 390, height: 844, touch: true, dark: false, columns: 2 },
  { width: 320, height: 740, touch: true, dark: true, columns: 1 },
];

for (const layout of layouts) test.describe(`shape palette ${layout.width}px ${layout.dark ? "dark" : "light"}`, () => {
  test.use({ viewport: { width: layout.width, height: layout.height }, hasTouch: layout.touch, isMobile: layout.touch });
  test("shows colored groups and a usable viewport-contained grid", async ({ page, browserName }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/?editor=1");
    if (layout.dark) {
      await page.getByRole("button", { name: "Workspace settings", exact: true }).click();
      const settings = page.getByRole("dialog", { name: "Workspace settings", exact: true });
      await settings.locator(".workspace-row").filter({ hasText: "Theme preset" }).locator("select").selectOption("sketchforge");
      await settings.getByRole("button", { name: "Close settings", exact: true }).first().click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    }
    const colors = await page.locator(".toolbar-mode-content.geometry [data-tool-group]").evaluateAll((sections) => sections.map((section) => {
      const row = section.querySelector(":scope > .toolbar-section-tools, :scope > .action-buttons")!;
      const style = getComputedStyle(row);
      return { color: style.borderTopColor, width: style.borderTopWidth, radius: style.borderTopLeftRadius };
    }));
    expect(colors).toHaveLength(10);
    expect(new Set(colors.map((group) => group.color)).size).toBe(10);
    expect(colors.every((group) => group.width === "2px" && group.radius === "10px")).toBe(true);

    await page.getByRole("button", { name: "Add shape", exact: true }).click();
    const palette = page.getByRole("dialog", { name: "Shapes", exact: true });
    await expect(palette).toBeVisible();
    const bounds = (await palette.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(7);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(layout.width - 7);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(layout.height - 7);
    expect(bounds.width).toBeCloseTo(Math.min(900, layout.width - 16), 0);
    expect(await palette.locator(".shape-menu-list").evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(" ").length)).toBe(layout.columns);
    const shapeNames = (await palette.locator(".shape-menu-item").allTextContents()).map((name) => name.trim());
    expect(shapeNames.length).toBeGreaterThan(15);
    for (const name of ["Gear", "Screw", "Washer", "Nut", "Spring", "Honeycomb", "Bent Tube"]) {
      expect(shapeNames).not.toContain(name);
    }
    const first = await palette.getByRole("button", { name: "Box", exact: true }).evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return node.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
    });
    expect(first).toBe(true);
    if (process.env.CADVERIX_CAPTURE_TOOLBAR_DOCS && browserName === "chromium" && layout.width === 1440 && layout.dark) {
      await page.screenshot({ path: path.resolve("docs/media/cadverix-shapes-menu.png") });
    }
    await palette.getByRole("button", { name: "Tube", exact: true }).scrollIntoViewIfNeeded();
    await expect(palette.getByRole("button", { name: "Close Shapes", exact: true })).toBeInViewport();
    await palette.getByRole("button", { name: "Tube", exact: true }).click();
    await expect(palette).toHaveCount(0);
    await expect.poll(async () => JSON.parse((await page.locator("[data-codex-state]").textContent())!).shapes[0]?.kind).toBe("tube");
    await page.getByRole("button", { name: "Add shape", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(palette).toHaveCount(0);
    await page.getByRole("button", { name: "Add generator", exact: true }).click();
    const generators = page.getByRole("dialog", { name: "Generators", exact: true });
    await expect(generators).toBeVisible();
    const generatorNames = (await generators.locator(".shape-menu-item").allTextContents()).map((name) => name.trim());
    expect(generatorNames).toEqual(expect.arrayContaining(["Gear", "Screw", "Washer", "Nut", "Spring", "Honeycomb", "Bent Tube"]));
    expect(generatorNames.every((name) => !shapeNames.includes(name))).toBe(true);
    await page.getByRole("button", { name: "Close Generators", exact: true }).click();
    await page.getByRole("button", { name: "Add generator", exact: true }).click();
    await generators.getByRole("button", { name: "Honeycomb", exact: true }).click();
    await expect.poll(async () => JSON.parse((await page.locator("[data-codex-state]").textContent())!).shapes[1]?.kind).toBe("honeycomb");
    expect(errors).toEqual([]);
  });
});
