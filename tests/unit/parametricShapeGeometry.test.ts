import { describe, expect, it } from "vitest";
import { parametricShapeGeometryFields } from "@/lib/parametricShapeGeometry";
import type { WorkplaneShape } from "@/types/sketchforge";

const base: WorkplaneShape = {
  id: "shape",
  name: "Shape",
  kind: "honeycomb",
  color: "#ffffff",
  x: 0,
  z: 0,
  elevation: 0,
  size: 60,
  width: 60,
  depth: 60,
  height: 3,
  rotation: 0,
};

describe("parametric shape geometry fields", () => {
  it("changes the cache input for every editable generator parameter", () => {
    const cases: Array<[keyof WorkplaneShape, WorkplaneShape[keyof WorkplaneShape]]> = [
      ["springTurns", 8],
      ["springWire", 2.2],
      ["springQuality", 48],
      ["honeycombCellSize", 10],
      ["honeycombWallThickness", 2],
      ["honeycombFrameWidth", 5],
      ["bentTubeSize", 12],
      ["bentTubeWall", 2],
      ["bentTubeQuality", 48],
      ["bentTubeSegments", [{ length: 30, bendAngle: 45, bendRadius: 12, roll: 10 }]],
    ];
    const initial = JSON.stringify(parametricShapeGeometryFields(base));

    for (const [key, value] of cases) {
      const changed = { ...base, [key]: value } as WorkplaneShape;
      expect(JSON.stringify(parametricShapeGeometryFields(changed)), key).not.toBe(initial);
    }
  });
});
