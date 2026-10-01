import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildSlotContourPoints, createSlotGeometry } from "@/lib/slotGeometry";

function edgeUseCounts(position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) {
  const uses = new Map<string, number>();
  const key = (i: number) => [position.getX(i), position.getY(i), position.getZ(i)].map((v) => v.toFixed(5)).join(",");
  for (let i = 0; i + 2 < position.count; i += 3) {
    const triangle = [key(i), key(i + 1), key(i + 2)];
    for (let e = 0; e < 3; e += 1) {
      const a = triangle[e], b = triangle[(e + 1) % 3];
      const edge = a < b ? `${a}:${b}` : `${b}:${a}`;
      uses.set(edge, (uses.get(edge) ?? 0) + 1);
    }
  }
  return uses;
}

function signedVolume(position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) {
  let volume = 0;
  for (let i = 0; i + 2 < position.count; i += 3) {
    const ax = position.getX(i), ay = position.getY(i), az = position.getZ(i);
    const bx = position.getX(i + 1), by = position.getY(i + 1), bz = position.getZ(i + 1);
    const cx = position.getX(i + 2), cy = position.getY(i + 2), cz = position.getZ(i + 2);
    volume += ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx);
  }
  return volume / 6;
}

describe("slot geometry", () => {
  it.each([[40, 20, 10], [20, 50, 15]] as const)("creates a closed slot with bounds %i x %i x %i", (width, depth, height) => {
    const geometry = createSlotGeometry({ width, depth, height, sides: 32 });
    const position = geometry.getAttribute("position");
    expect(signedVolume(position)).toBeGreaterThan(0);
    expect([...edgeUseCounts(position).values()].every((uses) => uses === 2)).toBe(true);
    expect(geometry.boundingBox?.max.y).toBeCloseTo(height, 4);
    expect((geometry.boundingBox?.max.x ?? 0) - (geometry.boundingBox?.min.x ?? 0)).toBeCloseTo(width, 3);
    expect((geometry.boundingBox?.max.z ?? 0) - (geometry.boundingBox?.min.z ?? 0)).toBeCloseTo(depth, 3);
  });

  it("handles equal dimensions without duplicate vertices", () => {
    const points = buildSlotContourPoints(30, 30, 32);
    expect(THREE.ShapeUtils.triangulateShape(points.map((p) => new THREE.Vector2(p.x, p.y)), [])).toHaveLength(points.length - 2);
    const position = createSlotGeometry({ width: 30, depth: 30, height: 10 }).getAttribute("position");
    expect(signedVolume(position)).toBeGreaterThan(0);
    expect([...edgeUseCounts(position).values()].every((uses) => uses === 2)).toBe(true);
  });
});
