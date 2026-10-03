import { expect, test } from "@playwright/test";
import type { CadModifierWorkerRequest, CadModifierWorkerResponse } from "../../apps/web/src/lib/cadModifierTypes";

type Probe = Window & {
  rimReady: Extract<CadModifierWorkerResponse, { type: "ready" }>;
  rimRequestedEdges?: number[];
  rimSourceVolume: number;
  rimResult?: { type: string; message?: string; applied: number; skipped: number; volume?: number; brep?: boolean };
};

// The user's project remains outside the repository. Normal browser runs skip
// this optional regression; synthetic rim geometry is covered by unit tests.
const project = process.env.CADVERIX_CAD_REPRO_PROJECT ?? process.env.SKETCHFORGE_CAD_REPRO_PROJECT;
test.use({ viewport: { width: 1366, height: 1024 } });
for (const kind of ["Chamfer", "Fillet"] as const) for (const multiSelect of [false, true]) test(`${kind} previews and applies the imported door mesh outer rim (Multi ${multiSelect})`, async ({ page }) => {
  test.skip(!project, "Set CADVERIX_CAD_REPRO_PROJECT to the local door SKF fixture.");
  test.setTimeout(180_000);
  await page.addInitScript(() => {
    const probe = window as Probe;
    const volume = (positions: Float32Array, indices: Uint32Array) => {
      let sum = 0;
      for (let i = 0; i < indices.length; i += 3) {
        const a = indices[i]! * 3, b = indices[i + 1]! * 3, c = indices[i + 2]! * 3;
        sum += positions[a]! * (positions[b + 1]! * positions[c + 2]! - positions[b + 2]! * positions[c + 1]!)
          + positions[a + 1]! * (positions[b + 2]! * positions[c]! - positions[b]! * positions[c + 2]!)
          + positions[a + 2]! * (positions[b]! * positions[c + 1]! - positions[b + 1]! * positions[c]!);
      }
      return Math.abs(sum / 6);
    };
    const Base = window.Worker;
    window.Worker = class extends Base {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        this.addEventListener("message", ({ data }: MessageEvent<CadModifierWorkerResponse>) => {
          if (data.type === "ready") probe.rimReady = data;
          if (data.type === "preview") probe.rimResult = { type: data.type, applied: data.appliedEdgeIds.length, skipped: data.skippedEdgeIds.length, volume: volume(data.positions, data.indices), brep: Boolean(data.brep) };
          if (data.type === "error") probe.rimResult = { type: data.type, message: data.message, applied: 0, skipped: 0 };
        });
      }
      postMessage(message: unknown, transfer?: Transferable[]) {
        const request = message as CadModifierWorkerRequest;
        if (request.type === "prepare" && request.parts[0]?.positions && request.parts[0].indices) probe.rimSourceVolume = volume(request.parts[0].positions, request.parts[0].indices);
        if (request.type === "preview") probe.rimRequestedEdges = [...request.edgeIds];
        super.postMessage(message, transfer ?? []);
      }
    };
  });
  await page.goto("/?editor=1");
  await page.locator('input[type="file"][accept=".skf,.lyl"]').setInputFiles(project!);
  const row = page.locator(".scene-shape-row").filter({ hasText: "Bifold_Door_Hole_Repair" });
  await expect(row).toBeVisible({ timeout: 60_000 });
  await row.click();
  await page.keyboard.press("5");
  await page.keyboard.press("o");
  await page.keyboard.press("Shift+f");
  if (multiSelect) await page.getByRole("button", { name: "Multi-select", exact: true }).tap();
  await page.getByRole("button", { name: kind, exact: true }).click();
  await expect(page.getByRole("button", { name: "All sharp edges", exact: true })).toBeEnabled({ timeout: 60_000 });
  const selected = await page.evaluate(() => {
    const probe = window as Probe;
    const { edges, selectableEdgeIds } = probe.rimReady;
    const maxY = Math.max(...edges.flatMap((edge) => edge.points.filter((_, i) => i % 3 === 1)));
    const top = edges.filter((edge) => selectableEdgeIds.includes(edge.id) && edge.points.filter((_, i) => i % 3 === 1).every((y) => Math.abs(y - maxY) < 0.001));
    const groups: typeof edges[] = [];
    const remaining = new Set(top);
    while (remaining.size) {
      const group = [remaining.values().next().value!]; remaining.delete(group[0]!);
      for (let i = 0; i < group.length; i++) {
        const a = group[i]!;
        for (const b of remaining) {
          if (![a.points.slice(0, 3), a.points.slice(-3)].some((p) => [b.points.slice(0, 3), b.points.slice(-3)].some((q) => Math.hypot(...p.map((v, j) => v - q[j]!)) < 0.001))) continue;
          group.push(b); remaining.delete(b);
        }
      }
      groups.push(group);
    }
    const outer = groups.sort((a, b) => Math.max(...b.map(e => e.points[0]!)) - Math.max(...a.map(e => e.points[0]!)))[0]!;
    return outer.length;
  });
  // At this fixed viewport, Top + orthographic + focus frames the fixture's
  // outer top rim at this point. Exercise actual picking and tangent expansion;
  // do not replace the worker request's edge list with a hand-built selection.
  await page.touchscreen.tap(826, 444);
  await expect.poll(() => page.evaluate(() => (window as Probe).rimResult?.type), { timeout: 120_000 }).toBeDefined();
  const { result, original } = await page.evaluate(() => ({ result: (window as Probe).rimResult!, original: (window as Probe).rimSourceVolume }));
  expect(result.type, result.message).toBe("preview");
  expect(await page.evaluate(() => (window as Probe).rimRequestedEdges?.length)).toBe(selected);
  expect(result.applied).toBe(selected);
  expect(result.skipped).toBe(0);
  expect(result.brep).toBe(true);
  expect(result.volume!).toBeLessThan(original - 1);
  expect(result.volume!).toBeGreaterThan(original * 0.8);
  await page.locator(".edge-modifier-panel").getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.locator(".edge-modifier-panel")).toHaveCount(0);
  await expect.poll(async () => {
    const scene = JSON.parse((await page.locator("[data-codex-state]").textContent())!);
    return scene.shapes.find((shape: { name: string }) => shape.name === "Bifold_Door_Hole_Repair")?.edgeTreatments.length;
  }).toBe(1);
});
