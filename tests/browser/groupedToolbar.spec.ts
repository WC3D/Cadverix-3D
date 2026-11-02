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
    await expect(menu.getByRole("button")).toHaveCount(group.tools.length);
    for (const name of group.tools) await expect(menu.getByRole("button", { name, exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
  }
  const ribbonFits = await page.locator(".toolbar-mode-content.geometry").evaluate((node) => node.scrollWidth <= node.clientWidth);
  expect(ribbonFits).toBe(true);
  await page.getByRole("button", { name: "Mesh tools", exact: true }).click();
  const iconSize = await page.getByRole("dialog", { name: "Mesh tools", exact: true }).getByRole("button", { name: "Surface texture", exact: true }).locator("svg").evaluate((node) => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height }));
  const undoSize = await page.getByRole("button", { name: "Undo", exact: true }).locator(":scope > *").first().evaluate((node) => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height }));
  expect(iconSize.width).toBeCloseTo(undoSize.width, 3);
  expect(iconSize.height).toBeCloseTo(undoSize.height, 3);
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
