import { describe, expect, it } from "vitest";
import { createCrescentGeometry, crescentSettings, normalizeCrescentQuality, normalizeCrescentThickness, normalizeCrescentTipFillet } from "@/lib/crescentGeometry";

function isClosed(position: ReturnType<ReturnType<typeof createCrescentGeometry>["getAttribute"]>) {
  const uses = new Map<string, number>();
  const key = (i: number) => [position.getX(i), position.getY(i), position.getZ(i)].map((v) => v.toFixed(5)).join(",");
  for (let i = 0; i < position.count; i += 3) for (let k = 0; k < 3; k += 1) {
    const a = key(i + k), b = key(i + ((k + 1) % 3)), edge = a < b ? `${a}:${b}` : `${b}:${a}`;
    uses.set(edge, (uses.get(edge) ?? 0) + 1);
  }
  return [...uses.values()].every((count) => count === 2);
}

describe("crescent geometry", () => {
  it.each([0, 2])("creates a closed crescent with a %i mm tip fillet", (crescentTipFillet) => {
    const geometry = createCrescentGeometry({ width: 40, depth: 40, height: 10, crescentThickness: 14, crescentTipFillet, crescentQuality: 32 });
    expect(isClosed(geometry.getAttribute("position"))).toBe(true);
    expect(geometry.boundingBox?.max.y).toBeCloseTo(10, 4);
    if (crescentTipFillet === 0) {
      expect((geometry.boundingBox?.max.x ?? 0) - (geometry.boundingBox?.min.x ?? 0)).toBeCloseTo(40, 2);
      expect((geometry.boundingBox?.max.z ?? 0) - (geometry.boundingBox?.min.z ?? 0)).toBeCloseTo(40, 2);
    }
  });

  it("normalizes crescent settings", () => {
    expect(normalizeCrescentTipFillet(-1)).toBe(0);
    expect(normalizeCrescentTipFillet(50)).toBe(8);
    expect(normalizeCrescentThickness(undefined, 40)).toBe(14);
    expect(normalizeCrescentThickness(100, 40)).toBe(34);
    expect(normalizeCrescentQuality(4)).toBe(16);
    expect(normalizeCrescentQuality(100)).toBe(64);
    expect(crescentSettings({ width: 40, depth: 40, crescentThickness: 12, crescentTipFillet: 1.5, crescentQuality: 24 })).toEqual({ thickness: 12, tipFillet: 1.5, quality: 24 });
  });
});
