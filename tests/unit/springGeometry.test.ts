import { describe, expect, it } from "vitest";
import {
  createSpringGeometry,
  normalizeSpringTurns,
  normalizeSpringWire,
  springSettings,
  springTurnLimits,
} from "@/lib/springGeometry";

type Position = { count: number; getX: (i: number) => number; getY: (i: number) => number; getZ: (i: number) => number };

function edgeUseCounts(position: Position) {
  const uses = new Map<string, number>();
  const point = (i: number) => [position.getX(i), position.getY(i), position.getZ(i)].map((v) => v.toFixed(5)).join(",");
  for (let i = 0; i + 2 < position.count; i += 3) {
    const triangle = [point(i), point(i + 1), point(i + 2)];
    if (new Set(triangle).size < 3) continue;
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
  let total = 0;
  for (let i = 0; i + 2 < position.count; i += 3) {
    const ax = position.getX(i), ay = position.getY(i), az = position.getZ(i);
    const bx = position.getX(i + 1), by = position.getY(i + 1), bz = position.getZ(i + 1);
    const cx = position.getX(i + 2), cy = position.getY(i + 2), cz = position.getZ(i + 2);
    total += (ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx)) / 6;
  }
  return total;
}

describe("spring geometry", () => {
  it.each([
    [20, 30, 6, 3],
    [40, 20, 2, 4],
    [12, 60, 14, 1.5],
    [30, 30, 1, 6],
  ])("wraps a closed wire in a %i x %i body with %i turns", (diameter, height, turns, wire) => {
    const geometry = createSpringGeometry({ width: diameter, depth: diameter, height, springTurns: turns, springWire: wire });
    const position = geometry.getAttribute("position") as unknown as Position;
    expect(position.count).toBeGreaterThan(500);
    expect([...edgeUseCounts(position).values()].every((uses) => uses === 2)).toBe(true);
    expect(signedVolume(position)).toBeGreaterThan(0);
    const box = geometry.boundingBox!;
    expect(box.max.x - box.min.x).toBeCloseTo(diameter, 2);
    expect(box.max.z - box.min.z).toBeCloseTo(diameter, 2);
    expect(box.min.y).toBeCloseTo(0, 2);
    expect(box.max.y).toBeCloseTo(height, 2);
  });

  it("fills an oval footprint", () => {
    const geometry = createSpringGeometry({ width: 30, depth: 18, height: 25, springTurns: 5, springWire: 2.5 });
    expect(geometry.boundingBox!.max.x - geometry.boundingBox!.min.x).toBeCloseTo(30, 2);
    expect(geometry.boundingBox!.max.z - geometry.boundingBox!.min.z).toBeCloseTo(18, 2);
  });

  it("refuses more turns than fit into the height", () => {
    const limits = springTurnLimits(20, 20, 4);
    expect(limits.max).toBeLessThan(10);
    expect(normalizeSpringTurns(10, 20, 20, 4)).toBe(limits.max);
    expect(normalizeSpringTurns(0, 20, 20, 4)).toBe(1);
    const tight = createSpringGeometry({ width: 20, depth: 20, height: 20, springTurns: 40, springWire: 4 });
    const position = tight.getAttribute("position") as unknown as Position;
    expect([...edgeUseCounts(position).values()].every((uses) => uses === 2)).toBe(true);
  });

  it("keeps the wire inside the body", () => {
    expect(normalizeSpringWire(50, 20, 30)).toBe(8);
    expect(normalizeSpringWire(0.01, 20, 30)).toBe(0.3);
    expect(springSettings({}, 20, 30)).toEqual({ wire: 3, turns: 6, quality: 36 });
  });
});
