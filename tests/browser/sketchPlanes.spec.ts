import { expect, test, type Page } from "@playwright/test";

async function startSketch(page: Page) {
  await page.getByRole("tab", { name: "Sketch", exact: true }).click();
  await page.getByRole("button", { name: "Sketch to 3D options" }).click();
  await page.getByRole("menuitem", { name: /^Extrude sketch/ }).click();
  await expect(page.getByRole("complementary", { name: "Choose sketch plane" })).toBeVisible();
}

test("Workplane is available from Arrange and Sketch, including the sketch menu", async ({ page }) => {
  await page.goto("/?editor=1");
  await page.locator('[data-tool-group="arrange"]').getByRole("button", { name: "Workplane", exact: true }).click();
  await expect(page.getByRole("complementary", { name: "Construction planes", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Sketch", exact: true }).click();
  await page.getByRole("button", { name: "Workplane", exact: true }).click();
  await expect(page.getByRole("complementary", { name: "Construction planes", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close construction planes" }).click();
  await page.getByRole("button", { name: "Sketch to 3D options" }).click();
  await page.getByRole("menuitem", { name: /^Workplane/ }).click();
  await expect(page.getByRole("complementary", { name: "Construction planes", exact: true })).toBeVisible();
});

for (const [label, plane] of [["XZ · Top", "Base XZ plane"], ["XY · Front", "XY plane"], ["YZ · Side", "YZ plane"]]) {
  test(`starts and finishes a sketch on ${label} with an orbitable body preview`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/?editor=1");
    await page.getByRole("button", { name: "Add shape", exact: true }).click();
    await page.getByRole("button", { name: "Box", exact: true }).click();
    await startSketch(page);
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page.locator(".sketch-plate")).toBeVisible();
    await expect(page.locator(".sketch-revolve-preview-title")).toContainText(plane);
    const preview = page.getByRole("complementary", { name: "Sketch 3D preview" });
    await expect(preview.locator("canvas")).toBeVisible();
    await page.getByRole("button", { name: "Add sketch shape", exact: true }).click();
    await page.getByRole("menuitem", { name: "Rectangle", exact: true }).click();
    await expect(preview).toContainText("Drag to orbit");
    const beforeOrbit = await preview.locator("canvas").screenshot();
    const box = (await preview.locator("canvas").boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 35, box.y + box.height / 2 + 20, { steps: 4 });
    await page.mouse.up();
    await expect.poll(async () => (await preview.locator("canvas").screenshot()).equals(beforeOrbit)).toBe(false);
    await page.getByRole("button", { name: "Finish sketch", exact: true }).click();
    await expect(page.locator(".sketch-plate")).toHaveCount(0);
    await expect.poll(async () => {
      const state = JSON.parse((await page.locator("[data-codex-state]").textContent())!);
      return state.shapes.filter((shape: { kind: string }) => shape.kind !== "constructionPlane").length;
    }).toBe(2);
    await page.getByRole("tab", { name: "Sketch", exact: true }).click();
    await page.getByRole("button", { name: "Edit Sketch to 3D", exact: true }).click();
    await expect(page.locator(".sketch-plate")).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Choose sketch plane" })).toHaveCount(0);
    await expect(page.locator(".sketch-revolve-preview-title")).toContainText(plane);
    expect(errors).toEqual([]);
  });
}

test("plane selection can be cancelled without creating geometry", async ({ page }) => {
  await page.goto("/?editor=1");
  await startSketch(page);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("complementary", { name: "Choose sketch plane" })).toHaveCount(0);
  const state = JSON.parse((await page.locator("[data-codex-state]").textContent())!);
  expect(state.shapeCount).toBe(0);
});

test("a plane can be picked directly in the 3D viewport", async ({ page }) => {
  await page.goto("/?editor=1");
  await startSketch(page);
  const canvas = page.locator(".three-workplane-host canvas");
  await expect(canvas).toBeVisible();
  const box = (await canvas.boundingBox())!;
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator(".sketch-plate")).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Choose sketch plane" })).toHaveCount(0);
});

test.describe("desktop plane picking", () => {
  test.use({ hasTouch: false, isMobile: false });
  test("supports mouse picking and keyboard plane selection", async ({ page }) => {
    await page.goto("/?editor=1");
    await startSketch(page);
    const box = (await page.locator(".three-workplane-host canvas").boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.locator(".sketch-plate")).toBeVisible();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await startSketch(page);
    await page.getByRole("button", { name: "XY · Front", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".sketch-revolve-preview-title")).toContainText("XY plane");
  });
});
