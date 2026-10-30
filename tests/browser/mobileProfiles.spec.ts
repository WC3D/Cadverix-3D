import { expect, test } from "@playwright/test";

test("closed profile fills show the grid and inner regions can be deselected by touch", async ({ page }) => {
  await page.goto("/?editor=1");
  await page.getByRole("tab", { name: "Sketch", exact: true }).tap();
  await page.getByRole("button", { name: "Sketch to 3D options" }).tap();
  await page.getByRole("menuitem", { name: /^Extrude sketch/ }).tap();
  await page.getByRole("button", { name: "XZ · Top", exact: true }).tap();
  await expect(page.locator(".sketch-plate")).toBeVisible();
  await page.getByRole("button", { name: "Corner Rectangle", exact: true }).tap();
  await page.touchscreen.tap(550, 400);
  await page.touchscreen.tap(900, 800);
  await page.getByRole("button", { name: "Corner Rectangle", exact: true }).tap();
  await page.touchscreen.tap(650, 500);
  await page.touchscreen.tap(800, 650);
  await page.getByRole("button", { name: "Select", exact: true }).tap();
  const profiles = page.locator(".sketch-profile-fills path.selectable");
  await expect(profiles).toHaveCount(2);
  await page.locator(".sketch-profile-selection-status").getByRole("button", { name: "All", exact: true }).tap();
  await expect(page.locator('.sketch-profile-fills [aria-pressed="true"]')).toHaveCount(2);
  const dragFills = await page.locator(".sketch-profile-hit-targets path").evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).fill));
  expect(dragFills).toEqual(["none", "none"]);
  for (const fill of await profiles.evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).fill))) {
    expect(fill).toMatch(/^rgba\(/);
    expect(Number(fill.split(",").at(-1)!.replace(")", ""))).toBeLessThanOrEqual(0.46);
  }
  // Check the actual hit target before tapping: a transparent overlay must not
  // intercept the inner profile, nor should this accidentally toggle the outer.
  const hit = await page.evaluate(() => {
    const node = document.elementFromPoint(700, 550);
    return { selectable: node?.matches(".sketch-profile-fills path.selectable"), label: node?.getAttribute("aria-label") };
  });
  expect(hit.selectable).toBe(true);
  await page.touchscreen.tap(700, 550);
  await expect(page.locator('.sketch-profile-fills [aria-pressed="true"]')).toHaveCount(1);
  await expect(page.locator(".sketch-profile-selection-status")).toContainText("1 of 2");
  await page.touchscreen.tap(700, 550);
  await expect(page.locator('.sketch-profile-fills [aria-pressed="true"]')).toHaveCount(2);
});
