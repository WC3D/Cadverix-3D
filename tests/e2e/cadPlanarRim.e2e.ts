import { describe, expect, it } from "vitest";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { OcctKernel } from "occt-wasm";
import { planarRimFilletPlan } from "@/lib/cadPlanarRim";
import { cutPlanarCadRim } from "@/lib/cadPlanarRimKernel";

describe("faceted rim round-over (real OCCT kernel)", () => {
  it("produces a circular fillet, preserves the lower body, and round-trips B-Rep", async () => {
    const wasm = join(dirname(fileURLToPath(import.meta.resolve("occt-wasm"))), "occt-wasm.wasm");
    const cad = await OcctKernel.init({ wasm });
    try {
      const n = 16, radius = 10, height = 10, fillet = 1;
      const polygon = Array.from({ length: n }, (_, i) => ({ x: radius * Math.cos(i * 2 * Math.PI / n), z: radius * Math.sin(i * 2 * Math.PI / n) }));
      const wire = cad.makeWire(polygon.map((p, i) => cad.makeLineEdge({ ...p, y: 0 }, { ...polygon[(i + 1) % n]!, y: 0 })));
      const solid = cad.extrude(cad.makeFace(wire), 0, height, 0);
      const edges = polygon.map((p, i) => { const q = polygon[(i + 1) % n]!; return [p.x, height, p.z, q.x, height, q.z]; });
      const source = [...edges, ...polygon.map((p) => [p.x, height, p.z, p.x, 0, p.z])];
      const plan = planarRimFilletPlan(edges, source, fillet, edges.map(() => 0))!;
      expect(plan.fits).toBe(true);
      const rounded = cutPlanarCadRim(cad, solid, plan);
      expect(cad.isValid(rounded)).toBe(true);
      expect(cad.getSubShapes(rounded, "solid")).toHaveLength(1);
      const phi = Math.PI / n;
      const apothem = radius * Math.cos(phi);
      const point = (inset: number, y: number) => ({ x: (apothem - inset) * Math.cos(phi), y, z: (apothem - inset) * Math.sin(phi) });
      // At half-height of a unit fillet the circular inset is 1-sqrt(3/4),
      // unlike a chamfer's 0.5. These probes distinguish the resulting solids.
      expect(cad.containsPoint(rounded, point(0.15, 9.5))).toBe(true);
      expect(cad.containsPoint(rounded, point(0.11, 9.5))).toBe(false);
      expect(cad.containsPoint(rounded, point(0.01, 8.5))).toBe(true);
      expect(cad.containsPoint(rounded, point(-0.01, 8.5))).toBe(false);
      const removed = cad.getVolume(solid) - cad.getVolume(rounded);
      const expected = 2 * n * Math.tan(phi) * apothem * (1 - Math.PI / 4) - n * Math.tan(phi) * (5 / 3 - Math.PI / 2);
      expect(removed).toBeCloseTo(expected, 2);
      expect(cad.isValid(cad.fromBREP(cad.toBREP(rounded)))).toBe(true);
    } finally {
      cad.releaseAll();
    }
  });
});
