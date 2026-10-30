import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { strFromU8, unzipSync } from "fflate";
import { SphereGeometry } from "three";

const scene = async (page: Page) => JSON.parse(await page.locator("[data-codex-state]").textContent() ?? "{}");
const nodes = async (page: Page, kind: string) => (await scene(page)).shapes.filter((shape: { kind: string }) => shape.kind === kind);
async function startSketch(page: Page, plane: string) {
  await page.getByRole("tab", { name: "Sketch", exact: true }).click();
  await page.getByRole("button", { name: "Sketch to 3D options" }).click();
  await page.getByRole("menuitem", { name: /^Extrude sketch/ }).click();
  await page.getByRole("button", { name: plane, exact: true }).click();
}
async function addRectangle(page: Page) {
  await page.getByRole("button", { name: "Add sketch shape", exact: true }).click();
  await page.getByRole("menuitem", { name: "Rectangle", exact: true }).click();
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init) => /\/api\/(?:cadverix|sketchforge)-mcp/.test(String(input)) ? Promise.resolve(new Response("", { status: 404 })) : originalFetch(input, init);
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Create new 3D design", exact: true }).click();
});

for (const largeMesh of [false, true]) test(`vertical sketch references stay finite and interactive ${largeMesh ? "with a large imported mesh" : "in an empty scene"}`, async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  if (largeMesh) {
    const geometry = new SphereGeometry(10, 256, 256).toNonIndexed();
    const positions = geometry.getAttribute("position");
    const triangles = positions.count / 3;
    const buffer = Buffer.alloc(84 + triangles * 50);
    buffer.writeUInt32LE(triangles, 80);
    for (let triangle = 0; triangle < triangles; triangle++) for (let vertex = 0; vertex < 3; vertex++) {
      const index = triangle * 3 + vertex;
      const offset = 84 + triangle * 50 + 12 + vertex * 12;
      buffer.writeFloatLE(positions.getX(index), offset);
      buffer.writeFloatLE(positions.getY(index) + 10, offset + 4);
      buffer.writeFloatLE(positions.getZ(index), offset + 8);
    }
    geometry.dispose();
    await page.locator('input[type="file"][accept^=".3mf"]').setInputFiles({ name: "large-reference.stl", mimeType: "model/stl", buffer });
    await expect.poll(async () => (await scene(page)).shapeCount).toBe(1);
  }
  await startSketch(page, "XY · Front");
  await addRectangle(page);
  if (largeMesh) {
    const bounds = await page.locator(".sketch-reference-mesh-outline").first().evaluate((path: SVGGraphicsElement) => {
      const box = path.getBBox();
      return { width: box.width, height: box.height };
    });
    expect(bounds.width).toBeCloseTo(20, 1);
    expect(bounds.height).toBeCloseTo(20, 1);
    const outline = await page.locator(".sketch-reference-mesh-outline").first().getAttribute("d");
    expect(outline!.match(/M /g)).toHaveLength(1);
    const fill = page.locator(".sketch-reference-mesh-face").first();
    await expect(fill).toHaveAttribute("d", outline!);
    expect(await fill.evaluate((path: SVGGeometryElement) => {
      const box = path.getBBox();
      return path.isPointInFill(new DOMPoint(box.x + box.width / 2, box.y + box.height / 2));
    })).toBe(true);
  }
  await expect(page.locator(".sketch-segments path")).toHaveCount(4);
  expect(await page.locator(".sketch-plate").evaluate((plate) => [...plate.querySelectorAll("*")].flatMap((node) => [...node.attributes].filter((attribute) => /NaN|Infinity/.test(attribute.value)).map((attribute) => `${node.tagName}.${attribute.name}=${attribute.value}`)))).toEqual([]);
  await page.getByRole("button", { name: "Save sketch only", exact: true }).click();
  await expect(page.locator(".sketch-plate")).toHaveCount(0);
  await expect.poll(async () => (await nodes(page, "sketchProfile")).length).toBe(1);
  expect((await nodes(page, "mesh")).length).toBe(largeMesh ? 1 : 0);
  expect(errors).toEqual([]);
});

test("independent sketches drive exact solids, regenerate, save/reopen, and retain editable history", async ({ page }) => {
  test.setTimeout(100000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await startSketch(page, "XY · Front");
  await addRectangle(page);
  await page.getByRole("textbox", { name: "Sketch name", exact: true }).fill("Base profile");
  await page.getByRole("button", { name: "Save sketch only", exact: true }).click();
  await expect(page.locator(".sketch-plate")).toHaveCount(0);
  await expect.poll(async () => (await nodes(page, "sketchProfile")).length).toBe(1);
  expect(await nodes(page, "mesh")).toHaveLength(0);
  const source = (await nodes(page, "sketchProfile"))[0];
  expect(source.importedTriangles).toBe(0);
  await page.getByRole("button", { name: "Extrude saved sketch", exact: true }).click();
  const distance = page.getByRole("textbox", { name: /Extrusion distance/ });
  await distance.fill("10"); await distance.press("Enter");
  await page.getByRole("button", { name: "Finish sketch", exact: true }).click();
  await expect.poll(async () => (await nodes(page, "mesh")).length).toBe(1);
  const before = (await nodes(page, "mesh"))[0];
  expect(before.sourceSketchId).toBe(source.id);
  expect(before.cadBrepLength).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Select source sketch", exact: true }).click();
  await page.getByRole("button", { name: "Edit saved sketch", exact: true }).click();
  const edge = await page.locator(".sketch-segments path").first().evaluate((path: SVGPathElement) => {
    const point = path.getPointAtLength(path.getTotalLength() / 2).matrixTransform(path.getScreenCTM()!);
    return { x: point.x, y: point.y };
  });
  await page.mouse.click(edge.x, edge.y);
  await page.getByRole("button", { name: /^Set length/ }).dblclick();
  const dimension = page.getByRole("textbox", { name: "Sketch dimension length", exact: true });
  await dimension.fill("40"); await dimension.press("Enter");
  await page.getByRole("button", { name: "Save sketch only", exact: true }).click();
  await expect(page.locator(".sketch-plate")).toHaveCount(0);
  await expect.poll(async () => (await nodes(page, "mesh"))[0].width).toBe(40);
  const after = (await nodes(page, "mesh"))[0];
  expect([after.id, after.height, after.depth, after.rotationX, after.rotation, after.rotationZ]).toEqual([before.id, 10, 20, before.rotationX, before.rotation, before.rotationZ]);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => (await nodes(page, "mesh"))[0].width).toBe(20);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect.poll(async () => (await nodes(page, "mesh"))[0].width).toBe(40);
  await page.getByRole("button", { name: "Delete Base profile", exact: true }).click();
  await expect(page.locator(".editor-toast")).toContainText("Cannot delete referenced geometry");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.getByRole("radio", { name: "SKF: Editable project", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save Cadverix 3D Project", exact: true }).click();
  const file = await download;
  const bytes = await readFile((await file.path())!);
  const files = unzipSync(bytes);
  const document = JSON.parse(strFromU8(files["project.json"]));
  expect(document.formatVersion).toBe(5);
  expect(document.minimumReaderVersion).toBe(5);
  // Validate the actual application-generated B-rep, not just its viewport mesh.
  await promisify(execFile)(process.execPath, [join(process.cwd(), "tests/browser/helpers/assertParametricBrep.mjs"), (await file.path())!, before.id, String(40 * 20 * 10)], { timeout: 30000 });
  await page.locator('input[type="file"][accept=".skf,.lyl"]').setInputFiles({ name: "independent.skf", mimeType: "application/zip", buffer: bytes });
  await expect.poll(async () => (await nodes(page, "sketchProfile")).length).toBe(1);
  await expect.poll(async () => (await nodes(page, "mesh"))[0]?.width).toBe(40);
  await page.reload();
  await expect.poll(async () => (await nodes(page, "sketchProfile")).length).toBe(1);
  await page.getByRole("treeitem").filter({ hasText: "Base profile" }).first().click();
  await page.getByRole("button", { name: "Edit saved sketch", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Edit length/ })).toContainText("40");
  const lastGood = (await nodes(page, "mesh"))[0];
  await page.getByRole("button", { name: "Erase", exact: true }).click();
  const erasePoint = await page.locator(".sketch-segments path").first().evaluate((path: SVGPathElement) => {
    const point = path.getPointAtLength(path.getTotalLength() / 2).matrixTransform(path.getScreenCTM()!);
    return { x: point.x, y: point.y };
  });
  await page.mouse.click(erasePoint.x, erasePoint.y);
  await expect(page.locator(".sketch-segments path")).toHaveCount(3);
  await page.getByRole("button", { name: "Save sketch only", exact: true }).click();
  await expect(page.locator(".editor-toast")).toContainText(/profile paths are open/i);
  await expect(page.locator(".sketch-plate")).toHaveCount(1);
  expect((await nodes(page, "mesh"))[0]).toEqual(lastGood);
  expect((await nodes(page, "sketchProfile"))[0].sketchSegmentCount).toBe(4);
  expect(errors).toEqual([]);
});

test("three-point plane edits move saved sketches without changing local coordinates", async ({ page }) => {
  await page.getByRole("button", { name: "Reference planes", exact: true }).click();
  const panel = page.getByRole("complementary", { name: "Construction planes", exact: true });
  await panel.getByRole("button", { name: "3 points", exact: true }).click();
  const points = [[0, 0, 40], [10, 0, 40], [0, 10, 40]];
  for (let index = 0; index < 3; index++) for (let axis = 0; axis < 3; axis++) await panel.getByLabel(`Point ${index + 1} ${["X", "Y", "Z"][axis]}`, { exact: true }).fill(String(points[index][axis]));
  await panel.getByRole("button", { name: "Create three-point plane", exact: true }).click();
  await page.getByRole("button", { name: "Right view", exact: true }).click();
  await page.keyboard.press("o");
  const cameraAngles = async () => page.locator(".view-cube-inner").evaluate((element: HTMLElement) => [...element.style.transform.matchAll(/(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)deg/gi)].map((match) => Number(match[1])));
  await expect.poll(async () => (await cameraAngles()).length).toBe(2);
  const originalCamera = await cameraAngles();
  await startSketch(page, "Use active workplane");
  await addRectangle(page);
  await page.getByRole("textbox", { name: "Sketch name", exact: true }).fill("Upper profile");
  const original = await page.locator(".sketch-segments path").evaluateAll((paths) => paths.map((path) => path.getAttribute("d")));
  await page.getByRole("button", { name: "Save sketch only", exact: true }).click();
  await expect.poll(async () => (await nodes(page, "sketchProfile"))[0]?.sketchPlane.pose.origin[2]).toBe(40);
  await expect.poll(async () => { const angles = await cameraAngles(); return angles.length === 2 && angles.every((value, index) => Math.abs(value - originalCamera[index]) < 0.001); }).toBe(true);
  await page.getByRole("button", { name: "Reference planes", exact: true }).click();
  await panel.getByText("Edit active plane", { exact: true }).click();
  const editor = panel.getByRole("form", { name: "Edit reference plane", exact: true });
  for (let index = 1; index <= 3; index++) await editor.getByLabel(`Point ${index} Z`, { exact: true }).fill("60");
  await editor.getByRole("button", { name: "Update reference plane", exact: true }).click();
  await expect.poll(async () => (await nodes(page, "sketchProfile"))[0].sketchPlane.pose.origin[2]).toBe(60);
  await panel.getByRole("button", { name: "Close construction planes", exact: true }).click();
  await page.getByRole("treeitem").filter({ hasText: "Upper profile" }).first().click();
  await page.getByRole("button", { name: "Edit saved sketch", exact: true }).click();
  await expect.poll(() => page.locator(".sketch-segments path").evaluateAll((paths) => paths.map((path) => path.getAttribute("d")))).toEqual(original);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("tab", { name: "Geometry", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => (await nodes(page, "sketchProfile"))[0].sketchPlane.pose.origin[2]).toBe(40);
});

test("reference planes can be shown together without changing their saved visibility", async ({ page }) => {
  await page.getByRole("button", { name: "Reference planes", exact: true }).click();
  const panel = page.getByRole("complementary", { name: "Construction planes", exact: true });
  const toggle = panel.getByRole("checkbox", { name: "Show all reference planes", exact: true });
  await expect(toggle).not.toBeChecked();
  await panel.getByRole("button", { name: "3 points", exact: true }).click();
  await panel.getByRole("button", { name: "Create three-point plane", exact: true }).click();
  await expect.poll(async () => (await nodes(page, "constructionPlane")).length).toBe(1);
  await page.getByRole("button", { name: "Reference planes", exact: true }).click();
  const before = await nodes(page, "constructionPlane");
  await toggle.check();
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  expect(await nodes(page, "constructionPlane")).toEqual(before);
});
