import { describe, expect, it } from "vitest";
import { inspectSketchEndpoints, SKETCH_REPAIR_GAP_LIMIT } from "@/lib/sketchRepair";
import type { SketchProfile } from "@/types/sketchforge";

function fixture(gap = 0.2): SketchProfile {
  return {
    points: [{ id: "a", x: -10, z: 0 }, { id: "b", x: 0, z: 0 }, { id: "c", x: gap, z: 0 }, { id: "d", x: 10, z: 0 }],
    segments: [{ id: "first", startId: "a", endId: "b" }, { id: "second", startId: "c", endId: "d" }],
  };
}

describe("Repair Sketch endpoint inspection", () => {
  it("finds open endpoints and a nearby gap without changing geometry", () => {
    const profile = fixture();
    const before = structuredClone(profile);
    const result = inspectSketchEndpoints(profile);
    expect(result.endpoints.map((point) => point.id)).toEqual(["a", "b", "c", "d"]);
    expect(result.gaps).toHaveLength(1);
    expect(result.gaps[0]).toMatchObject({ start: { id: "b" }, end: { id: "c" }, distance: 0.2 });
    expect(profile).toEqual(before);
  });

  it.each([0, SKETCH_REPAIR_GAP_LIMIT])("includes unjoined coincident endpoints and the inclusive limit (%s)", (gap) => {
    expect(inspectSketchEndpoints(fixture(gap)).gaps[0].distance).toBe(gap);
  });

  it("does not flag distant endpoints or close endpoints of a single short line as gaps", () => {
    expect(inspectSketchEndpoints(fixture(0.501)).gaps).toEqual([]);
    const profile: SketchProfile = { points: [{ id: "a", x: 0, z: 0 }, { id: "b", x: 0.1, z: 0 }], segments: [{ id: "tiny", startId: "a", endId: "b" }] };
    const result = inspectSketchEndpoints(profile);
    expect(result.endpoints).toHaveLength(2);
    expect(result.gaps).toEqual([]);
  });

  it("finds the open ends of a single path but not its connected interior points", () => {
    const profile = fixture();
    profile.segments.push({ id: "join", startId: "a", endId: "d" });
    expect(inspectSketchEndpoints(profile).endpoints.map((point) => point.id)).toEqual(["b", "c"]);
    expect(inspectSketchEndpoints(profile).gaps).toHaveLength(1);
  });

  it("reports no open endpoints on a closed loop", () => {
    const profile = fixture();
    profile.segments.push({ id: "join1", startId: "b", endId: "c" }, { id: "join2", startId: "d", endId: "a" });
    expect(inspectSketchEndpoints(profile)).toEqual({ endpoints: [], gaps: [] });
  });

  it("supports curve endpoints and ignores unused handles and standalone points", () => {
    const profile = fixture();
    profile.segments[0].kind = "bezier";
    profile.points[1].handleIn = { x: 3, z: 5 };
    profile.points.push({ id: "unused", x: 0.1, z: 0 });
    expect(inspectSketchEndpoints(profile).endpoints).toHaveLength(4);
    expect(inspectSketchEndpoints(profile).gaps).toHaveLength(1);
  });

  it("excludes linked reference geometry", () => {
    const profile = fixture();
    profile.segments[1].projectionId = "reference";
    expect(inspectSketchEndpoints(profile).endpoints.map((point) => point.id)).toEqual(["a", "b"]);
    expect(inspectSketchEndpoints(profile).gaps).toEqual([]);
    profile.points[0].projectionId = "reference";
    expect(inspectSketchEndpoints(profile).endpoints).toEqual([]);
  });

  it("does not count branch junctions as open endpoints", () => {
    const profile = fixture();
    profile.points.push({ id: "branch", x: -5, z: 5 });
    profile.segments.push({ id: "join", startId: "b", endId: "c" }, { id: "branch", startId: "b", endId: "branch" });
    expect(inspectSketchEndpoints(profile).endpoints.map((point) => point.id).sort()).toEqual(["a", "branch", "d"]);
  });

  it("uses actual distance rather than just horizontal separation", () => {
    const profile = fixture(0.4);
    profile.points[2].z = 0.4;
    expect(inspectSketchEndpoints(profile).gaps).toEqual([]);
  });

  it("ignores invalid segments and non-finite points", () => {
    const profile = fixture();
    profile.points[0].x = NaN;
    profile.segments.push({ id: "missing", startId: "none", endId: "b" }, { id: "self", startId: "c", endId: "c" });
    expect(inspectSketchEndpoints(profile).endpoints.map((point) => point.id)).toEqual(["c", "d"]);
    expect(inspectSketchEndpoints({ points: [], segments: [] })).toEqual({ endpoints: [], gaps: [] });
  });
});
