import { describe, expect, it } from "vitest";
import { automaticSideCount, MIN_AUTOMATIC_SIDES, ROUND_DEVIATION_TOLERANCE, roundSideCount } from "@/lib/roundSideCount";
import { MAX_HIGH_RESOLUTION_SIDES } from "@/lib/workplaneSettings";

function deviation(diameter: number, sides: number) {
  return (diameter / 2) * (1 - Math.cos(Math.PI / sides));
}

describe("automatic side count", () => {
  it.each([2, 6, 20, 60, 120, 200, 400])("stays inside the tolerance at %i mm", (diameter) => {
    const sides = automaticSideCount(diameter, diameter);
    expect(sides).toBeGreaterThanOrEqual(MIN_AUTOMATIC_SIDES);
    expect(sides).toBeLessThanOrEqual(MAX_HIGH_RESOLUTION_SIDES);
    if (sides < MAX_HIGH_RESOLUTION_SIDES && sides > MIN_AUTOMATIC_SIDES) {
      expect(deviation(diameter, sides)).toBeLessThanOrEqual(ROUND_DEVIATION_TOLERANCE + 1e-9);
      expect(deviation(diameter, sides - 4)).toBeGreaterThan(ROUND_DEVIATION_TOLERANCE);
    }
  });

  it("grows with the body and follows the longer axis", () => {
    const small = automaticSideCount(20, 20);
    const large = automaticSideCount(200, 200);
    expect(large).toBeGreaterThan(small);
    expect(small).toBeGreaterThanOrEqual(96);
    expect(automaticSideCount(200, 20)).toBe(large);
  });

  it("lets a set number win", () => {
    expect(roundSideCount(12, 200, 200)).toBe(12);
    expect(roundSideCount(undefined, 200, 200)).toBe(automaticSideCount(200, 200));
  });
});
