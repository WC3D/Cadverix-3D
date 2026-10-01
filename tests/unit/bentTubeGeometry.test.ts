import { describe, expect, it } from "vitest";
import { createBentTubeGeometry, normalizeBentTubeSegments } from "@/lib/bentTubeGeometry";

describe("bent tube geometry", () => {
  it("builds a closed hollow tube with the requested bounds", () => {
    const geometry = createBentTubeGeometry({ width: 55, depth: 30, height: 10 });
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;

    expect(box.max.x - box.min.x).toBeCloseTo(55, 4);
    expect(box.max.z - box.min.z).toBeCloseTo(30, 4);
    expect(box.max.y - box.min.y).toBeCloseTo(10, 4);
    expect(box.min.y).toBeCloseTo(0, 5);
    expect(geometry.getAttribute("position").count).toBeGreaterThan(100);
    expect(geometry.getIndex()).toBeNull();
    geometry.dispose();
  });

  it("normalizes segment limits and bend clearance", () => {
    const segments = normalizeBentTubeSegments([{ length: -2, bendAngle: 300, bendRadius: 1, roll: -400 }], 10);

    expect(segments).toEqual([{ length: 0, bendAngle: 180, bendRadius: 5.1, roll: -180 }]);
  });
});
