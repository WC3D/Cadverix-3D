import { expect, test, type Locator } from "@playwright/test";

async function exposedCenter(locator: Locator) {
  return locator.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const x = rect.x + rect.width / 2;
    const y = rect.y + rect.height / 2;
    return { x, y, exposed: node.contains(document.elementFromPoint(x, y)) };
  });
}

for (const [width, height] of [[390, 844], [820, 1180], [1024, 768], [1366, 1024]]) {
  test.describe(`${width}×${height} touch layout`, () => {
    test.use({ viewport: { width, height } });
    test("keeps tabs, dropdown choices and touch controls visible and operable", async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto("/?editor=1");
      await expect(page.locator(".touch-controls")).toBeVisible();
      const ribbon = await page.locator(".toolbar-mode-content").boundingBox();
      const tabs = await page.getByRole("tab").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().bottom));
      expect(tabs.every((bottom) => bottom <= ribbon!.y + 0.5)).toBe(true);

      // Center hit tests alone miss artwork clipped at the ribbon's bottom.
      // Check all icons, including horizontally off-screen Shapes/Manage tools.
      const clippedTools = await page.locator(".toolbar-mode-content").evaluate((ribbon) => {
        const bounds = ribbon.getBoundingClientRect();
        return Array.from(ribbon.querySelectorAll(".toolbar-icon, .shape-menu-trigger, .action-buttons button"))
          .filter((button) => [button, ...button.children].some((element) => {
            const rect = element.getBoundingClientRect();
            return rect.height > 0 && (rect.top < bounds.top - 0.5 || rect.bottom > bounds.bottom + 0.5);
          }))
          .map((button) => button.getAttribute("aria-label") ?? button.textContent);
      });
      expect(clippedTools).toEqual([]);

      await page.getByRole("button", { name: "Add shape", exact: true }).tap();
      const box = await exposedCenter(page.getByRole("button", { name: "Box", exact: true }));
      expect(box.exposed).toBe(true);
      // A locator tap auto-scrolls clipped content into view and can conceal the
      // regression. Test hit visibility first, then tap the actual screen point.
      await page.touchscreen.tap(box.x, box.y);
      await expect.poll(async () => JSON.parse((await page.locator("[data-codex-state]").textContent())!).shapeCount).toBe(1);

      await page.getByRole("button", { name: "Visibility options", exact: true }).tap();
      expect((await exposedCenter(page.getByRole("menu", { name: "Visibility options" }))).exposed).toBe(true);

      await page.getByRole("tab", { name: "Sketch", exact: true }).tap();
      await page.getByRole("button", { name: "Sketch to 3D options" }).tap();
      const extrude = await exposedCenter(page.getByRole("menuitem", { name: /^Extrude sketch/ }));
      expect(extrude.exposed).toBe(true);
      await page.touchscreen.tap(extrude.x, extrude.y);
      await page.getByRole("button", { name: "XZ · Top", exact: true }).tap();
      await expect(page.locator(".sketch-plate")).toBeVisible();
      await page.getByRole("button", { name: "Add sketch shape", exact: true }).tap();
      const rectangle = await exposedCenter(page.getByRole("menuitem", { name: "Rectangle", exact: true }));
      expect(rectangle.exposed).toBe(true);
      await page.touchscreen.tap(rectangle.x, rectangle.y);
      await expect(page.locator(".sketch-points circle")).toHaveCount(4);
      const controls = await page.locator(".touch-controls").boundingBox();
      expect(controls!.y + controls!.height).toBeLessThanOrEqual(height);
      expect(errors).toEqual([]);
    });
  });
}
