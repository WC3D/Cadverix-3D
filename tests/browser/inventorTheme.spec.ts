import { expect, test, type Locator } from "@playwright/test";
import { chooseModifyTool } from "./helpers/modifyTools";

async function readable(elements: Locator) {
  const failures = await elements.evaluateAll((nodes) => {
    const parse = (css: string) => css.match(/[\d.]+/g)!.map(Number);
    const luminance = (rgb: number[]) => rgb.slice(0, 3).map((x) => { x /= 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }).reduce((sum, x, i) => sum + x * [0.2126, 0.7152, 0.0722][i], 0);
    return nodes.flatMap((node) => {
      const style = getComputedStyle(node);
      if (!(node instanceof HTMLElement) || !node.getClientRects().length || node.closest(":disabled") || style.visibility !== "visible") return [];
      const ancestors: Element[] = [];
      for (let current: Element | null = node; current; current = current.parentElement) ancestors.unshift(current);
      let background = [255, 255, 255];
      for (const ancestor of ancestors) {
        const paint = parse(getComputedStyle(ancestor).backgroundColor), alpha = paint[3] ?? 1;
        background = background.map((value, i) => value * (1 - alpha) + paint[i] * alpha);
      }
      const a = luminance(parse(style.color)), b = luminance(background), ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      return ratio >= 4.5 ? [] : [{ element: node.className, text: node.textContent?.trim().slice(0, 35), foreground: style.color, background, ratio }];
    });
  });
  expect(failures, "Inventor labels and controls must have at least 4.5:1 contrast").toEqual([]);
}

test.use({ viewport: { width: 1440, height: 1000 }, hasTouch: false, isMobile: false });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const fetch = window.fetch.bind(window);
    window.fetch = (input, init) => /\/api\/(?:cadverix|sketchforge)-mcp/.test(String(input)) ? Promise.resolve(new Response("", { status: 404 })) : fetch(input, init);
  });
});

for (const width of [1440, 390]) test(`Inventor uses readable blue panels and gold accents at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("/?editor=1");
  await page.getByRole("combobox", { name: "Quick theme", exact: true }).selectOption("inventor");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".cadverix-editor")).toHaveAttribute("data-theme-preset", "inventor");
  await page.getByRole("button", { name: "Add generator", exact: true }).click();
  await page.getByRole("button", { name: "Screw", exact: true }).click();
  const inspector = page.locator(".shape-inspector");
  await expect(inspector.locator(".property-card").first()).toHaveCSS("background-color", "rgb(34, 57, 82)");
  await expect(inspector.locator(".select-property select").first()).toHaveCSS("background-color", "rgb(27, 41, 61)");
  await expect(page.getByRole("tab", { name: "Geometry", exact: true })).toHaveCSS("border-bottom-color", "rgb(243, 199, 70)");
  await readable(inspector.locator(".property-card-header, .range-property-name, .range-value-unit, .range-value-control input, .select-property, .select-property select, .shape-state-card button"));
  await readable(page.locator(".toolbar-project-name-field input, .toolbar-workspace-tabs button, .camera-controls button, .action-icon-button"));
  await readable(page.locator(".scene-sidebar-actions button, .scene-sidebar-header > div > span, .scene-feature-section-label, .scene-shape-row.selected .scene-shape-copy small"));
  await expect(page.locator(".dimension-line").first()).toHaveCSS("stroke", "rgb(27, 41, 61)");
  await inspector.locator(".property-card-header").first().hover();
  await readable(inspector.locator(".property-card-header").first());
  await inspector.locator(".shape-state-card button:not(.active)").hover();
  await readable(inspector.locator(".shape-state-card button"));
  await chooseModifyTool(page, "Shell / hollow");
  await readable(page.getByRole("complementary", { name: "Shell / hollow", exact: true }).locator("label, button, p"));
  expect(errors).toEqual([]);
});

test("switching away from Inventor restores light controls without changing the model", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Create new 3D design", exact: true }).click();
  await page.getByRole("combobox", { name: "Quick theme", exact: true }).selectOption("inventor");
  await page.getByRole("button", { name: "Add shape", exact: true }).click();
  await page.getByRole("button", { name: "Box", exact: true }).click();
  const scene = () => page.locator("[data-codex-state]").textContent().then((text) => JSON.parse(text ?? "{}").shapes);
  const before = await scene();
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Quick theme", exact: true })).toHaveValue("inventor");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("treeitem").filter({ hasText: "Box" }).first().click();
  await page.getByRole("combobox", { name: "Quick theme", exact: true }).selectOption("light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator(".cadverix-editor")).toHaveAttribute("data-theme-preset", "light");
  await expect(page.locator(".property-card").first()).toHaveCSS("background-color", "rgba(255, 255, 255, 0.98)");
  expect(await scene()).toEqual(before);
});
