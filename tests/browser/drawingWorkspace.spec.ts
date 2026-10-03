import { expect, test, type Page } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";
import path from "node:path";

async function tapPaper(page: Page, x: number, y: number) {
  const screen = await page.locator(".drawing-paper-svg").evaluate((node, point) => {
    const matrix = (node as SVGSVGElement).getScreenCTM()!;
    const p = new DOMPoint(point.x, point.y).matrixTransform(matrix);
    return { x: p.x, y: p.y };
  }, { x, y });
  await page.touchscreen.tap(screen.x, screen.y);
}

async function revision(page: Page) {
  return page.evaluate(() => {
    const id = new URL(location.href).searchParams.get("project");
    return JSON.parse(localStorage.getItem("sketchForge.projects") ?? "[]").find((p: { id: string }) => p.id === id)?.revision ?? 0;
  });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const fetch = window.fetch.bind(window);
    window.fetch = (input, init) => /\/api\/(?:cadverix|sketchforge)-mcp/.test(String(input)) ? Promise.resolve(new Response("", { status: 404 })) : fetch(input, init);
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Create new 3D design", exact: true }).click();
  await expect(page).toHaveURL(/project=/);
});

test("places model views, measures at model scale, exports and restores the drawing", async ({ page, browserName }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.getByRole("button", { name: "Add shape", exact: true }).tap();
  await page.getByRole("button", { name: "Box", exact: true }).tap();
  await page.getByRole("tab", { name: "Drawing", exact: true }).tap();
  await expect(page.locator(".drawing-paper-svg")).toHaveAttribute("viewBox", "0 0 297 210");
  await page.getByRole("button", { name: "Add view", exact: true }).click();
  await expect(page.locator('[data-drawing-kind="view"]')).toHaveCount(1);
  const initialX = Number(await page.getByRole("spinbutton", { name: "View X (mm)", exact: true }).inputValue());
  const viewBounds = (await page.locator('[data-drawing-kind="view"] rect[data-drawing-ui]').boundingBox())!;
  await page.mouse.move(viewBounds.x + viewBounds.width / 2, viewBounds.y + viewBounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(viewBounds.x + viewBounds.width / 2 + 30, viewBounds.y + viewBounds.height / 2 + 15, { steps: 4 });
  await page.mouse.up();
  await expect.poll(async () => Number(await page.getByRole("spinbutton", { name: "View X (mm)", exact: true }).inputValue())).toBeGreaterThan(initialX + 1);
  await page.getByRole("combobox", { name: "Drawing tool", exact: true }).selectOption("aligned");
  const corners = await page.locator('[data-drawing-kind="view"] path[stroke="#172333"]').evaluate((node) => {
    const path = node as SVGGraphicsElement;
    const box = path.getBBox(), matrix = path.getScreenCTM()!;
    return [[box.x, box.y], [box.x + box.width, box.y]].map(([x, y]) => {
      const p = new DOMPoint(x, y).matrixTransform(matrix); return { x: p.x, y: p.y };
    });
  });
  for (const p of corners) await page.touchscreen.tap(p.x, p.y);
  await tapPaper(page, 154, 58);
  await expect(page.locator("[data-dimension-label]")).toHaveText("20.00");
  await page.locator(".drawing-view-list").getByRole("button", { name: "Box — Front", exact: true }).click();
  await page.getByRole("spinbutton", { name: "View scale", exact: true }).fill("0.5");
  await page.getByRole("spinbutton", { name: "View scale", exact: true }).press("Enter");
  await expect(page.locator("[data-dimension-label]")).toHaveText("20.00");
  const oldRevision = await revision(page);
  await page.getByRole("spinbutton", { name: "View rotation Y (deg)", exact: true }).fill("45");
  await page.getByRole("spinbutton", { name: "View rotation Y (deg)", exact: true }).press("Enter");
  await expect(page.locator("[data-dimension-label]")).toHaveText("20.00");
  await page.getByRole("textbox", { name: "Drawing title", exact: true }).fill('Valve <check> & "test"');
  await expect.poll(() => revision(page)).toBeGreaterThan(oldRevision);

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "SVG", exact: true }).click();
  const stream = await (await download).createReadStream();
  const chunks: Buffer[] = []; for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const svg = Buffer.concat(chunks).toString("utf8");
  expect(svg).toContain('width="297mm"'); expect(svg).toContain('height="210mm"');
  expect(svg).toContain("20.00"); expect(svg).not.toContain("data-drawing-ui=");
  expect(svg).toContain("&lt;check&gt;"); expect(svg).not.toContain("<check>");
  if (browserName === "chromium") {
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    expect(pdf.toString("latin1").match(/\/Type\s*\/Page\b/g)).toHaveLength(1);
    const size = pdf.toString("latin1").match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/);
    expect(size).not.toBeNull();
    expect(Number(size![1])).toBeCloseTo(297 * 72 / 25.4, 0);
    expect(Number(size![2])).toBeCloseTo(210 * 72 / 25.4, 0);
  }
  await page.reload();
  await page.getByRole("tab", { name: "Drawing", exact: true }).click();
  await expect(page.locator('[data-drawing-kind="view"]')).toHaveCount(1);
  await expect(page.locator("[data-dimension-label]")).toHaveText("20.00");
  await page.locator(".drawing-view-list").getByRole("button", { name: "Box — Custom", exact: true }).click();
  await expect(page.getByRole("spinbutton", { name: "View rotation Y (deg)", exact: true })).toHaveValue("45");
  const nativeDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save SKF", exact: true }).click();
  const nativeStream = await (await nativeDownload).createReadStream();
  const nativeChunks: Buffer[] = []; for await (const chunk of nativeStream!) nativeChunks.push(Buffer.from(chunk));
  const data = JSON.parse(strFromU8(unzipSync(Buffer.concat(nativeChunks))["project.json"]!));
  expect(data.formatVersion).toBe(3); expect(data.editor.workspace.drawing.dimensions).toHaveLength(1);
  const originalUrl = page.url();
  await page.locator('input[type="file"][accept=".skf,.lyl"]').setInputFiles({ name: "drawing-roundtrip.skf", mimeType: "application/zip", buffer: Buffer.concat(nativeChunks) });
  await expect.poll(() => page.url()).not.toBe(originalUrl);
  await page.getByRole("tab", { name: "Drawing", exact: true }).click();
  await expect(page.locator("[data-dimension-label]")).toHaveText("20.00");
  await page.getByRole("tab", { name: "Geometry", exact: true }).click();
  await page.locator(".scene-shape-row").filter({ hasText: "Box" }).click();
  const width = page.locator(".range-property").filter({ has: page.locator(".range-property-name", { hasText: /^Width$/ }) }).locator('input[type="text"]');
  await width.fill("30"); await width.press("Enter");
  await page.getByRole("tab", { name: "Drawing", exact: true }).click();
  await expect(page.getByText("Dimensions need review", { exact: true })).toBeVisible();
  await expect(page.locator("[data-dimension-label]")).toHaveCount(0);
  await page.getByRole("button", { name: "SVG", exact: true }).click();
  await expect(page.locator(".drawing-status")).toContainText("Source models changed");
  await page.locator(".drawing-view-list").getByRole("button", { name: "Box — Custom", exact: true }).click();
  await page.keyboard.press("Delete");
  await expect(page.locator('[data-drawing-kind="view"]')).toHaveCount(0);
  await page.getByRole("tab", { name: "Geometry", exact: true }).click();
  await expect.poll(async () => JSON.parse((await page.locator("[data-codex-state]").textContent())!).shapeCount).toBe(1);
  expect(errors).toEqual([]);
});

test("ANSI templates, paper geometry, dimensions and drawing undo stay separate from 3D", async ({ page }) => {
  await page.getByRole("tab", { name: "Drawing", exact: true }).click();
  await page.getByRole("combobox", { name: "Drawing template", exact: true }).selectOption("ANSI A");
  await expect(page.locator(".drawing-paper-svg")).toHaveAttribute("viewBox", "0 0 279.4 215.9");
  await expect(page.getByRole("combobox", { name: "Drawing projection convention" })).toHaveValue("third");
  await page.getByRole("combobox", { name: "Drawing tool", exact: true }).selectOption("rectangle");
  await tapPaper(page, 40, 40); await tapPaper(page, 65, 60);
  await expect(page.locator('[data-drawing-kind="entity"]')).toHaveCount(1);
  await page.getByRole("combobox", { name: "Drawing tool", exact: true }).selectOption("horizontal");
  await tapPaper(page, 40, 40); await tapPaper(page, 65, 40); await tapPaper(page, 52, 30);
  await expect(page.locator("[data-dimension-label]")).toHaveText("0.984");
  await page.getByRole("button", { name: "Drawing undo", exact: true }).click();
  await expect(page.locator("[data-dimension-label]")).toHaveCount(0);
  await page.getByRole("button", { name: "Drawing redo", exact: true }).click();
  await expect(page.locator("[data-dimension-label]")).toHaveText("0.984");
  await page.getByRole("combobox", { name: "Drawing tool", exact: true }).selectOption("circle");
  await tapPaper(page, 110, 70); await tapPaper(page, 120, 70);
  await page.getByRole("combobox", { name: "Drawing tool", exact: true }).selectOption("diameter");
  await tapPaper(page, 120, 70); await tapPaper(page, 140, 50);
  await expect(page.locator("[data-dimension-label]").filter({ hasText: "Ø0.787" })).toBeVisible();
  expect(Number(await page.locator("[data-dimension-label]").filter({ hasText: "Ø0.787" }).getAttribute("x"))).toBeCloseTo(140, 0);
  expect(Number(await page.locator("[data-dimension-label]").filter({ hasText: "Ø0.787" }).getAttribute("y"))).toBeCloseTo(50, 0);
  await page.getByRole("combobox", { name: "Drawing tool", exact: true }).selectOption("angle");
  await tapPaper(page, 40, 60); await tapPaper(page, 40, 40); await tapPaper(page, 65, 40); await tapPaper(page, 50, 50);
  await expect(page.locator("[data-dimension-label]").filter({ hasText: "90.0°" })).toBeVisible();
  await page.getByRole("tab", { name: "Geometry", exact: true }).click();
  await expect.poll(async () => JSON.parse((await page.locator("[data-codex-state]").textContent())!).shapeCount).toBe(0);
  await page.getByRole("tab", { name: "Drawing", exact: true }).click();
  await expect(page.locator('[data-drawing-kind="entity"]')).toHaveCount(2);
});

test("the three-view placement follows ANSI and ISO conventions", async ({ page, browserName }) => {
  await page.getByRole("button", { name: "Add shape", exact: true }).click();
  await page.getByRole("button", { name: "Box", exact: true }).click();
  if (process.env.CADVERIX_CAPTURE_DRAWING_DOCS && browserName === "chromium") {
    for (const [label, value] of [["Width", "40"], ["Length", "25"], ["Height", "15"]]) {
      const input = page.locator(".range-property").filter({ has: page.locator(".range-property-name", { hasText: new RegExp(`^${label}$`) }) }).locator('input[type="text"]');
      await input.fill(value!); await input.press("Enter");
    }
  }
  await page.getByRole("tab", { name: "Drawing", exact: true }).click();
  await page.getByRole("combobox", { name: "Drawing template", exact: true }).selectOption("ANSI B");
  await page.getByRole("button", { name: "3 views", exact: true }).click();
  await expect(page.locator('[data-drawing-kind="view"]')).toHaveCount(3);
  const positions = async () => {
    const result: Record<string, { x: number; y: number }> = {};
    for (const name of ["Front", "Top", "Right"]) {
      await page.locator(".drawing-view-list").getByRole("button", { name: `Box — ${name}`, exact: true }).click();
      result[name] = { x: Number(await page.getByRole("spinbutton", { name: "View X (mm)", exact: true }).inputValue()), y: Number(await page.getByRole("spinbutton", { name: "View Y (mm)", exact: true }).inputValue()) };
    }
    return result;
  };
  const ansi = await positions();
  expect(ansi.Top!.y).toBeLessThan(ansi.Front!.y); expect(ansi.Right!.x).toBeGreaterThan(ansi.Front!.x);
  if (process.env.CADVERIX_CAPTURE_DRAWING_DOCS && browserName === "chromium") {
    for (const name of ["Front", "Top", "Right"]) {
      await page.locator(".drawing-view-list").getByRole("button", { name: `Box — ${name}`, exact: true }).click();
      const scale = page.getByRole("spinbutton", { name: "View scale", exact: true });
      await scale.fill("4"); await scale.press("Enter");
    }
    await page.getByRole("textbox", { name: "Drawing title", exact: true }).fill("CADVERIX · MODEL STUDY");
    await page.getByRole("combobox", { name: "Drawing tool", exact: true }).selectOption("aligned");
    const corners = await page.locator('[data-drawing-kind="view"]').filter({ hasText: "Box — Front" }).locator('path[stroke="#172333"]').evaluate((node) => {
      const p = node as SVGGraphicsElement, box = p.getBBox(), matrix = p.getScreenCTM()!;
      return [[box.x, box.y + box.height], [box.x + box.width, box.y + box.height]].map(([x, y]) => { const point = new DOMPoint(x, y).matrixTransform(matrix); return { x: point.x, y: point.y }; });
    });
    for (const p of corners) await page.touchscreen.tap(p.x, p.y);
    await tapPaper(page, ansi.Front!.x, ansi.Front!.y + 55);
    await page.getByRole("combobox", { name: "Drawing tool", exact: true }).selectOption("select");
    await tapPaper(page, 360, 30);
    await page.locator(".drawing-properties").evaluate((node) => { node.scrollTop = 0; });
    await page.screenshot({ path: path.resolve("docs/media/cadverix-drawing-sheet.png") });
  }
  await page.getByRole("combobox", { name: "Drawing projection convention" }).selectOption("first");
  const iso = await positions();
  expect(iso.Top!.y).toBeGreaterThan(iso.Front!.y); expect(iso.Right!.x).toBeLessThan(iso.Front!.x);
});

test.describe("phone drawing", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("keeps the sheet, tools and collapsible properties usable", async ({ page }) => {
    await page.getByRole("tab", { name: "Drawing", exact: true }).tap();
    await expect(page.locator(".drawing-paper-svg")).toBeVisible();
    await expect(page.locator(".drawing-properties")).not.toBeVisible();
    await page.getByRole("combobox", { name: "Drawing tool", exact: true }).selectOption("rectangle");
    await tapPaper(page, 40, 40); await tapPaper(page, 80, 65);
    await expect(page.locator('[data-drawing-kind="entity"]')).toHaveCount(1);
    await page.getByRole("button", { name: "Drawing properties", exact: true }).tap();
    await expect(page.locator(".drawing-properties")).toBeVisible();
    expect((await page.locator(".drawing-properties").boundingBox())!.height).toBeLessThan(844 * 0.33);
    await page.getByRole("button", { name: "Drawing properties", exact: true }).tap();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.getByRole("button", { name: "Drawing undo", exact: true }).tap();
    await expect(page.locator('[data-drawing-kind="entity"]')).toHaveCount(0);
  });
});
