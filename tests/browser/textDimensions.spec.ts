import { expect, test, type Page } from "@playwright/test";

function propertyInput(page: Page, label: string) {
  return page.locator(".shape-inspector .range-property")
    .filter({ has: page.locator(".range-property-name", { hasText: new RegExp(`^${label}$`) }) })
    .locator('input[type="text"]');
}

function savedRevision(page: Page) {
  return page.evaluate(() => {
    const id = new URL(location.href).searchParams.get("project");
    return JSON.parse(localStorage.getItem("sketchForge.projects") ?? "[]")
      .find((project: { id: string }) => project.id === id)?.revision ?? 0;
  });
}

test("rotated text has independent letter height and extrusion depth", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const original = window.fetch.bind(window);
    window.fetch = (input, init) => /\/api\/(?:cadverix|sketchforge)-mcp/.test(String(input))
      ? Promise.resolve(new Response("", { status: 404 })) : original(input, init);
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Create new 3D design", exact: true }).click();
  await page.getByRole("button", { name: "Add shape", exact: true }).click();
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await expect(propertyInput(page, "Height")).toBeVisible();
  await page.locator(".scene-shape-row").filter({ hasText: "Text" }).first().click();
  await page.keyboard.press("r");
  for (const [label, value] of [["Height", "42"], ["Depth", "6"]]) {
    const input = propertyInput(page, label);
    await input.fill(value);
    await input.press("Enter");
    await expect.poll(async () => Number(await input.inputValue())).toBe(Number(value));
  }
  await expect.poll(async () => JSON.parse(await page.locator("[data-codex-state]").textContent() ?? "{}").shapes?.[0])
    .toMatchObject({ kind: "text", depth: 42, height: 6, rotation: 45 });
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => Number(await propertyInput(page, "Depth").inputValue())).toBe(10);
  const revision = await savedRevision(page);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect.poll(async () => Number(await propertyInput(page, "Depth").inputValue())).toBe(6);
  await expect.poll(() => savedRevision(page)).toBeGreaterThan(revision);
  await page.reload();
  await page.locator(".scene-shape-row").filter({ hasText: "Text" }).first().click();
  await expect.poll(async () => Number(await propertyInput(page, "Height").inputValue())).toBe(42);
  await expect.poll(async () => Number(await propertyInput(page, "Depth").inputValue())).toBe(6);
  expect(errors).toEqual([]);
});
