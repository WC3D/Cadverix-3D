import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { strFromU8, unzipSync } from "fflate";

const fixturePath = "tests/fixtures/pcb-led-switch.sfpcb";
const state = async (page: Page) => JSON.parse(await page.locator("[data-codex-state]").textContent() ?? "{}");
async function loadCircuit(page: Page, mutate?: (source: any) => void) {
  const source = JSON.parse(await readFile(fixturePath, "utf8"));
  mutate?.(source);
  await page.locator("section.pcb-workspace > input[type=file]").setInputFiles({ name: "Switch and LED.sfpcb", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(source)) });
  await expect.poll(async () => (await state(page)).pcbBoards.at(-1)?.parts).toBe(source.scene.parts.length);
  return source;
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const fetch = window.fetch.bind(window);
    window.fetch = (input, init) => /\/api\/(?:cadverix|sketchforge)-mcp/.test(String(input)) ? Promise.resolve(new Response("", { status: 404 })) : fetch(input, init);
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Create new 3D design", exact: true }).click();
  await page.getByRole("tab", { name: "PCB", exact: true }).click();
});

test("clicking and keyboard-toggling a switch lights the wired LED without editing the PCB", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
  const source = await loadCircuit(page);
  const before = (await state(page)).pcbBoards;
  await page.getByRole("button", { name: "Test circuit", exact: true }).click();
  const panel = page.getByRole("complementary", { name: "DC circuit test", exact: true });
  const led = page.locator('.circuit-part[data-led-state]');
  await expect(led).toHaveAttribute("data-led-state", "off");
  const button = page.getByRole("button", { name: "SW1 Pushbutton", exact: true });
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect(led).toHaveAttribute("data-led-state", "on");
  await expect(panel.getByRole("status")).toContainText("D1: ON");
  await expect(panel.getByRole("status")).toContainText("9.41 mA");
  expect(await led.locator(".circuit-part-artwork").evaluate((node) => getComputedStyle(node).filter)).toContain("drop-shadow");
  await button.focus(); await page.keyboard.press("Space");
  await expect(led).toHaveAttribute("data-led-state", "off");
  await panel.getByRole("button", { name: "SW1: open", exact: true }).click();
  await expect(led).toHaveAttribute("data-led-state", "on");
  await page.keyboard.press("Delete");
  expect((await state(page)).pcbBoards).toEqual(before);
  await expect(page.locator(".circuit-part")).toHaveCount(4);
  await expect.poll(async () => (await state(page)).shapes.some((shape: any) => shape.pcbInstance?.revision && shape.pcbInstance.revision !== "pending")).toBe(true);
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save combined SKF", exact: true }).click();
  const saved = await readFile((await (await downloaded).path())!);
  const manifest = JSON.parse(strFromU8(unzipSync(saved)["project.json"]));
  const active = manifest.states.find((entry: any) => entry.id === manifest.sceneStateId);
  expect(active.electronics.boards[0].scene.parts).toEqual(source.scene.parts);
  expect(JSON.stringify(active.electronics)).not.toContain("closedSwitches");
  await page.reload();
  await page.getByRole("tab", { name: "PCB", exact: true }).click();
  await page.getByRole("button", { name: "Test circuit", exact: true }).click();
  await expect(page.locator('.circuit-part[data-led-state]')).toHaveAttribute("data-led-state", "off");
  expect(errors).toEqual([]);
});

test("unsupported circuits do not show a false LED result, and unsafe current is explicit", async ({ page }) => {
  await loadCircuit(page, (source) => { source.scene.parts[1].value = "0.01 Ω"; });
  await page.getByRole("button", { name: "Test circuit", exact: true }).click();
  let panel = page.getByRole("complementary", { name: "DC circuit test", exact: true });
  await panel.getByRole("button", { name: "SW1: open", exact: true }).click();
  await expect(panel.getByRole("alert")).toContainText("20 mA");
  await expect(panel.getByRole("status")).toContainText("OVERCURRENT");
  await panel.getByRole("button", { name: "Stop circuit test", exact: true }).click();
  await loadCircuit(page, (source) => { source.scene.parts.push({ ...source.scene.parts[1], id: "capacitor", reference: "C1", kind: "capacitor", value: "100 µF", footprint: "Radial 2.5 mm", x: 1000, y: 500 }); });
  await page.getByRole("button", { name: "Test circuit", exact: true }).click();
  panel = page.getByRole("complementary", { name: "DC circuit test", exact: true });
  await expect(panel.getByRole("alert")).toContainText("Not simulated: C1");
  await expect(page.locator('.circuit-part[data-led-state]')).toHaveAttribute("data-led-state", "unavailable");
});

for (const width of [1440, 390]) test(`PCB theme settings and test controls fit ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await loadCircuit(page);
  const toolbar = page.locator(".toolbar-mode-content.pcb");
  const background = (selector: string) => page.locator(selector).first().evaluate((node) => getComputedStyle(node).backgroundColor);
  let previousGrid: unknown;
  for (const preset of ["light", "sketchforge", "inventor"]) {
    await toolbar.getByRole("button", { name: "Settings", exact: true }).click();
    const settings = page.getByRole("dialog", { name: "Workspace settings", exact: true });
    await settings.getByRole("combobox", { name: "Theme preset", exact: true }).selectOption(preset);
    await expect(page.locator(".circuit-part")).toHaveCount(4);
    expect((await state(page)).pcbBoards.at(-1).parts).toBe(4);
    expect(await background(".pcb-workspace-modal-card")).toBe(await background(".pcb-project-status"));
    const bounds = (await page.locator(".pcb-workspace-modal-card").boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(900);
    await settings.getByRole("button", { name: "Close settings", exact: true }).first().click();
    expect(await background(".circuit-workspace")).toBe(await background("section.pcb-workspace"));
    const grid = await page.locator(".circuit-grid-layer").evaluate((node) => (node as HTMLCanvasElement).getContext("2d")!.strokeStyle);
    if (previousGrid) expect(grid).not.toBe(previousGrid);
    previousGrid = grid;
  }
  await toolbar.getByRole("button", { name: "Test circuit", exact: true }).click();
  const panel = page.getByRole("complementary", { name: "DC circuit test", exact: true });
  const bounds = (await panel.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(width); expect(bounds.y + bounds.height).toBeLessThanOrEqual(900);
  expect(await background(".pcb-test-panel")).toBe(await background(".pcb-project-status"));
  await panel.getByRole("button", { name: "SW1: open", exact: true }).click();
  await expect(panel.getByRole("status")).toContainText("D1: ON");
  await panel.getByRole("button", { name: "Stop circuit test", exact: true }).click();
  await toolbar.getByRole("button", { name: "Board", exact: true }).click();
  await toolbar.getByRole("button", { name: "View in 3D", exact: true }).click();
  await expect(page.getByRole("region", { name: "Board 3D preview", exact: true })).toBeVisible();
  expect(await background(".board-3d-header")).toBe(await background(".pcb-project-status"));
  await page.getByRole("button", { name: "Close 3D preview", exact: true }).click();
  await page.reload();
  await page.getByRole("tab", { name: "PCB", exact: true }).click();
  await toolbar.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Theme preset", exact: true })).toHaveValue("inventor");
});
