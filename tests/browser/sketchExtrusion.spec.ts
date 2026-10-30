import { expect, test, type Page } from "@playwright/test";
import * as THREE from "three";

type Body = { id: string; kind: string; x: number; z: number; elevation: number; width: number; depth: number; height: number; rotation: number; rotationX: number; rotationZ: number; cadBrepLength: number };
async function body(page: Page): Promise<Body> {
  const state = JSON.parse(await page.locator("[data-codex-state]").textContent() ?? "{}");
  return state.shapes.find((shape: Body) => shape.kind !== "constructionPlane");
}
function normal(shape: Body) {
  return new THREE.Vector3(0, 1, 0).applyEuler(new THREE.Euler(...[shape.rotationX, shape.rotation, shape.rotationZ].map(THREE.MathUtils.degToRad) as [number, number, number], "XYZ"));
}
function sketchStart(shape: Body, direction = "positive") {
  const offset = direction === "symmetric" ? 0 : shape.height / 2 * (direction === "negative" ? -1 : 1);
  return new THREE.Vector3(shape.x, shape.elevation + shape.height / 2, shape.z).addScaledVector(normal(shape), -offset);
}
async function startCircle(page: Page, plane: string, primitive = "Circle") {
  await page.goto("/");
  await page.getByRole("button", { name: "Create new 3D design", exact: true }).click();
  await page.getByRole("tab", { name: "Sketch", exact: true }).click();
  await page.getByRole("button", { name: "Sketch to 3D options" }).click();
  await page.getByRole("menuitem", { name: /^Extrude sketch/ }).click();
  await page.getByRole("button", { name: plane, exact: true }).click();
  await page.getByRole("button", { name: "Add sketch shape", exact: true }).click();
  await page.getByRole("menuitem", { name: primitive, exact: true }).click();
}
async function setDistance(page: Page, value: string) {
  const input = page.getByRole("textbox", { name: /Extrusion distance/ });
  await input.fill(value);
  await input.press("Enter");
}

for (const plane of ["XZ · Top", "XY · Front", "YZ · Side"]) {
  test(`extrusion extends without rotating on ${plane}, edits in place, and survives reload`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await startCircle(page, plane);
    await setDistance(page, "10");
    await page.getByRole("button", { name: "Finish sketch", exact: true }).click();
    await expect.poll(async () => (await body(page))?.height).toBeCloseTo(10, 1);
    const before = await body(page);
    expect(before.cadBrepLength).toBeGreaterThan(0);
    await setDistance(page, "40");
    await expect.poll(async () => (await body(page)).height).toBeCloseTo(40, 1);
    const after = await body(page);
    expect([after.rotation, after.rotationX, after.rotationZ]).toEqual([before.rotation, before.rotationX, before.rotationZ]);
    expect([after.width, after.depth, after.cadBrepLength]).toEqual([before.width, before.depth, before.cadBrepLength]);
    expect(sketchStart(after).distanceTo(sketchStart(before))).toBeLessThan(0.01);
    // Exercise the same direct extrusion handle as the reported rotation bug.
    await page.getByRole("button", { name: "Center view on selection", exact: true }).click();
    await page.getByRole("button", { name: "Minimize shape settings", exact: true }).click();
    const handle = page.locator(".transform-handle.height-top");
    await handle.hover();
    const dragVector = await page.locator(".dimension-line").evaluate((line: SVGLineElement) => {
      const dx = line.x2.baseVal.value - line.x1.baseVal.value;
      const dy = line.y2.baseVal.value - line.y1.baseVal.value;
      return { x: dx / Math.hypot(dx, dy), y: dy / Math.hypot(dx, dy) };
    });
    const bounds = (await handle.boundingBox())!;
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width / 2 + dragVector.x * 65, bounds.y + bounds.height / 2 + dragVector.y * 65, { steps: 8 });
    await page.mouse.up();
    const dragged = await body(page);
    expect(Math.abs(dragged.height - after.height)).toBeGreaterThan(0.1);
    expect([dragged.rotation, dragged.rotationX, dragged.rotationZ, dragged.width, dragged.depth]).toEqual([after.rotation, after.rotationX, after.rotationZ, after.width, after.depth]);
    expect(dragged.cadBrepLength).toBeGreaterThan(0);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect.poll(async () => (await body(page)).height).toBeCloseTo(40, 1);
    await page.getByRole("button", { name: "Open Sketch extrusion properties", exact: true }).click();
    await page.getByRole("button", { name: "Edit sketch", exact: true }).click();
    await expect(page.getByRole("textbox", { name: /Extrusion distance/ })).toHaveValue(/^40(?:\.0+)?$/);
    await setDistance(page, "25");
    await page.getByRole("button", { name: "Finish sketch", exact: true }).click();
    await expect.poll(async () => (await body(page)).height).toBeCloseTo(25, 1);
    const rebuilt = await body(page);
    expect(rebuilt.id).toBe(before.id);
    expect(sketchStart(rebuilt).distanceTo(sketchStart(before))).toBeLessThan(0.02);
    expect([rebuilt.rotation, rebuilt.rotationX, rebuilt.rotationZ]).toEqual([before.rotation, before.rotationX, before.rotationZ]);
    await page.reload();
    await expect.poll(async () => (await body(page))?.height).toBeCloseTo(25, 1);
    expect(sketchStart(await body(page)).distanceTo(sketchStart(before))).toBeLessThan(0.02);
    expect(errors).toEqual([]);
  });
}

for (const direction of ["negative", "symmetric"]) {
  test(`${direction} extrusion uses the selected sketch plane and retains its settings`, async ({ page }) => {
    await startCircle(page, "XY · Front");
    await setDistance(page, "30");
    await page.getByLabel("Extrusion direction", { exact: true }).selectOption(direction);
    await page.getByRole("button", { name: "Finish sketch", exact: true }).click();
    await expect.poll(async () => (await body(page))?.height).toBeCloseTo(30, 1);
    const created = await body(page);
    expect(sketchStart(created, direction).z).toBeCloseTo(0, 2);
    await setDistance(page, "50");
    await expect.poll(async () => (await body(page)).height).toBeCloseTo(50, 1);
    expect(sketchStart(await body(page), direction).distanceTo(sketchStart(created, direction))).toBeLessThan(0.02);
    await page.getByRole("button", { name: "Edit sketch", exact: true }).click();
    await expect(page.getByLabel("Extrusion direction", { exact: true })).toHaveValue(direction);
    await page.getByRole("button", { name: "Finish sketch", exact: true }).click();
    await expect.poll(async () => (await body(page)).height).toBeCloseTo(50, 1);
    expect(sketchStart(await body(page), direction).distanceTo(sketchStart(created, direction))).toBeLessThan(0.02);
  });
}

test("a driving sketch dimension rebuilds its extrusion without moving the fixed profile corner", async ({ page }) => {
  await startCircle(page, "XY · Front", "Rectangle");
  await page.getByRole("button", { name: "Select", exact: true }).click();
  const midpoint = await page.locator(".sketch-segments path").first().evaluate((path: SVGPathElement) => {
    const point = path.getPointAtLength(path.getTotalLength() / 2).matrixTransform(path.getScreenCTM()!);
    return { x: point.x, y: point.y };
  });
  await page.mouse.click(midpoint.x, midpoint.y);
  await expect(page.getByRole("complementary", { name: "Segment constraints", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Set length/ }).dblclick();
  const input = page.getByRole("textbox", { name: "Sketch dimension length", exact: true });
  await input.fill("40"); await input.press("Enter");
  await setDistance(page, "15");
  await page.getByRole("button", { name: "Finish sketch", exact: true }).click();
  await expect.poll(async () => (await body(page))?.width).toBeCloseTo(40, 1);
  const before = await body(page);
  const corner = (shape: Body) => {
    const rotation = new THREE.Euler(THREE.MathUtils.degToRad(shape.rotationX), THREE.MathUtils.degToRad(shape.rotation), THREE.MathUtils.degToRad(shape.rotationZ));
    return sketchStart(shape).add(new THREE.Vector3(-shape.width / 2, 0, -shape.depth / 2).applyEuler(rotation));
  };
  await page.getByRole("button", { name: "Edit sketch", exact: true }).click();
  await page.getByRole("button", { name: /^Edit length/ }).dblclick();
  await input.fill("60"); await input.press("Enter");
  await page.getByRole("button", { name: "Finish sketch", exact: true }).click();
  await expect.poll(async () => (await body(page)).width).toBeCloseTo(60, 1);
  const after = await body(page);
  expect(after.id).toBe(before.id);
  expect(after.height).toBeCloseTo(15, 1);
  expect(after.depth).toBe(before.depth);
  expect(corner(after).distanceTo(corner(before))).toBeLessThan(0.02);
  expect(after.cadBrepLength).toBeGreaterThan(0);
});
