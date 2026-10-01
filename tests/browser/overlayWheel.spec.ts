import { expect, test } from "@playwright/test";

// Exercise a touch-capable desktop/tablet with a wheel/trackpad. Playwright's
// mobile WebKit emulation cannot inject mouse-wheel events.
test.use({ isMobile: false });

test("wheel over a selection handle zooms without passive-listener errors", async ({ page }) => {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (/passive event listener|maxLeafSize/.test(message.text())) warnings.push(message.text());
  });
  await page.goto("/?editor=1");
  await page.getByRole("button", { name: "Add shape", exact: true }).tap();
  await page.getByRole("button", { name: "Box", exact: true }).tap();
  const handle = page.locator(".transform-handle.corner").first();
  await expect(handle).toBeVisible();
  const span = () => page.locator(".transform-handle.corner").evaluateAll((nodes) => {
    const xs = nodes.map((node) => node.getBoundingClientRect().x);
    return Math.max(...xs) - Math.min(...xs);
  });
  const before = await span();
  await handle.hover();
  await page.mouse.wheel(0, -120);
  await expect.poll(span).toBeGreaterThan(before + 1);
  expect(warnings).toEqual([]);
});
