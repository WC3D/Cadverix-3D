import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createStarGeometry, normalizeStarInnerSize, normalizeStarOuterFillet, normalizeStarPoints, normalizeStarQuality, starMaxFilletRadii, starSettings } from "@/lib/starGeometry";

function meshStats(geometry: THREE.BufferGeometry) {
  const position = geometry.getAttribute("position");
  const uses = new Map<string, number>();
  const key = (i: number) => [position.getX(i), position.getY(i), position.getZ(i)].map((v) => v.toFixed(5)).join(",");
  let volume = 0;
  for (let i = 0; i + 2 < position.count; i += 3) {
    const p = [0, 1, 2].map((k) => [position.getX(i + k), position.getY(i + k), position.getZ(i + k)]);
    volume += p[0][0] * (p[1][1] * p[2][2] - p[1][2] * p[2][1]) + p[0][1] * (p[1][2] * p[2][0] - p[1][0] * p[2][2]) + p[0][2] * (p[1][0] * p[2][1] - p[1][1] * p[2][0]);
    const triangle = [key(i), key(i + 1), key(i + 2)];
    for (let e = 0; e < 3; e += 1) {
      const a = triangle[e], b = triangle[(e + 1) % 3], edge = a < b ? `${a}:${b}` : `${b}:${a}`;
      uses.set(edge, (uses.get(edge) ?? 0) + 1);
    }
  }
  return { volume: volume / 6, closed: [...uses.values()].every((count) => count === 2) };
}

describe("star geometry", () => {
  it.each([[5, 20, 0, 0], [6, 25, 3, 2], [3, 10, 1.5, 1.5], [5, 20, 50, 50]] as const)("creates a closed %i-point star", (starPoints, starInnerSize, starOuterFillet, starInnerFillet) => {
    const geometry = createStarGeometry({ width: 40, depth: 40, height: 10, starPoints, starInnerSize, starOuterFillet, starInnerFillet });
    const stats = meshStats(geometry);
    expect(stats.volume).toBeGreaterThan(0);
    expect(stats.closed).toBe(true);
    expect(geometry.boundingBox?.min.y).toBeCloseTo(0, 4);
    expect(geometry.boundingBox?.max.y).toBeCloseTo(10, 4);
  });

  it("normalizes star settings", () => {
    expect(normalizeStarPoints(2)).toBe(3);
    expect(normalizeStarPoints(100)).toBe(32);
    expect(normalizeStarInnerSize(undefined, 40)).toBe(20);
    expect(normalizeStarInnerSize(50, 40)).toBe(39.9);
    expect(normalizeStarOuterFillet(-2)).toBe(0);
    expect(normalizeStarQuality(100)).toBe(48);
    const limits = starMaxFilletRadii(40, 20, 5);
    expect(limits.maxOuterRadius).toBeGreaterThan(1);
    expect(limits.maxInnerRadius).toBeGreaterThan(1);
    expect(starSettings({ width: 30, depth: 30, starPoints: 8, starInnerSize: 15, starOuterFillet: 1.5, starInnerFillet: 1, starQuality: 24 })).toEqual({
      points: 8, innerSize: 15, outerFillet: 1.5, innerFillet: 1, quality: 24,
    });
  });
});
