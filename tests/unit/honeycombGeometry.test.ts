import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { Brush, Evaluator, SUBTRACTION } from "three-bvh-csg";
import {
  buildHoneycombHoles,
  createHoneycombGeometry,
  normalizeHoneycombCellSize,
  normalizeHoneycombFrameWidth,
  normalizeHoneycombWallThickness,
} from "@/lib/honeycombGeometry";

function edgeUseCounts(geometry: THREE.BufferGeometry) {
  const position = geometry.getAttribute("position");
  const index = geometry.getIndex();
  const point = (i: number) => `${Math.round(position.getX(i) * 1000)},${Math.round(position.getY(i) * 1000)},${Math.round(position.getZ(i) * 1000)}`;
  const counts = new Map<string, number>();
  const triCount = index?.count ?? position.count;
  for (let i = 0; i + 2 < triCount; i += 3) {
    const vertices = [0, 1, 2].map((offset) => point(index ? index.getX(i + offset) : i + offset));
    for (let edge = 0; edge < 3; edge += 1) {
      const a = vertices[edge];
      const b = vertices[(edge + 1) % 3];
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

function signedVolume(geometry: THREE.BufferGeometry) {
  const position = geometry.getAttribute("position");
  const index = geometry.getIndex();
  const triCount = index?.count ?? position.count;
  let volume = 0;
  for (let i = 0; i + 2 < triCount; i += 3) {
    const [a, b, c] = [0, 1, 2].map((offset) => index ? index.getX(i + offset) : i + offset);
    const ax = position.getX(a), ay = position.getY(a), az = position.getZ(a);
    const bx = position.getX(b), by = position.getY(b), bz = position.getZ(b);
    const cx = position.getX(c), cy = position.getY(c), cz = position.getZ(c);
    volume += ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx);
  }
  return volume / 6;
}

describe("honeycomb geometry", () => {
  it("normalizes parameters safely", () => {
    expect([normalizeHoneycombCellSize(undefined), normalizeHoneycombCellSize(0), normalizeHoneycombCellSize(12.34), normalizeHoneycombCellSize(200)]).toEqual([8, 2, 12.3, 100]);
    expect([normalizeHoneycombWallThickness(undefined), normalizeHoneycombWallThickness(0), normalizeHoneycombWallThickness(1.58), normalizeHoneycombWallThickness(100)]).toEqual([1.6, 0.4, 1.6, 50]);
    expect([normalizeHoneycombFrameWidth(undefined), normalizeHoneycombFrameWidth(-5), normalizeHoneycombFrameWidth(4.26), normalizeHoneycombFrameWidth(150)]).toEqual([3, 0, 4.3, 100]);
  });

  it("creates a closed grid with exact bounds", () => {
    const geometry = createHoneycombGeometry({ width: 60, depth: 60, height: 3, honeycombCellSize: 8, honeycombWallThickness: 1.6, honeycombFrameWidth: 3 });
    expect(signedVolume(geometry)).toBeGreaterThan(0);
    expect([...edgeUseCounts(geometry).values()].every((uses) => uses === 2)).toBe(true);
    expect(geometry.boundingBox?.min.x).toBeCloseTo(-30, 3);
    expect(geometry.boundingBox?.max.x).toBeCloseTo(30, 3);
    expect(geometry.boundingBox?.min.y).toBeCloseTo(0, 4);
    expect(geometry.boundingBox?.max.y).toBeCloseTo(3, 4);
    expect(geometry.boundingBox?.min.z).toBeCloseTo(-30, 3);
    expect(geometry.boundingBox?.max.z).toBeCloseTo(30, 3);
  });

  it("handles cells larger than the plate", () => {
    const geometry = createHoneycombGeometry({ width: 20, depth: 20, height: 2, honeycombCellSize: 40, honeycombWallThickness: 2, honeycombFrameWidth: 5 });
    expect(signedVolume(geometry)).toBeGreaterThan(0);
    expect([...edgeUseCounts(geometry).values()].every((uses) => uses === 2)).toBe(true);
    expect(geometry.boundingBox?.max.y).toBeCloseTo(2, 4);
  });

  it("participates cleanly in CSG subtraction", () => {
    const honeycomb = new Brush(createHoneycombGeometry({ width: 40, depth: 40, height: 4, honeycombCellSize: 8, honeycombWallThickness: 1.6, honeycombFrameWidth: 3 }));
    const boxGeometry = new THREE.BoxGeometry(50, 4, 50);
    boxGeometry.translate(0, 2, 0);
    const box = new Brush(boxGeometry);
    box.updateMatrixWorld(true);
    honeycomb.updateMatrixWorld(true);
    const evaluator = new Evaluator();
    evaluator.useGroups = false;
    evaluator.attributes = ["position", "normal"];
    const result = evaluator.evaluate(box, honeycomb, SUBTRACTION);
    expect(result.geometry.getAttribute("position").count).toBeGreaterThan(0);
    expect(signedVolume(result.geometry)).toBeGreaterThan(0);
  });

  it("generates half hexagons at lateral borders", () => {
    const holes = buildHoneycombHoles(70, 70, 8, 1.6, 3);
    expect(holes.filter((hole) => hole.length === 6)).toHaveLength(39);
    expect(holes.filter((hole) => hole.length === 4)).toHaveLength(6);
    expect(holes).toHaveLength(45);
    for (const point of holes.filter((hole) => hole.length === 4).flat()) {
      expect(point.x).toBeGreaterThanOrEqual(-32);
      expect(point.x).toBeLessThanOrEqual(32);
      expect(point.y).toBeGreaterThanOrEqual(-32);
      expect(point.y).toBeLessThanOrEqual(32);
    }
  });

  it("has no spurious top-face edge lines", () => {
    const cases = [
      [60, 60, 3, 8, 1.6, 3], [70, 70, 3, 8, 1.6, 3], [40, 60, 3, 10, 1.6, 3],
      [60, 60, 3, 5, 1.6, 3], [80, 50, 4, 6, 1.2, 2],
    ];
    for (const [width, depth, height, size, thickness, frame] of cases) {
      const geometry = createHoneycombGeometry({ width, depth, height, honeycombCellSize: size, honeycombWallThickness: thickness, honeycombFrameWidth: frame });
      expect([...edgeUseCounts(geometry).values()].every((uses) => uses === 2)).toBe(true);
      const holes = buildHoneycombHoles(width, depth, size, thickness, frame);
      const expected = 4 + holes.reduce((sum, hole) => sum + hole.length, 0);
      const positions = new THREE.EdgesGeometry(geometry, 14).getAttribute("position");
      let topEdges = 0;
      for (let i = 0; i < positions.count; i += 2) {
        if (Math.abs(positions.getY(i) - height) < 1e-3 && Math.abs(positions.getY(i + 1) - height) < 1e-3) topEdges += 1;
      }
      expect(topEdges).toBe(expected);
    }
  });
});
