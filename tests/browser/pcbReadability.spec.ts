import { expect, test, type Locator } from "@playwright/test";
import { readFile } from "node:fs/promises";

// Check rendered text/background pairs, including alpha and placeholders, not just theme variables.
async function readable(root: Locator) {
  const failures = await root.evaluate((panel) => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d")!;
    const color = (css: string) => { context.clearRect(0, 0, 1, 1); context.fillStyle = css; context.fillRect(0, 0, 1, 1); return Array.from(context.getImageData(0, 0, 1, 1).data); };
    const blend = (front: number[], back: number[], alpha = front[3] / 255) => [0, 1, 2].map((index) => front[index] * alpha + back[index] * (1 - alpha));
    const luminance = (rgb: number[]) => rgb.slice(0, 3).map((value) => { const s = value / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
    const issues: Array<{ text: string; element: string; ratio?: number; reason?: string; foreground?: string; background?: number[] }> = [];
    for (const element of [panel, ...panel.querySelectorAll("*")]) {
      if (!(element instanceof HTMLElement) || !element.getClientRects().length || element.closest(":disabled:not(.design-check-issue)") || getComputedStyle(element).visibility !== "visible") continue;
      let text = Array.from(element.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent).join(" ").trim();
      const field = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement;
      if (element instanceof HTMLInputElement && ["checkbox", "radio", "range", "hidden", "file", "color"].includes(element.type)) continue;
      if (field) text = element.value || "input text";
      if (!text) continue;
      const ancestors: Element[] = []; for (let current: Element | null = element; current; current = current.parentElement) ancestors.unshift(current);
      let background = [255, 255, 255], opacity = 1, gradient = false;
      for (const ancestor of ancestors) {
        const style = getComputedStyle(ancestor), paint = color(style.backgroundColor);
        if (paint[3] === 255) gradient = false;
        background = blend(paint, background);
        if (style.backgroundImage !== "none") gradient = true;
        opacity *= Number(style.opacity);
      }
      if (!opacity) continue;
      const check = (content: string, foreground: string, alpha = 1) => {
        const rgb = color(foreground), foregroundRgb = blend(rgb, background, rgb[3] / 255 * opacity * alpha);
        const a = luminance(foregroundRgb), b = luminance(background), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
        if (gradient || ratio < 4.5) issues.push({ text: content.slice(0, 70), element: `${element.tagName.toLowerCase()}.${element.className}`, ...(gradient ? { reason: "Text is over an unpaired gradient" } : { ratio: Number(ratio.toFixed(2)), foreground, background: background.map(Math.round) }) });
      };
      check(text, getComputedStyle(element).color);
      if ((element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) && element.placeholder) {
        const placeholder = getComputedStyle(element, "::placeholder"); check(`Placeholder: ${element.placeholder}`, placeholder.color, Number(placeholder.opacity));
      }
    }
    return issues.slice(0, 25);
  });
  expect(failures, "PCB text should have at least 4.5:1 contrast, including status labels and helper text").toEqual([]);
}

for (const preset of ["sketchforge", "light", "solidworks", "inventor"]) for (const width of [1366, 390]) test(`PCB menus remain readable in ${preset} at ${width}px`, async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width, height: 1024 });
  await page.addInitScript(() => {
    const fetch = window.fetch.bind(window);
    window.fetch = (input, init) => /\/api\/(?:cadverix|sketchforge)-mcp/.test(String(input)) ? Promise.resolve(new Response("", { status: 404 })) : fetch(input, init);
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Create new 3D design", exact: true }).click();
  await page.getByRole("tab", { name: "PCB", exact: true }).click();
  await page.getByRole("button", { name: "Create first PCB board", exact: true }).click();
  const toolbar = page.locator(".toolbar-mode-content.pcb");
  await toolbar.getByRole("button", { name: "Settings", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "Workspace settings", exact: true });
  await settings.getByRole("combobox", { name: "Theme preset", exact: true }).selectOption(preset);
  for (const section of ["Appearance", "Snapping", "Workspace"]) {
    await settings.getByRole("button", { name: section, exact: true }).click(); await readable(settings);
  }
  await settings.getByRole("button", { name: "Close settings", exact: true }).first().click();
  await readable(toolbar);
  await toolbar.getByRole("button", { name: "Check", exact: true }).hover(); await readable(toolbar);
  await toolbar.getByRole("button", { name: "Check", exact: true }).click();
  const report = page.getByRole("complementary", { name: "Design check report", exact: true });
  await expect(report.locator(".design-check-status.passed")).toBeVisible();
  const reportBounds = (await report.boundingBox())!;
  expect(reportBounds.x).toBeGreaterThanOrEqual(0); expect(reportBounds.x + reportBounds.width).toBeLessThanOrEqual(width);
  await readable(report);
  await report.getByRole("button", { name: "Run again", exact: true }).hover(); await readable(report);
  await report.getByRole("button", { name: "Close design check", exact: true }).click();
  await toolbar.getByRole("button", { name: "Add Part", exact: true }).click();
  const library = page.getByRole("complementary", { name: "Component library", exact: true });
  await readable(library);
  await library.locator(".part-library-item").first().hover(); await readable(library);
  await library.locator(".part-library-item").filter({ hasText: "Resistor" }).first().click();
  await readable(page.getByRole("complementary", { name: "Resistor properties", exact: true }));
  await toolbar.getByRole("button", { name: "Duplicate", exact: true }).click();
  await page.keyboard.press("Control+a");
  await toolbar.getByRole("button", { name: "Align", exact: true }).click();
  await readable(page.locator(".arrange-panel"));
  await page.locator(".arrange-panel > header button").click();
  await toolbar.getByRole("button", { name: "Board", exact: true }).click();
  await toolbar.getByRole("button", { name: "View in 3D", exact: true }).click();
  const preview = page.getByRole("region", { name: "Board 3D preview", exact: true });
  await readable(preview);
  await preview.getByRole("button", { name: "Settings", exact: true }).click(); await readable(preview);
  await preview.getByRole("button", { name: "Close 3D preview", exact: true }).click();
  await toolbar.getByRole("button", { name: "Circuit", exact: true }).click();
  await toolbar.getByRole("button", { name: "Manage boards / exports", exact: true }).click();
  await readable(page.getByRole("complementary", { name: "PCB board management", exact: true }));
  await page.getByRole("button", { name: "Close board manager", exact: true }).click();
  await toolbar.getByRole("button", { name: "Import", exact: true }).click();
  const transfer = page.locator(".pcb-transfer-panel"); await readable(transfer);
  await transfer.getByRole("button", { name: "Close import", exact: true }).click();
  await toolbar.getByRole("button", { name: "Export", exact: true }).click();
  for (const name of ["Board project", "Gerber", "KiCad", "SVG", "BOM"]) {
    await transfer.getByRole("radio", { name: new RegExp(`^${name}`) }).click(); await readable(transfer);
  }
  await transfer.getByRole("button", { name: "Close export", exact: true }).click();
  await toolbar.getByRole("button", { name: "Test circuit", exact: true }).click();
  const simulation = page.getByRole("complementary", { name: "DC circuit test", exact: true });
  await readable(simulation); await simulation.getByRole("button", { name: "Stop circuit test", exact: true }).click();
  const source = JSON.parse(await readFile("tests/fixtures/pcb-led-switch.sfpcb", "utf8"));
  source.scene.parts[2].reference = "R1"; source.scene.wires = []; source.scene.board.shapes[0].closed = false;
  await page.locator("section.pcb-workspace > input[type=file]").setInputFiles({ name: "Needs review.sfpcb", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(source)) });
  await expect(page.locator(".circuit-part")).toHaveCount(4);
  await toolbar.getByRole("button", { name: "Check", exact: true }).click();
  await expect(report.locator(".design-check-status.failed")).toBeVisible(); await readable(report);
  await report.getByRole("button", { name: "Close design check", exact: true }).click();
  await toolbar.getByRole("button", { name: "Export", exact: true }).click();
  await transfer.getByRole("radio", { name: /^Gerber/ }).click();
  await expect(transfer.locator(".pcb-export-warning")).toBeVisible(); await readable(transfer);
});
