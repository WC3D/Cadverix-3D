import { describe, expect, it } from "vitest";
import { createDovetailGeometry, dovetailContourPoints, dovetailFlankAngle, normalizeDovetailClearance, normalizeDovetailNeckWidth } from "@/lib/dovetailGeometry";

type P = { x: number; y: number };
const distanceToLine = (p: P, a: P, b: P) => Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / Math.hypot(b.x - a.x, b.y - a.y);

describe("dovetail", () => {
  it("fills its frame exactly", () => {
    const [backLeft, backRight, frontRight, frontLeft] = dovetailContourPoints(30, 20, 15, 0);
    expect(frontRight.x - frontLeft.x).toBeCloseTo(30);
    expect(backRight.x - backLeft.x).toBeCloseTo(15);
    expect(frontLeft.y - backLeft.y).toBeCloseTo(20);
    expect(backLeft.y).toBeCloseTo(-10);
  });

  it("keeps socket clearance from every side", () => {
    const tail = dovetailContourPoints(30, 20, 15, 0);
    const socket = dovetailContourPoints(30, 20, 15, 0.2);
    for (let side = 0; side < 4; side += 1) {
      const a = tail[side], b = tail[(side + 1) % 4];
      expect(distanceToLine(socket[side], a, b)).toBeCloseTo(0.2, 6);
      expect(distanceToLine(socket[(side + 1) % 4], a, b)).toBeCloseTo(0.2, 6);
    }
  });

  it("normalizes joint settings", () => {
    expect(normalizeDovetailNeckWidth(undefined, 30)).toBeCloseTo(15);
    expect(normalizeDovetailNeckWidth(40, 30)).toBeCloseTo(28.5);
    expect(normalizeDovetailNeckWidth(-5, 30)).toBeCloseTo(0.1);
    expect(normalizeDovetailClearance(undefined)).toBe(0.2);
    expect(normalizeDovetailClearance(5)).toBe(2);
    expect(dovetailFlankAngle(30, 20, 15)).toBeCloseTo(20.56, 1);
  });

  it("builds a closed body", () => {
    const geometry = createDovetailGeometry({ width: 30, depth: 20, height: 10, dovetailNeckWidth: 15 });
    const position = geometry.getAttribute("position");
    const key = (i: number) => [position.getX(i), position.getY(i), position.getZ(i)].map((v) => v.toFixed(4)).join(",");
    const edges = new Map<string, number>();
    for (let i = 0; i < position.count; i += 3) {
      for (let k = 0; k < 3; k += 1) {
        const a = key(i + k), b = key(i + ((k + 1) % 3));
        const edge = a < b ? `${a}|${b}` : `${b}|${a}`;
        edges.set(edge, (edges.get(edge) ?? 0) + 1);
      }
    }
    expect([...edges.values()].every((count) => count === 2)).toBe(true);
    expect(geometry.boundingBox?.max.y).toBeCloseTo(10);
  });
});
