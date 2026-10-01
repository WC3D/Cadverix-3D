import { describe, expect, it } from "vitest";
import { createTeardropGeometry, teardropContourPoints, teardropHeightForTipAngle, teardropTipAngle } from "@/lib/teardropGeometry";

function signedVolume(width: number, depth: number, height: number) {
  const position = createTeardropGeometry({ width, depth, height }).getAttribute("position");
  let volume = 0;
  for (let i = 0; i < position.count; i += 3) {
    const [a, b, c] = [0, 1, 2].map((k) => [position.getX(i + k), position.getY(i + k), position.getZ(i + k)]);
    volume += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
  }
  return volume;
}

describe("teardrop", () => {
  it("has the requested tip angle", () => {
    const height = teardropHeightForTipAngle(6, 90);
    expect(height).toBeCloseTo(3 + 3 * Math.SQRT2, 9);
    expect(teardropTipAngle(6, height)).toBeCloseTo(90, 6);
    expect(teardropTipAngle(6, teardropHeightForTipAngle(6, 60))).toBeCloseTo(60, 6);
    expect(teardropTipAngle(6, 6)).toBe(180);
  });

  it("fills its frame", () => {
    const height = teardropHeightForTipAngle(6, 90);
    const points = teardropContourPoints(6, height);
    expect(Math.min(...points.map((p) => p.y))).toBeCloseTo(0, 6);
    expect(Math.max(...points.map((p) => p.y))).toBeCloseTo(height, 6);
    expect(Math.max(...points.map((p) => p.x))).toBeCloseTo(3, 6);
    expect(Math.min(...points.map((p) => p.x))).toBeCloseTo(-3, 6);
  });

  it("has 45 degree default flanks", () => {
    const points = teardropContourPoints(6, teardropHeightForTipAngle(6, 90));
    const tip = points[points.length - 1], lastArc = points[points.length - 2];
    expect(Math.abs((tip.y - lastArc.y) / (tip.x - lastArc.x))).toBeCloseTo(1, 3);
  });

  it("builds a closed body of the right volume", () => {
    const width = 6, depth = 20;
    const height = teardropHeightForTipAngle(width, 90);
    const radius = width / 2;
    const rise = radius * Math.SQRT2;
    const expected = (Math.PI * radius * radius + radius * Math.sqrt(rise * rise - radius * radius) - radius * radius * Math.acos(radius / rise)) * depth;
    const volume = signedVolume(width, depth, height);
    expect(volume).toBeGreaterThan(expected * 0.97);
    expect(volume).toBeLessThan(expected * 1.001);
  });
});
