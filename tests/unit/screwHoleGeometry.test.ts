import { describe, expect, it } from "vitest";
import {
  countersinkDepth,
  createScrewHoleGeometry,
  normalizeScrewHoleAngle,
  normalizeScrewHoleHeadDepth,
  normalizeScrewHoleShaft,
  screwHoleProfile,
} from "@/lib/screwHoleGeometry";

function stats(geometry: ReturnType<typeof createScrewHoleGeometry>) {
  const position = geometry.getAttribute("position");
  const key = (i: number) => [position.getX(i), position.getY(i), position.getZ(i)].map((v) => v.toFixed(4)).join(",");
  const edges = new Map<string, number>();
  let volume = 0;
  for (let i = 0; i < position.count; i += 3) {
    const [a, b, c] = [0, 1, 2].map((offset) => [position.getX(i + offset), position.getY(i + offset), position.getZ(i + offset)]);
    volume += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
    for (let edge = 0; edge < 3; edge += 1) {
      const p = key(i + edge);
      const q = key(i + ((edge + 1) % 3));
      const edgeKey = p < q ? `${p}|${q}` : `${q}|${p}`;
      edges.set(edgeKey, (edges.get(edgeKey) ?? 0) + 1);
    }
  }
  return { volume, closed: [...edges.values()].every((count) => count === 2) };
}

describe("screw holes", () => {
  it("builds a counterbore profile with a shaft below its pocket", () => {
    expect(screwHoleProfile({ kind: "counterbore", width: 6.4, height: 12, screwHoleShaft: 3.4, screwHoleHeadDepth: 3.2 })).toEqual([
      { r: 1.7, y: 0 },
      { r: 1.7, y: expect.closeTo(8.8, 9) },
      { r: 3.2, y: expect.closeTo(8.8, 9) },
      { r: 3.2, y: 12 },
    ]);
  });

  it("builds a 90 degree countersink profile", () => {
    expect(countersinkDepth(6.6, 3.4, 90)).toBeCloseTo(1.6, 9);
    const profile = screwHoleProfile({ kind: "countersink", width: 6.6, height: 8, screwHoleShaft: 3.4, screwHoleAngle: 90 });
    expect(profile[1]).toEqual({ r: 1.7, y: expect.closeTo(6.4, 9) });
    expect(profile[2]).toEqual({ r: 3.3, y: 8 });
  });

  it("keeps a countersink inside a shallow hole", () => {
    const profile = screwHoleProfile({ kind: "countersink", width: 20, height: 4, screwHoleShaft: 3.4, screwHoleAngle: 60 });
    expect(profile[1].y).toBeCloseTo(0.2, 9);
    expect(profile[2]).toEqual({ r: 10, y: 4 });
  });

  it("normalizes shaft, pocket depth, and angle", () => {
    expect(normalizeScrewHoleShaft(9, 6)).toBeCloseTo(5.7);
    expect(normalizeScrewHoleShaft(undefined, 6.4)).toBe(3.4);
    expect(normalizeScrewHoleHeadDepth(50, 12)).toBeCloseTo(11.8);
    expect(normalizeScrewHoleAngle(500)).toBe(150);
    expect(normalizeScrewHoleAngle(1)).toBe(30);
  });

  it.each(["counterbore", "countersink"] as const)("builds a closed %s with outward faces and the right volume", (kind) => {
    const width = kind === "counterbore" ? 6.4 : 6.6;
    const height = kind === "counterbore" ? 12 : 8;
    const geometry = createScrewHoleGeometry({ kind, width, depth: width, height, screwHoleShaft: 3.4, screwHoleHeadDepth: 3.2, screwHoleAngle: 90 });
    const { volume, closed } = stats(geometry);
    const shaft = Math.PI * 1.7 ** 2;
    const exact = kind === "counterbore"
      ? shaft * (height - 3.2) + Math.PI * 3.2 ** 2 * 3.2
      : shaft * (height - 1.6) + (Math.PI * 1.6 / 3) * (1.7 ** 2 + 1.7 * 3.3 + 3.3 ** 2);
    expect(closed).toBe(true);
    expect(volume).toBeGreaterThan(exact * 0.99);
    expect(volume).toBeLessThan(exact * 1.001);
    expect(geometry.boundingBox?.min.y).toBeCloseTo(0, 6);
    expect(geometry.boundingBox?.max.y).toBeCloseTo(height, 6);
    expect(geometry.boundingBox?.max.x).toBeCloseTo(width / 2, 2);
  });

  it("stretches along z when depth differs from width", () => {
    const geometry = createScrewHoleGeometry({ kind: "counterbore", width: 6, depth: 9, height: 10 });
    expect(geometry.boundingBox?.max.z).toBeCloseTo(4.5, 2);
    expect(geometry.boundingBox?.max.x).toBeCloseTo(3, 2);
  });
});
