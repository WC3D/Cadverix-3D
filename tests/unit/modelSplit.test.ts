import { describe, expect, it } from "vitest";
import { modelSplitPlane, splitAxisNormal, splitPlaneIntersectsPoints, splitRotationAxes, splitShapeFromWorldPositions } from "@/lib/modelSplit";
import type { WorkplaneShape } from "@/types/sketchforge";

const source: WorkplaneShape = {
  id: "source",
  name: "Source",
  kind: "box",
  color: "#d41721",
  x: 0,
  z: 0,
  elevation: 0,
  size: 10,
  width: 10,
  depth: 10,
  height: 10,
  rotation: 0,
};

describe("model split helpers", () => {
  it("centers and reorients the preview plane within model bounds", () => {
    const points: Array<[number, number, number]> = [[-4, 2, -6], [8, 12, 10]];
    expect(modelSplitPlane(points, "z")).toEqual({
      axis: "z",
      rotation: [0, 0],
      normal: [0, 1, 0],
      origin: [2, 7, 2],
      position: 7,
      min: 2,
      max: 12,
      size: Math.sqrt(500) * 1.1,
    });
    expect(modelSplitPlane(points, "x", 6)?.origin).toEqual([6, 7, 2]);
  });

  it("maps CAD Y to depth and CAD Z to model height", () => {
    expect(splitAxisNormal("x")).toEqual([1, 0, 0]);
    expect(splitAxisNormal("y")).toEqual([0, 0, 1]);
    expect(splitAxisNormal("z")).toEqual([0, 1, 0]);
  });

  it("rotates the plane normal and projection range for angled cuts", () => {
    const points: Array<[number, number, number]> = [[-4, 2, -6], [8, 12, 10]];
    const plane = modelSplitPlane(points, "z", undefined, [45, 0]);
    expect(plane?.rotation).toEqual([45, 0]);
    expect(plane?.normal[0]).toBeCloseTo(-Math.SQRT1_2, 8);
    expect(plane?.normal[1]).toBeCloseTo(Math.SQRT1_2, 8);
    expect(plane?.normal[2]).toBe(0);
    expect(plane?.origin).toEqual([2, 7, 2]);
    expect(plane?.min).toBeCloseTo(2 * Math.SQRT2, 8);
    expect(plane?.max).toBeCloseTo(3 * Math.SQRT2, 8);
  });

  it("turns the plane about both axes it does not cut across", () => {
    expect(splitRotationAxes("x")).toEqual(["z", "y"]);
    expect(splitRotationAxes("y")).toEqual(["x", "z"]);
    expect(splitRotationAxes("z")).toEqual(["y", "x"]);
  });

  it("tilts the plane about the second axis alone", () => {
    const points: Array<[number, number, number]> = [[-5, -5, -5], [5, 5, 5]];
    expect(modelSplitPlane(points, "x", undefined, [0, 90])?.normal).toEqual([0, 1, 0]);
    const normal = modelSplitPlane(points, "z", undefined, [0, 30])?.normal;
    expect(normal?.[0]).toBe(0);
    expect(normal?.[1]).toBeCloseTo(Math.sqrt(3) / 2, 8);
    expect(normal?.[2]).toBeCloseTo(0.5, 8);
  });

  it("combines both tilts, applying the first axis before the second", () => {
    const points: Array<[number, number, number]> = [[-5, -5, -5], [5, 5, 5]];
    const normal = modelSplitPlane(points, "x", undefined, [45, 45])?.normal ?? [];
    expect(normal[0]).toBeCloseTo(0.5, 8);
    expect(normal[1]).toBeCloseTo(0.5, 8);
    expect(normal[2]).toBeCloseTo(-Math.SQRT1_2, 8);
    expect(Math.hypot(...normal)).toBeCloseTo(1, 8);
  });

  it("only reports a cut when vertices exist on both sides", () => {
    const points: Array<[number, number, number]> = [[-5, 0, 0], [5, 0, 0]];
    expect(splitPlaneIntersectsPoints(points, [1, 0, 0], 0)).toBe(true);
    expect(splitPlaneIntersectsPoints(points, [1, 0, 0], -5)).toBe(false);
    expect(splitPlaneIntersectsPoints(points, [1, 0, 0], 8)).toBe(false);
  });

  it("normalizes world-space split triangles into an editable mesh shape", () => {
    const part = splitShapeFromWorldPositions(source, [
      4, 3, -2,
      8, 3, -2,
      4, 9, 6,
    ], "part-a", "Source A");
    expect(part).toMatchObject({
      id: "part-a",
      name: "Source A",
      kind: "mesh",
      x: 6,
      z: 2,
      elevation: 3,
      width: 4,
      depth: 8,
      height: 6,
    });
    expect(part?.importedMesh?.positions).toEqual([-2, 0, -4, 2, 0, -4, -2, 6, 4]);
  });
});
