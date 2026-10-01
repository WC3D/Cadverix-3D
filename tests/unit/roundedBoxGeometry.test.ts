import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { Brush, Evaluator, SUBTRACTION } from "three-bvh-csg";
import {
  createRoundedBoxGeometry,
  normalizeCornerFillet,
  normalizeRoundedBoxQuality,
  normalizeTopBottomFillet,
} from "@/lib/roundedBoxGeometry";

type Position = ReturnType<THREE.BufferGeometry["getAttribute"]>;

function edgeUseCounts(position: Position) {
  const uses = new Map<string, number>();
  const point = (i: number) => [position.getX(i), position.getY(i), position.getZ(i)].map((v) => v.toFixed(5)).join(",");
  for (let i = 0; i + 2 < position.count; i += 3) {
    const triangle = [point(i), point(i + 1), point(i + 2)];
    for (let edge = 0; edge < 3; edge += 1) {
      const a = triangle[edge];
      const b = triangle[(edge + 1) % 3];
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      uses.set(key, (uses.get(key) ?? 0) + 1);
    }
  }
  return uses;
}

function signedVolume(position: Position) {
  let volume = 0;
  for (let i = 0; i + 2 < position.count; i += 3) {
    const ax = position.getX(i), ay = position.getY(i), az = position.getZ(i);
    const bx = position.getX(i + 1), by = position.getY(i + 1), bz = position.getZ(i + 1);
    const cx = position.getX(i + 2), cy = position.getY(i + 2), cz = position.getZ(i + 2);
    volume += ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx);
  }
  return volume / 6;
}

function expectClosedWithBounds(geometry: THREE.BufferGeometry, width: number, depth: number, height: number) {
  const position = geometry.getAttribute("position");
  expect(position.count).toBeGreaterThan(40);
  expect(signedVolume(position)).toBeGreaterThan(0);
  expect([...edgeUseCounts(position).values()].every((uses) => uses === 2)).toBe(true);
  expect(geometry.boundingBox?.min.y).toBeCloseTo(0, 4);
  expect(geometry.boundingBox?.max.y).toBeCloseTo(height, 4);
  expect((geometry.boundingBox?.max.x ?? 0) - (geometry.boundingBox?.min.x ?? 0)).toBeCloseTo(width, 3);
  expect((geometry.boundingBox?.max.z ?? 0) - (geometry.boundingBox?.min.z ?? 0)).toBeCloseTo(depth, 3);
}

describe("roundedBox geometry", () => {
  it("creates a closed rounded box with vertical corner fillets", () => {
    expectClosedWithBounds(createRoundedBoxGeometry({
      width: 40, depth: 30, height: 20, cornerFillet: 5, topBottomFillet: 0, roundedBoxQuality: 8,
    }), 40, 30, 20);
  });

  it("creates a closed rounded box with corner and top/bottom fillets", () => {
    expectClosedWithBounds(createRoundedBoxGeometry({
      width: 50, depth: 40, height: 25, cornerFillet: 6, topBottomFillet: 4, roundedBoxQuality: 8,
    }), 50, 40, 25);
  });

  it("keeps the corner radius constant when dimensions change", () => {
    for (const [width, depth] of [[40, 30], [100, 60]]) {
      const radius = 5;
      const geometry = createRoundedBoxGeometry({ width, depth, height: 20, cornerFillet: radius, roundedBoxQuality: 16 });
      const position = geometry.getAttribute("position");
      const centerX = width / 2 - radius;
      const centerZ = depth / 2 - radius;
      let maxDistance = 0;
      for (let i = 0; i < position.count; i += 1) {
        const x = position.getX(i);
        const z = position.getZ(i);
        if (x >= centerX && z >= centerZ) maxDistance = Math.max(maxDistance, Math.hypot(x - centerX, z - centerZ));
      }
      expect(maxDistance).toBeCloseTo(radius, 2);
    }
  });

  it("participates cleanly in CSG subtraction", () => {
    const box = new Brush(createRoundedBoxGeometry({ width: 40, depth: 30, height: 20, cornerFillet: 5, topBottomFillet: 2 }));
    const cutterGeometry = new THREE.CylinderGeometry(5, 5, 30, 16);
    cutterGeometry.translate(0, 10, 0);
    const cutter = new Brush(cutterGeometry);
    box.updateMatrixWorld(true);
    cutter.updateMatrixWorld(true);
    const evaluator = new Evaluator();
    evaluator.useGroups = false;
    evaluator.attributes = ["position", "normal"];
    const result = evaluator.evaluate(box, cutter, SUBTRACTION);
    expect(result.geometry.getAttribute("position").count).toBeGreaterThan(0);
    expect(signedVolume(result.geometry.getAttribute("position"))).toBeGreaterThan(0);
  });

  it("normalizes parameters", () => {
    expect(normalizeCornerFillet(null)).toBe(5);
    expect(normalizeCornerFillet(7.33)).toBe(7.3);
    expect(normalizeCornerFillet(100, 15)).toBe(15);
    expect(normalizeCornerFillet(-5)).toBe(0);
    expect(normalizeTopBottomFillet(undefined)).toBe(0);
    expect(normalizeTopBottomFillet(3.48)).toBe(3.5);
    expect(normalizeTopBottomFillet(50, 8)).toBe(8);
    expect(normalizeRoundedBoxQuality(2)).toBe(4);
    expect(normalizeRoundedBoxQuality(50)).toBe(32);
    expect(normalizeRoundedBoxQuality(12)).toBe(12);
  });
});
