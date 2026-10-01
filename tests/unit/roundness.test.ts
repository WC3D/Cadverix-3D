import { describe, expect, it } from "vitest";
import { drawnRound, EXACT_ROUND_TOLERANCE, ROUND_FROM_SIDES, ROUND_FROM_SPHERE_STEPS } from "@/lib/roundness";
import { automaticSideCount } from "@/lib/roundSideCount";

function deviation(diameter: number, corners: number) {
  return (diameter / 2) * (1 - Math.cos(Math.PI / corners));
}

describe("drawn round or drawn with sides", () => {
  it("counts a body without a set number as round", () => {
    expect(drawnRound(undefined, ROUND_FROM_SIDES, 3, 1000, 1000)).toBe(true);
    expect(drawnRound(undefined, ROUND_FROM_SIDES, automaticSideCount(200, 200), 200, 200)).toBe(true);
  });

  it("counts a set number at least as fine as the shape's own as round", () => {
    expect(deviation(400, 96)).toBeGreaterThan(EXACT_ROUND_TOLERANCE);
    expect(drawnRound(96, ROUND_FROM_SIDES, 96, 400, 400)).toBe(true);
    expect(drawnRound(95, ROUND_FROM_SIDES, 95, 400, 400)).toBe(false);
    expect(drawnRound(24, ROUND_FROM_SPHERE_STEPS, 48, 200, 200)).toBe(true);
    expect(drawnRound(12, ROUND_FROM_SPHERE_STEPS, 24, 200, 200)).toBe(false);
  });

  it("counts fewer only within the circle tolerance", () => {
    expect(drawnRound(6, ROUND_FROM_SIDES, 6, 2, 2)).toBe(false);
    expect(drawnRound(12, ROUND_FROM_SIDES, 12, 1, 1)).toBe(true);
    const corners = 16;
    const limit = (2 * EXACT_ROUND_TOLERANCE) / (1 - Math.cos(Math.PI / corners));
    expect(drawnRound(corners, ROUND_FROM_SIDES, corners, limit * 0.999, 1)).toBe(true);
    expect(drawnRound(corners, ROUND_FROM_SIDES, corners, 1, limit * 1.001)).toBe(false);
  });
});
