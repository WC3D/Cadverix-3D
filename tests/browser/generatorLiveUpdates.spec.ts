import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";

function propertyInput(page: Page, label: string) {
  return page.locator(".shape-inspector .range-property")
    .filter({ has: page.locator(".range-property-name", { hasText: new RegExp(`^${label}$`) }) })
    .locator('input[type="text"]');
}

async function viewportHash(page: Page) {
  const image = await page.evaluate(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    return (window as unknown as { sketchforgeCaptureCanvas: () => string }).sketchforgeCaptureCanvas();
  });
  return createHash("sha256").update(image).digest("hex");
}

async function savedRevision(page: Page) {
  return page.evaluate(() => {
    const id = new URL(location.href).searchParams.get("project");
    const projects = JSON.parse(localStorage.getItem("sketchForge.projects") ?? "[]");
    return projects.find((project: { id: string }) => project.id === id)?.revision ?? 0;
  });
}

const cases: { name: string; edits: [string, number][] }[] = [
  { name: "Honeycomb", edits: [["Cell Size", 14], ["Wall Thickness", 2.6], ["Frame Width", 8]] },
  { name: "Bent Tube", edits: [["Segment 1 Bend", 45], ["Segment 1 Roll", 45], ["Segment 1 Radius", 22], ["Segment 2 Length", 36], ["Tube Diameter", 12], ["Wall Thickness", 2.5], ["Quality", 64]] },
];

for (const { name, edits } of cases) test(`${name} regenerates immediately and survives undo, redo and reload`, async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const fetch = window.fetch.bind(window);
    window.fetch = (input, init) => /\/api\/(?:cadverix|sketchforge)-mcp/.test(String(input))
      ? Promise.resolve(new Response("", { status: 404 })) : fetch(input, init);
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Create new 3D design", exact: true }).click();
  await expect(page).toHaveURL(/project=/);
  const initialRevision = await savedRevision(page);
  await page.getByRole("button", { name: "Add generator", exact: true }).click();
  await page.getByRole("button", { name, exact: true }).click();
  await expect.poll(() => savedRevision(page)).toBeGreaterThan(initialRevision);
  await page.mouse.move(10, 10);

  let previous = await viewportHash(page);
  let beforeLastEdit = previous;
  for (const [label, value] of edits) {
    const revision = await savedRevision(page);
    const input = propertyInput(page, label);
    await input.fill(String(value));
    await input.press("Enter");
    await expect.poll(async () => Number(await input.inputValue())).toBe(value);
    await page.mouse.move(10, 10);
    await expect.poll(() => viewportHash(page), { message: `${name}: ${label} must change the rendered mesh without reloading` }).not.toBe(previous);
    beforeLastEdit = previous;
    previous = await viewportHash(page);
    await expect.poll(() => savedRevision(page)).toBeGreaterThan(revision);
  }

  const beforeUndoRevision = await savedRevision(page);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.mouse.move(10, 10);
  await expect.poll(() => viewportHash(page)).toBe(beforeLastEdit);
  await expect.poll(() => savedRevision(page)).toBeGreaterThan(beforeUndoRevision);
  const undoRevision = await savedRevision(page);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page.mouse.move(10, 10);
  await expect.poll(() => viewportHash(page)).toBe(previous);
  await expect.poll(() => savedRevision(page)).toBeGreaterThan(undoRevision);
  await page.reload();
  await page.locator(".scene-shape-row").filter({ hasText: name }).first().click();
  for (const [label, value] of edits) await expect.poll(async () => Number(await propertyInput(page, label).inputValue())).toBe(value);
  await page.mouse.move(10, 10);
  await expect.poll(() => viewportHash(page)).toBe(previous);
  expect(errors).toEqual([]);
});
