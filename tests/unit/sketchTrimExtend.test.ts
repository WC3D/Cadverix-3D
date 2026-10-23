import { describe, expect, it } from "vitest";
import { trimExtendSketchLine } from "@/lib/sketchTrimExtend";
import { solveSketchProfile } from "@/lib/sketchConstraints";
import { addLineIntersectionPoints } from "@/lib/sketchPointRefinement";
import type { SketchProfile } from "@/types/sketchforge";

function fixture(boundaries: number[] = [3, 7]): SketchProfile {
  return {
    points: [
      { id: "a", x: 0, z: 0 }, { id: "b", x: 10, z: 0 },
      ...boundaries.flatMap((x, i) => [{ id: `c${i}`, x, z: -5 }, { id: `d${i}`, x, z: 5 }]),
    ],
    segments: [
      { id: "line", startId: "a", endId: "b", kind: "line" },
      ...boundaries.map((_, i) => ({ id: `boundary${i}`, startId: `c${i}`, endId: `d${i}`, kind: "line" as const })),
    ],
  };
}

function ids() {
  let n = 0;
  return (prefix: string) => `${prefix}-${++n}`;
}

function edit(profile: SketchProfile, x: number, mode: "trim" | "extend" = "trim") {
  return trimExtendSketchLine(profile, "line", { x, z: 0 }, mode, ids());
}

function horizontalRanges(profile: SketchProfile) {
  return profile.segments.flatMap((segment) => {
    const start = profile.points.find((point) => point.id === segment.startId)!;
    const end = profile.points.find((point) => point.id === segment.endId)!;
    return start.z === 0 && end.z === 0 ? [[start.x, end.x]] : [];
  });
}

describe("sketch Trim/Extend", () => {
  it("trims the clicked middle and connects both remaining ends to boundaries", () => {
    const profile = fixture();
    const before = structuredClone(profile);
    const next = edit(profile, 5);
    expect(horizontalRanges(next)).toEqual([[0, 3], [7, 10]]);
    for (const x of [3, 7]) {
      const point = next.points.find((entry) => entry.x === x && entry.z === 0)!;
      expect(next.segments.filter((segment) => segment.startId === point.id || segment.endId === point.id)).toHaveLength(3);
    }
    expect(profile).toEqual(before);
  });

  it.each([[1, [[3, 7], [7, 10]]], [9, [[0, 3], [3, 7]]]])("trims the clicked outer end at %s", (x, expected) => {
    expect(horizontalRanges(edit(fixture(), x as number))).toEqual(expected);
  });

  it("removes an entire unbounded line, retaining unrelated standalone points", () => {
    const profile = fixture([]);
    profile.points.push({ id: "standalone", x: 100, z: 100 });
    const next = edit(profile, 5);
    expect(next.segments).toEqual([]);
    expect(next.points.map((point) => point.id)).toEqual(["standalone"]);
  });

  it("works on the already-split intersections used by the editor", () => {
    const createId = ids();
    const profile = addLineIntersectionPoints(fixture(), createId);
    const middle = profile.segments.find((segment) => {
      const a = profile.points.find((point) => point.id === segment.startId)!;
      const b = profile.points.find((point) => point.id === segment.endId)!;
      return a.x === 3 && b.x === 7 && a.z === 0 && b.z === 0;
    })!;
    const next = trimExtendSketchLine(profile, middle.id, { x: 5, z: 0 }, "trim", createId);
    expect(horizontalRanges(next)).toEqual([[0, 3], [7, 10]]);
  });

  it.each([[9, [12, 15], [[0, 12]]], [1, [-5, -2], [[-2, 10]]]])("extends the endpoint nearest %s to the nearest boundary", (x, boundaries, expected) => {
    expect(horizontalRanges(edit(fixture(boundaries as number[]), x as number, "extend"))).toEqual(expected);
  });

  it("does not use the infinite continuation of a short boundary", () => {
    const profile = fixture([12]);
    profile.points.find((point) => point.id === "c0")!.z = 2;
    expect(() => edit(profile, 9, "extend")).toThrow("No straight-line boundary");
  });

  it("leaves shared geometry in place when extending an endpoint", () => {
    const profile = fixture([12]);
    profile.points.push({ id: "shared", x: 10, z: 5 });
    profile.segments.push({ id: "neighbor", startId: "b", endId: "shared", kind: "line" });
    const next = edit(profile, 9, "extend");
    expect(next.points.find((point) => point.id === "b")).toEqual({ id: "b", x: 10, z: 0 });
    expect(horizontalRanges(next)).toEqual([[0, 10], [10, 12]]);
    expect(next.segments.find((segment) => segment.id === "neighbor")).toEqual(profile.segments.at(-1));
  });

  it("preserves axis constraints and removes affected driving lengths before solving", () => {
    const profile = fixture();
    profile.constraints = [{ id: "horizontal", kind: "horizontal", segmentId: "line" }];
    profile.dimensions = [
      { id: "length", kind: "length", segmentId: "line", value: 10 },
      { id: "boundary-length", kind: "length", segmentId: "boundary0", value: 10 },
      { id: "unaffected", kind: "distance", start: { kind: "point", pointId: "c0" }, end: { kind: "point", pointId: "d0" } },
    ];
    const next = edit(profile, 5);
    expect(next.dimensions?.map((dimension) => dimension.id)).toEqual(["unaffected"]);
    expect(next.constraints).toHaveLength(2);
    expect(horizontalRanges(solveSketchProfile(next).profile)).toEqual([[0, 3], [7, 10]]);
  });

  it("respects fixed endpoints", () => {
    const profile = fixture([12]);
    profile.constraints = [{ id: "fixed", kind: "fixed", pointId: "b", x: 10, z: 0 }];
    expect(() => edit(profile, 9, "extend")).toThrow("fixed endpoint");
  });

  it("rejects curves and linked projection targets", () => {
    const curve = fixture();
    curve.segments[0].kind = "bezier";
    expect(() => edit(curve, 5)).toThrow("straight lines only");
    const projected = fixture();
    projected.segments[0].projectionId = "link";
    expect(() => edit(projected, 5)).toThrow("Unlink");
  });

  it("ignores parallel, collinear, and zero-length boundaries", () => {
    const profile = fixture([]);
    profile.points.push({ id: "c", x: 5, z: 0 }, { id: "d", x: 20, z: 0 });
    profile.segments.push({ id: "overlap", startId: "c", endId: "d" }, { id: "zero", startId: "c", endId: "c" });
    expect(() => edit(profile, 9, "extend")).toThrow("No straight-line boundary");
  });

  it("rejects invalid or degenerate targets", () => {
    const profile = fixture();
    expect(() => edit(profile, NaN)).toThrow("Invalid line coordinates");
    profile.points[1].x = 0;
    expect(() => edit(profile, 5)).toThrow("zero-length");
  });
});
