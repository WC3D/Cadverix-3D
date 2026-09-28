import { describe, expect, it } from "vitest";
import { planarRimChamferPlan, planarRimFilletPlan } from "@/lib/cadPlanarRim";

function rim(radius = 10, count = 32, top = 10) {
  const points = Array.from({ length: count }, (_, i) => [radius * Math.cos(i * 2 * Math.PI / count), top, radius * Math.sin(i * 2 * Math.PI / count)]);
  const edges = points.map((point, i) => [...point, ...points[(i + 1) % count]!]);
  const source = [...points.flat(), ...points.flatMap(([x, , z]) => [x!, 0, z!])];
  return { points, edges, source };
}

describe("planar STL rim chamfer", () => {
  it("orders reversed/unordered facets and produces a one-millimeter inset at the original top plane", () => {
    const { edges, source } = rim();
    const mixed = edges.map((edge, i) => i % 2 ? [...edge.slice(3), ...edge.slice(0, 3)] : edge).reverse();
    const plan = planarRimChamferPlan(mixed, source, 1, 45)!;
    expect(plan.fits).toBe(true);
    expect(plan.bottom).toBeCloseTo(9);
    expect(plan.loop).toHaveLength(32);
    // Interpolate the extended loft at y=10, then measure the perpendicular
    // setback from the original polygon edge (not the radial vertex distance).
    const ratio = (plan.height - plan.bottom) / (plan.top - plan.bottom);
    for (let i = 0; i < plan.loop.length; i++) {
      const a = plan.loop[i]!, b = plan.loop[(i + 1) % plan.loop.length]!;
      const nextA = plan.topLoop[i]!, nextB = plan.topLoop[(i + 1) % plan.loop.length]!;
      const p = { x: ((a.x + b.x) * (1 - ratio) + (nextA.x + nextB.x) * ratio) / 2, z: ((a.z + b.z) * (1 - ratio) + (nextA.z + nextB.z) * ratio) / 2 };
      expect(((b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x)) / Math.hypot(b.x - a.x, b.z - a.z)).toBeCloseTo(1, 6);
    }
  });

  it("rejects inner rims, partial selections and non-horizontal loops", () => {
    const outer = rim(), inner = rim(5);
    expect(planarRimChamferPlan(inner.edges, outer.source, 1, 45)).toBeNull();
    expect(planarRimChamferPlan(outer.edges.slice(1), outer.source, 1, 45)).toBeNull();
    const tilted = outer.edges.map((edge, i) => i ? edge : [edge[0]!, 11, ...edge.slice(2)]);
    expect(planarRimChamferPlan(tilted, outer.source, 1, 45)).toBeNull();
  });

  it("reports oversized insets as unfit instead of falling back to the edge builder", () => {
    const { edges, source } = rim();
    expect(planarRimChamferPlan(edges, source, 11, 45)?.fits).toBe(false);
    expect(planarRimChamferPlan(edges, source, 1, 45)?.fits).toBe(true);
  });

  it("does not cut into nearby material outside the selected rim", () => {
    const { edges, source } = rim();
    expect(planarRimChamferPlan(edges, [...source, 15, 9.5, 0], 1, 45)?.fits).toBe(false);
    expect(planarRimChamferPlan(edges, [...source, 15, 10, 0], 1, 45)).toBeNull();
  });
});

describe("planar STL rim fillet", () => {
  it.each([0, -0.05, 0.15, "varying"] as const)("keeps circular radius and wall tangency for slope %s", (slope) => {
    const { points, edges } = rim();
    const count = points.length;
    const normals = points.map((a, i) => {
      const b = points[(i + 1) % count]!;
      const length = Math.hypot(b[0]! - a[0]!, b[2]! - a[2]!);
      return { x: -(b[2]! - a[2]!) / length, z: (b[0]! - a[0]!) / length };
    });
    const slopes = normals.map((normal) => slope === "varying" ? 0.02 + 0.015 * normal.x : slope);
    const bottom = points.map((point, i) => {
      const previous = (i + count - 1) % count;
      const a = normals[previous]!, b = normals[i]!;
      const dA = slopes[previous]! * 10, dB = slopes[i]! * 10;
      const determinant = a.x * b.z - a.z * b.x;
      return [point[0]! + (dA * b.z - a.z * dB) / determinant, 0, point[2]! + (a.x * dB - dA * b.x) / determinant];
    });
    const sourceEdges = [...edges, ...bottom.map((p, i) => [...p, ...bottom[(i + 1) % count]!]), ...points.map((p, i) => [...p, ...bottom[i]!])];
    const plan = planarRimFilletPlan(edges, sourceEdges, 1, slopes)!;
    expect(plan.fits).toBe(true);
    plan.profiles.forEach((profile, corner) => {
      expect(profile.knots.length).toBeLessThanOrEqual(4);
      for (let span = 0; span < profile.knots.length - 1; span++) {
        for (let j = 0; j <= 10; j++) {
          const u = j / 10, v = 1 - u;
          const t = profile.knots[span]! * v + profile.knots[span + 1]! * u;
          const coefficients = [v * v, 2 * v * u, u * u].map((coefficient, i) => coefficient * profile.weights[span * 2 + i]!);
          const denominator = coefficients.reduce((a, b) => a + b, 0);
          const p = [0, 1, 2].map((axis) => coefficients.reduce((sum, c, i) => sum + c * profile.poles[(span * 2 + i) * 3 + axis]!, 0) / denominator);
          for (const side of [(corner + count - 1) % count, corner]) {
            const normal = normals[side]!, origin = points[side]!;
            const d = (p[0]! - origin[0]!) * normal.x + (p[2]! - origin[2]!) * normal.z;
            const depth = 10 - p[1]!;
            const k = slopes[side]!;
            if (2 * Math.atan(t) < -Math.atan(k) - 1e-6) expect(d).toBeCloseTo(k * depth, 6);
            else expect(Math.hypot(d - (Math.sqrt(1 + k * k) + k), depth - 1)).toBeCloseTo(1, 6);
          }
        }
      }
    });
  });

  it("rejects unavailable wall planes rather than inventing a fillet radius", () => {
    const { edges } = rim();
    expect(planarRimFilletPlan(edges, edges, 1, [])).toBeNull();
    expect(planarRimFilletPlan(edges, edges, 1, edges.map(() => NaN))).toBeNull();
  });
});
