import { expect, test, type Page } from "@playwright/test";
import { strToU8, zipSync, unzipSync } from "fflate";
import { readFile } from "node:fs/promises";
const scene = async (page: Page) => JSON.parse(await page.locator("[data-codex-state]").textContent() ?? "{}");
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const fetch = window.fetch.bind(window);
    window.fetch = (input, init) => /\/api\/(?:cadverix|sketchforge)-mcp/.test(String(input)) ? Promise.resolve(new Response("", { status: 404 })) : fetch(input, init);
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Create new 3D design", exact: true }).click();
});
test("XYZ patterns preview without committing, apply once, and undo", async ({ page }) => {
  await page.getByRole("button", { name: "Add shape", exact: true }).click();
  await page.getByRole("button", { name: "Box", exact: true }).click();
  await page.getByRole("button", { name: "Modeling tools", exact: true }).click();
  await page.getByLabel("Pattern Z (height) count", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Preview pattern", exact: true }).click();
  await expect.poll(async () => (await scene(page)).shapeCount).toBe(1);
  await page.getByRole("button", { name: "Create pattern", exact: true }).click();
  await expect.poll(async () => (await scene(page)).shapeCount).toBe(4);
  const grid = (await scene(page)).shapes;
  expect(grid.map((shape: { elevation: number }) => shape.elevation).sort((a: number, b: number) => a - b)).toEqual([0, 0, 30, 30]);
  expect(new Set(grid.map((shape: { z: number }) => shape.z)).size).toBe(1);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => (await scene(page)).shapeCount).toBe(1);
});
test("shells a box in the browser worker and preserves exact CAD geometry", async ({ page }) => {
  test.setTimeout(90000);
  await page.getByRole("button", { name: "Add shape", exact: true }).click();
  await page.getByRole("button", { name: "Box", exact: true }).click();
  await page.getByRole("button", { name: "Modeling tools", exact: true }).click();
  await page.getByRole("button", { name: "Apply shell", exact: true }).click();
  await expect(page.locator(".editor-toast")).toContainText("Shelled", { timeout: 65000 });
  expect((await scene(page)).shapes[0].cadBrepLength).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await scene(page)).shapes[0].kind).toBe("box");
});
test("imports nested cross-file 3MF components with local ID collisions", async ({ page }) => {
  const ns = 'xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06"';
  const archive = zipSync({
    "_rels/.rels": strToU8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>'),
    "3D/3dmodel.model": strToU8(`<model ${ns} unit="millimeter" requiredextensions="p"><resources><object id="1"><components><component objectid="1" p:path="/3D/Objects/part.model" transform="1 0 0 0 1 0 0 0 1 10 0 0"/></components></object></resources><build><item objectid="1"/></build></model>`),
    "3D/Objects/part.model": strToU8(`<model ${ns} unit="millimeter"><resources><object id="1"><mesh><vertices><vertex x="0" y="0" z="0"/><vertex x="20" y="0" z="0"/><vertex x="0" y="20" z="0"/><vertex x="0" y="0" z="20"/></vertices><triangles><triangle v1="0" v2="2" v3="1"/><triangle v1="0" v2="1" v3="3"/><triangle v1="0" v2="3" v3="2"/><triangle v1="1" v2="2" v3="3"/></triangles></mesh></object></resources></model>`),
  });
  await page.locator('input[type="file"]').filter({ hasNot: page.locator("[accept*=image]") }).first().setInputFiles({ name: "assembly.3mf", mimeType: "model/3mf", buffer: Buffer.from(archive) });
  await expect.poll(async () => (await scene(page)).shapeCount).toBe(1);
  expect((await scene(page)).shapes[0].width).toBeCloseTo(20);
});
test("printer settings and local recovery snapshots survive reload", async ({ page }) => {
  await page.getByRole("button", { name: "Add shape", exact: true }).click();
  await page.getByRole("button", { name: "Box", exact: true }).click();
  await page.getByRole("button", { name: "Workspace settings", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Workspace settings", exact: true });
  await dialog.getByRole("button", { name: "Workplane", exact: true }).click();
  await page.getByLabel("Printer preset", { exact: true }).selectOption("bambu-a1-mini");
  await dialog.getByRole("button", { name: "Close settings", exact: true }).first().click();
  await expect(page.locator(".printer-status")).toContainText("180 × 180 × 180");
  await page.reload();
  await expect(page.locator(".printer-status")).toContainText("180 × 180 × 180");
  await expect.poll(async () => (await scene(page)).shapeCount).toBe(1);
  const originalUrl = page.url();
  // HTTP LAN deployments may not expose crypto.randomUUID.
  await page.evaluate(() => Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true }));
  await page.getByRole("button", { name: "Home dashboard", exact: true }).click();
  await page.getByRole("button", { name: "Storage & backups", exact: true }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download backup", exact: true }).click();
  const backupDownload = await downloaded;
  expect(unzipSync(await readFile((await backupDownload.path())!))["project.json"]).toBeDefined();
  await page.getByRole("button", { name: "Snapshot now", exact: true }).click();
  await expect(page.getByRole("button", { name: "Snapshot now", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Restore as copy", exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Restore as copy", exact: true }).first().click();
  await expect(page).toHaveURL(/project=/);
  await expect.poll(async () => (await scene(page)).shapeCount).toBe(1);
  expect(page.url()).not.toBe(originalUrl);
});

test("fractional viewport edits convert to millimeters without rounding an untouched value", async ({ page }) => {
  await page.getByRole("button", { name: "Add shape", exact: true }).click();
  await page.getByRole("button", { name: "Box", exact: true }).click();
  await page.getByRole("button", { name: "Workspace settings", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Workspace settings", exact: true });
  await dialog.getByRole("button", { name: "Measurement", exact: true }).click();
  await dialog.locator(".workspace-select").filter({ hasText: /^Units/ }).locator("select").selectOption("Imperial");
  await dialog.getByRole("button", { name: "Close settings", exact: true }).first().click();
  const dimension = page.getByRole("button", { name: "width dimension", exact: true }).first();
  await page.getByRole("button", { name: "Resize", exact: true }).first().click();
  await expect(dimension).toHaveText("25/32");
  await dimension.click();
  await page.getByRole("textbox", { name: "width dimension", exact: true }).press("Enter");
  expect((await scene(page)).shapes[0].width).toBe(20);
  await dimension.click();
  const input = page.getByRole("textbox", { name: "width dimension", exact: true });
  await input.fill("1 5/8"); await input.press("Enter");
  await expect.poll(async () => (await scene(page)).shapes[0].width).toBeCloseTo(41.275, 3);
});

test("sketch clipboard and corner fillet preserve connected geometry and undo", async ({ page }) => {
  await page.getByRole("tab", { name: "Sketch", exact: true }).click();
  await page.getByRole("button", { name: "Sketch to 3D options" }).click();
  await page.getByRole("menuitem", { name: /^Extrude sketch/ }).click();
  await page.getByRole("button", { name: "Line", exact: true }).click();
  await page.touchscreen.tap(600, 600); await page.touchscreen.tap(850, 600); await page.touchscreen.tap(850, 450);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Select", exact: true }).click();
  const points = page.locator('.sketch-points [data-sketch-entity="point"]');
  await points.nth(1).click();
  await page.getByRole("button", { name: "Fillet corner", exact: true }).click();
  await expect(page.locator(".sketch-segments path")).toHaveCount(3);
  await expect(page.locator(".sketch-segments path").last()).toHaveAttribute("d", /C/);
  await page.keyboard.press("ControlOrMeta+a");
  await page.getByRole("button", { name: "Sketch duplicate", exact: true }).click();
  await expect(page.locator(".sketch-segments path")).toHaveCount(6);
  await page.getByRole("button", { name: "Sketch undo", exact: true }).click();
  await expect(page.locator(".sketch-segments path")).toHaveCount(3);
});

test("face pivot rotates around the picked face and lay-flat is undoable", async ({ page }) => {
  await page.getByRole("button", { name: "Add shape", exact: true }).click();
  await page.getByRole("button", { name: "Box", exact: true }).click();
  await page.getByRole("button", { name: "Center view on selection", exact: true }).click();
  await page.keyboard.press("4");
  await page.getByRole("button", { name: "Modeling tools", exact: true }).click();
  await page.getByRole("button", { name: "Pick face pivot", exact: true }).click();
  await page.waitForTimeout(350);
  const canvas = page.locator(".workplane-wrap canvas");
  const box = (await canvas.boundingBox())!;
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator(".editor-toast")).toContainText("Face pivot set");
  await page.keyboard.press("r");
  await expect.poll(async () => Math.abs((await scene(page)).shapes[0].x)).toBeGreaterThan(1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByRole("button", { name: "Modeling tools", exact: true }).click();
  await page.getByRole("button", { name: "Lay flat on face", exact: true }).click();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator(".editor-toast")).toContainText("Laid selection flat");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await scene(page)).shapes[0].kind).toBe("box");
});

test("phone modeling tools fit the viewport and create a pattern by touch", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Add shape", exact: true }).tap();
  await page.getByRole("button", { name: "Box", exact: true }).tap();
  await page.getByRole("button", { name: "Modeling tools", exact: true }).tap();
  const panel = page.getByRole("complementary", { name: "Modeling tools", exact: true });
  const bounds = (await panel.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
  expect(bounds.height).toBeLessThan(844 * 0.6);
  await panel.getByRole("button", { name: "Create pattern", exact: true }).tap();
  await expect.poll(async () => (await scene(page)).shapeCount).toBe(2);
  await panel.getByRole("button", { name: "Close", exact: true }).tap();
  await expect(panel).toHaveCount(0);
});

test("circular patterns use a picked workplane center and preserve settings when picking or cancelling", async ({ page }) => {
  await page.getByRole("button", { name: "Add shape", exact: true }).click();
  await page.getByRole("button", { name: "Box", exact: true }).click();
  await page.getByRole("button", { name: "Center view on selection", exact: true }).click();
  await page.keyboard.press("5");
  await page.getByRole("button", { name: "Modeling tools", exact: true }).click();
  await page.getByLabel("3D pattern type", { exact: true }).selectOption("circular");
  await page.getByLabel("Circular pattern count", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Pick center on workplane", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Circular pattern count", { exact: true })).toHaveValue("2");
  expect((await scene(page)).selectedIds).toHaveLength(1);
  await page.getByRole("button", { name: "Pick center on workplane", exact: true }).click();
  const canvas = (await page.locator(".workplane-wrap canvas").boundingBox())!;
  await page.touchscreen.tap(canvas.x + canvas.width / 2 + 100, canvas.y + canvas.height / 2 + 50);
  await expect(page.getByLabel("3D pattern type", { exact: true })).toHaveValue("circular");
  await expect(page.getByLabel("Circular pattern count", { exact: true })).toHaveValue("2");
  const label = await page.getByLabel("Circular pattern center", { exact: true }).textContent();
  const coordinates = /X ([\d.-]+), Y ([\d.-]+), Z ([\d.-]+)/.exec(label!)!;
  expect(coordinates).not.toBeNull();
  const [x, y, z] = coordinates.slice(1).map(Number);
  expect(Math.hypot(x, y)).toBeGreaterThan(0);
  expect(z).toBe(0);
  await page.getByRole("button", { name: "Pick center on workplane", exact: true }).click();
  await page.getByRole("button", { name: "Cancel picking", exact: true }).click();
  await expect(page.getByLabel("Circular pattern center", { exact: true })).toHaveText(label!);
  await page.getByRole("button", { name: "Create pattern", exact: true }).click();
  await expect.poll(async () => (await scene(page)).shapeCount).toBe(2);
  const shapes = (await scene(page)).shapes;
  expect((shapes[0].x + shapes[1].x) / 2).toBeCloseTo(x, 3);
  expect((shapes[0].z + shapes[1].z) / 2).toBeCloseTo(y, 3);
  expect(shapes[1].elevation).toBe(shapes[0].elevation);
  await page.getByRole("button", { name: "Clear workplane center", exact: true }).click();
  await expect(page.getByLabel("Circular pattern center", { exact: true })).toContainText("world origin");
});
