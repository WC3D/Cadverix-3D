import { expect, test } from "@playwright/test";
import { MODIFY_TOOL_GROUPS } from "../../apps/web/src/lib/modifyToolGroups";
import { chooseModifyTool } from "./helpers/modifyTools";

test.use({ viewport: { width: 2000, height: 1000 }, hasTouch: false, isMobile: false });
test("four Modify groups retain every tool, icon size and command-search access", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?editor=1");
  await expect(page.locator('[data-tool-group="modify"] > .toolbar-section-tools > .toolbar-tool-menu')).toHaveCount(4);
  await page.getByRole("button", { name: "Print tools", exact: true }).click();
  const printing = page.getByRole("dialog", { name: "Print tools", exact: true });
  for (const name of ["Flexi joints", "Cookie cutter", "Lid"]) await expect(printing.getByRole("button", { name, exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Add shape", exact: true }).click();
  await page.getByRole("button", { name: "Box", exact: true }).click();
  for (const group of MODIFY_TOOL_GROUPS) {
    await page.getByRole("button", { name: `${group.label} tools`, exact: true }).click();
    const menu = page.getByRole("dialog", { name: `${group.label} tools`, exact: true });
    await expect(menu.locator(".modify-tool-option")).toHaveCount(group.tools.length);
    await expect(menu.getByRole("button", { name: `Close ${group.label} tools`, exact: true })).toBeVisible();
    await expect(menu.locator(".shape-menu-title > span")).toHaveText(group.label);
    for (const name of group.tools) await expect(menu.getByRole("button", { name, exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
  }
  const ribbonFits = await page.locator(".toolbar-mode-content.geometry").evaluate((node) => node.scrollWidth <= node.clientWidth);
  expect(ribbonFits).toBe(true);
  await page.getByRole("button", { name: "Mesh tools", exact: true }).click();
  const iconSize = await page.getByRole("dialog", { name: "Mesh tools", exact: true }).getByRole("button", { name: "Surface texture", exact: true }).locator("svg").evaluate((node) => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height }));
  const undoSize = await page.getByRole("button", { name: "Undo", exact: true }).locator(":scope > *").first().evaluate((node) => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height }));
  expect(iconSize.width).toBe(52);
  expect(iconSize.height).toBe(52);
  expect(iconSize.width).toBeGreaterThanOrEqual(undoSize.width);
  expect(iconSize.height).toBeGreaterThanOrEqual(undoSize.height);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Search commands", exact: true }).click();
  const search = page.getByRole("dialog", { name: "Search commands", exact: true });
  await search.getByRole("textbox").fill("Shell / hollow");
  await search.getByRole("button", { name: /Shell \/ hollow/ }).click();
  await expect(page.getByLabel("Shell thickness", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("menus support keyboard navigation, outside dismissal and switching groups", async ({ page }) => {
  await page.goto("/?editor=1");
  await page.getByRole("button", { name: "Add shape", exact: true }).click();
  await page.getByRole("button", { name: "Box", exact: true }).click();
  const trigger = page.getByRole("button", { name: "Transform tools", exact: true });
  await trigger.focus(); await trigger.press("ArrowDown");
  await expect(page.getByRole("button", { name: "Mirror", exact: true })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("button", { name: "3D pattern / array", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  expect(JSON.parse(await page.locator("[data-codex-state]").textContent() ?? "{}").selectedIds).toHaveLength(1);
  await trigger.click();
  await page.getByRole("button", { name: "Shape tools", exact: true }).click();
  await expect(page.locator(".modify-tool-dropdown")).toHaveCount(1);
  await expect(page.getByRole("dialog", { name: "Shape tools", exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Project name", exact: true }).click();
  await expect(page.locator(".modify-tool-dropdown")).toHaveCount(0);
});

test("grouped menus stay within a phone viewport and launch focused tools", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?editor=1");
  await page.getByRole("button", { name: "Add shape", exact: true }).click();
  await page.getByRole("button", { name: "Box", exact: true }).click();
  await page.getByRole("button", { name: "Shape tools", exact: true }).click();
  const menu = page.getByRole("dialog", { name: "Shape tools", exact: true });
  const bounds = (await menu.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
  await chooseModifyTool(page, "Shell / hollow");
  await expect(menu).toHaveCount(0);
  const panel = page.getByRole("complementary", { name: "Shell / hollow", exact: true });
  await expect(panel.getByLabel("Shell thickness", { exact: true })).toBeVisible();
});

test("palette header stays reachable while a short screen scrolls through tools", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 420 });
  await page.goto("/?editor=1");
  await page.getByRole("button", { name: "Shape tools", exact: true }).click();
  const menu = page.getByRole("dialog", { name: "Shape tools", exact: true });
  await menu.getByRole("button", { name: "Modeling tools", exact: true }).scrollIntoViewIfNeeded();
  await expect(menu.getByRole("button", { name: "Close Shape tools", exact: true })).toBeInViewport();
  await menu.getByRole("button", { name: "Close Shape tools", exact: true }).click();
  await expect(menu).toHaveCount(0);
});

for (const layout of [
  { width: 1440, height: 1000, theme: "light", columns: 3 },
  { width: 1440, height: 1000, theme: "sketchforge", columns: 3 },
  { width: 390, height: 844, theme: "sketchforge", columns: 2 },
  { width: 320, height: 740, theme: "light", columns: 1 },
]) test(`tool palette matches Generators at ${layout.width}px in ${layout.theme}`, async ({ page }) => {
  await page.setViewportSize({ width: layout.width, height: layout.height });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.addInitScript(() => {
    const fetch = window.fetch.bind(window);
    window.fetch = (input, init) => /\/api\/(?:cadverix|sketchforge)-mcp/.test(String(input)) ? Promise.resolve(new Response("", { status: 404 })) : fetch(input, init);
  });
  await page.goto("/?editor=1");
  await page.getByRole("combobox", { name: "Quick theme", exact: true }).selectOption(layout.theme);
  await page.getByRole("button", { name: "Add shape", exact: true }).click();
  await page.getByRole("button", { name: "Box", exact: true }).click();
  await page.getByRole("button", { name: "Add generator", exact: true }).click();
  const appearance = (node: HTMLElement) => {
    const style = getComputedStyle(node), header = getComputedStyle(node.querySelector(".shape-menu-title")!);
    const tile = getComputedStyle(node.querySelector(".shape-menu-item")!), grid = getComputedStyle(node.querySelector(".shape-menu-list")!);
    return { background: style.backgroundColor, radius: style.borderRadius, headerSize: header.fontSize, headerWeight: header.fontWeight, headerHeight: header.height, dividerWidth: header.borderBottomWidth, tileSize: tile.fontSize, tileWeight: tile.fontWeight, tileRadius: tile.borderRadius, tileHeight: tile.minHeight, columns: grid.gridTemplateColumns.split(" ").length };
  };
  const generators = page.getByRole("dialog", { name: "Generators", exact: true });
  const reference = await generators.evaluate(appearance);
  await generators.getByRole("button", { name: "Close Generators", exact: true }).click();
  await page.getByRole("button", { name: "Print tools", exact: true }).click();
  const menu = page.getByRole("dialog", { name: "Print tools", exact: true });
  expect(await menu.evaluate(appearance)).toEqual(reference);
  expect(reference.columns).toBe(layout.columns);
  const bounds = (await menu.boundingBox())!;
  expect(bounds.width).toBeCloseTo(Math.min(720, layout.width - 16), 0);
  expect(bounds.x).toBeGreaterThanOrEqual(7);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(layout.width - 7);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(layout.height - 7);
  const close = menu.getByRole("button", { name: "Close Print tools", exact: true });
  await expect(close).toBeInViewport();
  await close.click();
  await expect(menu).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Print tools", exact: true })).toBeFocused();
  expect(errors).toEqual([]);
});
