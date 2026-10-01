import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildHeartContourPoints, createHeartGeometry, heartSettings, normalizeHeartQuality, normalizeHeartTipFillet } from "@/lib/heartGeometry";

function isClosed(geometry: THREE.BufferGeometry) {
  const position = geometry.getAttribute("position");
  const uses = new Map<string, number>();
  const key = (i: number) => [position.getX(i), position.getY(i), position.getZ(i)].map((v) => v.toFixed(5)).join(",");
  for (let i = 0; i < position.count; i += 3) for (let k = 0; k < 3; k += 1) {
    const a = key(i + k), b = key(i + ((k + 1) % 3)), edge = a < b ? `${a}:${b}` : `${b}:${a}`;
    uses.set(edge, (uses.get(edge) ?? 0) + 1);
  }
  return [...uses.values()].every((count) => count === 2);
}

describe("heart geometry", () => {
  it.each([0, 4])("creates a closed heart with a %i mm tip fillet", (heartTipFillet) => {
    const geometry = createHeartGeometry({ width: 40, depth: 40, height: 10, heartTipFillet, heartQuality: 32 });
    expect(isClosed(geometry)).toBe(true);
    expect(geometry.boundingBox?.max.y).toBeCloseTo(10, 4);
    if (heartTipFillet === 0) {
      expect((geometry.boundingBox?.max.x ?? 0) - (geometry.boundingBox?.min.x ?? 0)).toBeCloseTo(40, 3);
      expect((geometry.boundingBox?.max.z ?? 0) - (geometry.boundingBox?.min.z ?? 0)).toBeCloseTo(40, 3);
    }
  });

  it("normalizes heart settings", () => {
    expect(normalizeHeartTipFillet(-1)).toBe(0);
    expect(normalizeHeartTipFillet(50)).toBe(20);
    expect(normalizeHeartQuality(4)).toBe(16);
    expect(normalizeHeartQuality(100)).toBe(64);
    expect(heartSettings({ width: 30, depth: 30, heartTipFillet: 2.5, heartQuality: 24 })).toEqual({ tipFillet: 2.5, quality: 24 });
  });

  it("produces a simple triangulatable contour", () => {
    const points = buildHeartContourPoints(40, 40, 0, 32);
    const cleft = points.findIndex((p, index) => index > 0 && Math.abs(p.x) < 1e-4);
    expect(cleft).toBeGreaterThan(0);
    expect(THREE.ShapeUtils.triangulateShape(points.map((p) => new THREE.Vector2(p.x, p.y)), [])).toHaveLength(points.length - 2);
  });
});
