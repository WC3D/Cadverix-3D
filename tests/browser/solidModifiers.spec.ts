import { expect, test, type Page } from "@playwright/test";
import { chooseModifyTool } from "./helpers/modifyTools";

test.use({ hasTouch: false, isMobile: false, viewport: { width: 1440, height: 1000 } });
const scene = async (page: Page) => JSON.parse(await page.locator("[data-codex-state]").textContent() ?? "{}");
const addBox = async (page: Page) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Create new 3D design", exact: true }).click();
  await page.getByRole("button", { name: "Add shape", exact: true }).click();
  await page.getByRole("button", { name: "Box", exact: true }).click();
};

for (const [label, added, exact] of [
  ["Flexi joints", 1, false], ["Cookie cutter", 1, false], ["Lid", 1, false],
  ["Offset body", 0, true], ["Push / pocket face", 0, true], ["Simplify mesh", 0, false], ["Surface texture", 0, false],
] as const) test(`${label}: preview, apply, undo and redo`, async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (request) => {
    if (/\.wasm|worker|manifold\.js/.test(request.url()) && !request.failure()?.errorText.includes("ABORTED")) errors.push(request.failure()?.errorText ?? request.url());
  });
  await addBox(page);
  const original = await scene(page);
  await chooseModifyTool(page, label);
  const panel = page.getByRole("region", { name: label, exact: true });
  await expect(panel).toBeVisible();
  if (label === "Lid") await panel.getByLabel("Lid type", { exact: true }).selectOption("flat");
  if (label === "Push / pocket face") await panel.getByRole("checkbox", { name: /Face \d+: Top/ }).check();
  await panel.getByRole("button", { name: "Preview modifier", exact: true }).click();
  const apply = panel.getByRole("button", { name: "Apply modifier", exact: true });
  await expect(apply).toBeEnabled({ timeout: 90000 });
  expect((await scene(page)).shapeCount).toBe(original.shapeCount);
  await apply.click();
  await expect(panel).toHaveCount(0);
  await expect.poll(async () => (await scene(page)).shapeCount).toBe(original.shapeCount + added);
  const modified = await scene(page);
  expect(modified.shapes.some((shape: { kind: string; importedTriangles: number }) => shape.kind === "mesh" && shape.importedTriangles > 0)).toBe(true);
  if (exact) expect(modified.shapes[0].cadBrepLength).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => (await scene(page)).shapes).toEqual(original.shapes);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect.poll(async () => (await scene(page)).shapes).toEqual(modified.shapes);
  if (label === "Offset body" || label === "Flexi joints") {
    await page.reload();
    await expect.poll(async () => (await scene(page)).shapes).toEqual(modified.shapes);
  }
  expect(errors).toEqual([]);
});

test("invalid face deletion and cancel keep the original intact", async ({ page }) => {
  await addBox(page);
  const original = await scene(page);
  await chooseModifyTool(page, "Delete faces");
  const panel = page.getByRole("region", { name: "Delete faces", exact: true });
  await panel.getByRole("checkbox", { name: /Face \d+: Top/ }).check();
  await panel.getByRole("button", { name: "Preview modifier", exact: true }).click();
  await expect(panel.getByRole("alert")).toContainText("cannot be deleted", { timeout: 90000 });
  await expect(panel.getByRole("button", { name: "Apply modifier", exact: true })).toBeDisabled();
  await panel.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await scene(page)).shapes).toEqual(original.shapes);
});

test("changing settings invalidates a preview before it can be saved", async ({ page }) => {
  await addBox(page);
  await chooseModifyTool(page, "Offset body");
  const panel = page.getByRole("region", { name: "Offset body", exact: true });
  await panel.getByRole("button", { name: "Preview modifier", exact: true }).click();
  await expect(panel.getByRole("button", { name: "Apply modifier", exact: true })).toBeEnabled();
  await panel.getByLabel("Body offset (mm)", { exact: true }).fill("2");
  await expect(panel.getByRole("button", { name: "Apply modifier", exact: true })).toBeDisabled();
  await panel.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await scene(page)).shapes[0].kind).toBe("box");
});

test("canceling a running modifier cannot commit a late result", async ({ page }) => {
  await addBox(page);
  const before = (await scene(page)).shapes;
  await chooseModifyTool(page, "Surface texture");
  const panel = page.getByRole("region", { name: "Surface texture", exact: true });
  await panel.getByRole("button", { name: "Preview modifier", exact: true }).click();
  await panel.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(panel).toHaveCount(0);
  await chooseModifyTool(page, "Offset body");
  await expect(page.getByRole("region", { name: "Offset body", exact: true })).toBeVisible();
  expect((await scene(page)).shapes).toEqual(before);
});

test("text relief is prepared locally and previewed without changing the source", async ({ page }) => {
  await addBox(page);
  await chooseModifyTool(page, "Surface texture");
  const panel = page.getByRole("region", { name: "Surface texture", exact: true });
  await panel.getByLabel("Texture pattern", { exact: true }).selectOption("text");
  await panel.getByLabel("Texture text", { exact: true }).fill("CAD");
  await panel.getByLabel("Texture spacing (mm)", { exact: true }).fill("20");
  await panel.getByRole("button", { name: "Preview modifier", exact: true }).click();
  await expect(panel.getByRole("button", { name: "Apply modifier", exact: true })).toBeEnabled();
  expect((await scene(page)).shapes[0].kind).toBe("box");
  await panel.getByRole("button", { name: "Cancel", exact: true }).click();
});

test("local image height maps produce a preview", async ({ page }) => {
  await addBox(page);
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 16;
    const context = canvas.getContext("2d")!; context.fillStyle = "white"; context.fillRect(0, 0, 8, 16);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await chooseModifyTool(page, "Surface texture");
  const panel = page.getByRole("region", { name: "Surface texture", exact: true });
  await panel.getByLabel("Texture pattern", { exact: true }).selectOption("image");
  await panel.getByLabel("Texture spacing (mm)", { exact: true }).fill("20");
  await panel.getByLabel("Texture height map", { exact: true }).setInputFiles({ name: "relief.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") });
  await expect(panel.getByRole("status")).toHaveText("Height map loaded locally");
  await panel.getByRole("button", { name: "Preview modifier", exact: true }).click();
  await expect(panel.getByRole("button", { name: "Apply modifier", exact: true })).toBeEnabled();
  await panel.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await scene(page)).shapes[0].kind).toBe("box");
});

test("new modifier panels do not stay active behind an existing tool", async ({ page }) => {
  await addBox(page);
  await chooseModifyTool(page, "Offset body");
  await expect(page.getByRole("region", { name: "Offset body", exact: true })).toBeVisible();
  await chooseModifyTool(page, "Mirror");
  await expect(page.getByRole("region", { name: "Offset body", exact: true })).toHaveCount(0);
  await chooseModifyTool(page, "Offset body");
  await expect(page.getByRole("region", { name: "Offset body", exact: true })).toBeVisible();
  await chooseModifyTool(page, "Fillet");
  await expect(page.getByRole("region", { name: "Offset body", exact: true })).toHaveCount(0);
});

test("modifier controls remain usable on a phone-sized screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await addBox(page);
  await chooseModifyTool(page, "Offset body");
  const panel = page.getByRole("region", { name: "Offset body", exact: true });
  await expect(panel).toBeInViewport();
  await panel.getByRole("button", { name: "Preview modifier", exact: true }).click();
  await expect(panel.getByRole("button", { name: "Apply modifier", exact: true })).toBeEnabled();
  await panel.getByRole("button", { name: "Apply modifier", exact: true }).click();
  await expect(panel).toHaveCount(0);
  expect((await scene(page)).shapes[0].cadBrepLength).toBeGreaterThan(0);
});
