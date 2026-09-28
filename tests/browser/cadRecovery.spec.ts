import { expect, test } from "@playwright/test";

test("a faulted CAD worker is replaced and the next chamfer can preview", async ({ page }) => {
  const diagnostics: string[] = [];
  page.on("console", (message) => { if (message.text().startsWith("[SketchForge CAD]")) diagnostics.push(message.text()); });
  await page.addInitScript(() => {
    const Base = window.Worker;
    let faultInjected = false;
    window.Worker = class extends Base {
      postMessage(message: unknown, transfer?: Transferable[]) {
        const request = message as { type?: string; requestId: number };
        if (request.type === "preview" && !faultInjected) {
          faultInjected = true;
          queueMicrotask(() => this.dispatchEvent(new MessageEvent("message", {
            data: {
              type: "error", requestId: request.requestId, resetSession: true, message: "Test CAD memory fault",
              diagnostic: { phase: "building edge preview", operation: "chamfer", strategy: "native-edge", edgeIds: [0], amount: 1, rawMessage: "memory access out of bounds" },
            },
          })));
          return;
        }
        super.postMessage(message, transfer ?? []);
      }
      terminate() {
        document.documentElement.dataset.cadTerminations = String(Number(document.documentElement.dataset.cadTerminations ?? 0) + 1);
        super.terminate();
      }
    };
  });
  await page.goto("/?editor=1");
  await page.getByRole("button", { name: "Add shape", exact: true }).tap();
  await page.getByRole("button", { name: "Box", exact: true }).tap();
  const before = Number(await page.locator("html").getAttribute("data-cad-terminations") ?? 0);
  await page.getByRole("button", { name: "Chamfer", exact: true }).tap();
  await page.getByRole("button", { name: "All sharp edges", exact: true }).tap();
  await expect(page.locator(".edge-modifier-panel")).toHaveCount(0);
  await expect.poll(async () => Number(await page.locator("html").getAttribute("data-cad-terminations") ?? 0)).toBeGreaterThan(before);
  expect(diagnostics).toHaveLength(1);
  expect(diagnostics[0]).toContain("building edge preview");
  expect(diagnostics[0]).toContain("memory access out of bounds");
  await page.getByRole("button", { name: "Chamfer", exact: true }).tap();
  await page.getByRole("button", { name: "All sharp edges", exact: true }).tap();
  await expect.poll(async () => JSON.parse((await page.locator("[data-codex-state]").textContent())!).notice).toContain("preview ready");
});

test("mobile object Multi mode does not force single-edge selection in Chamfer", async ({ page }) => {
  await page.addInitScript(() => {
    window.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "touch" && !event.isTrusted) document.documentElement.dataset.replayedShift = String(event.shiftKey);
    }, true);
  });
  await page.goto("/?editor=1");
  await page.getByRole("button", { name: "Add shape", exact: true }).tap();
  await page.getByRole("button", { name: "Box", exact: true }).tap();
  await page.getByRole("button", { name: "Multi-select", exact: true }).tap();
  await page.getByRole("button", { name: "Chamfer", exact: true }).tap();
  await expect(page.getByRole("button", { name: "All sharp edges", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Multi-select", exact: true })).toHaveCount(0);
  await page.touchscreen.tap(600, 750);
  await expect(page.locator("html")).toHaveAttribute("data-replayed-shift", "false");
  await page.getByRole("button", { name: "Cancel chamfer", exact: true }).tap();
  await expect(page.getByRole("button", { name: "Multi-select", exact: true })).toHaveAttribute("aria-pressed", "true");
});
