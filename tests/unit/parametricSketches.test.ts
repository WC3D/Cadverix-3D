import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { localDirectionToWorld, localPointToWorld, principalPlanePose, threePointConstructionPlanePose, worldPointToLocal } from "@/lib/constructionPlanes";
import { quaternionForShape } from "@/lib/geometryRotation";
import { BASE_SKETCH_PLANE_ID, createSketchDocument, orderedSketchNodes, placeSavedSketchExtrusion, sketchDeletionBlockers, sketchWirePositions } from "@/lib/parametricSketches";
import { rectangleSketchGeometry } from "@/lib/sketchRectangles";
import { refreshSketchPlanePose } from "@/lib/sketchExtrusion";
import { isReferenceShape } from "@/lib/workplaneShapes";
import type { WorkplaneShape } from "@/types/sketchforge";

function profile() { return rectangleSketchGeometry({ minX: -10, maxX: 10, minZ: -5, maxZ: 5 }); }
function plane(id: string, offset = 0): WorkplaneShape {
  const pose = principalPlanePose("xy", offset);
  return { id, name: id, kind: "constructionPlane", color: "#888888", x: 0, z: offset, elevation: 0, width: 100, depth: 100, height: 0.1, size: 100, rotation: 0, constructionPlane: { kind: "principal", principal: "xy", offset, pose } };
}

describe("independent parametric sketches", () => {
  it.each(["xy", "xz", "yz"] as const)("retains local geometry and produces wire-only placement on %s", (principal) => {
    const geometry = profile();
    const pose = principalPlanePose(principal, 40, 15);
    const sketch = createSketchDocument(geometry, "parent", pose);
    expect(sketch.kind).toBe("sketchProfile");
    expect(isReferenceShape(sketch)).toBe(true);
    expect(sketch.importedMesh).toBeUndefined();
    expect(sketch.cadBrep).toBeUndefined();
    expect(sketch.sketchProfile).toEqual(geometry);
    expect(sketch.sketchProfile).not.toBe(geometry);
    const positions = sketchWirePositions(sketch);
    expect(positions).toHaveLength(24);
    const displayed = new THREE.Vector3(...positions.slice(0, 3) as [number, number, number])
      .applyQuaternion(quaternionForShape(sketch)).add(new THREE.Vector3(sketch.x, sketch.elevation! + sketch.height / 2, sketch.z));
    const first = geometry.points[0];
    expect(displayed.distanceTo(new THREE.Vector3(...localPointToWorld(pose, [first.x, 0, first.z])))).toBeLessThan(1e-9);
    const changed = refreshSketchPlanePose(sketch, principalPlanePose(principal, 90, 30));
    expect(changed.sketchProfile).toBe(sketch.sketchProfile);
    expect(changed.sketchPlane?.localCenter).toEqual(sketch.sketchPlane?.localCenter);
  });

  it("orders reusable sketch inputs, prevents cycles, and protects referenced nodes", () => {
    const parent = plane("plane");
    const sketch = createSketchDocument(profile(), parent.id, parent.constructionPlane!.pose);
    const raw = { ...sketch, id: "body", kind: "mesh" as const, height: 12, x: 0, z: 0 };
    const body = placeSavedSketchExtrusion(raw, sketch, raw);
    expect(orderedSketchNodes([body, sketch, parent]).map((node) => node.id)).toEqual([parent.id, sketch.id, body.id]);
    expect(sketchDeletionBlockers([body, sketch, parent], [parent.id])).toEqual([body, sketch]);
    expect(sketchDeletionBlockers([body, sketch, parent], [sketch.id])).toEqual([body]);
    expect(sketchDeletionBlockers([body, sketch, parent], [sketch.id, body.id])).toEqual([]);
    expect(() => orderedSketchNodes([body, sketch])).toThrow(/reference/);
    expect(() => orderedSketchNodes([body, sketch, { ...parent, constructionPlane: { kind: "face", sourceShapeId: body.id, attachment: { normalizedOrigin: [0, 0, 0], localQuaternion: [0, 0, 0, 1] }, pose: parent.constructionPlane!.pose } }])).toThrow(/Circular/);
    expect(() => orderedSketchNodes([sketch, sketch])).toThrow(/Duplicate/);
    expect(() => orderedSketchNodes([{ ...body, sketchFeature: { kind: "extrusion", sketchId: parent.id } }, parent])).toThrow(/independent sketch/);
  });

  it("keeps the sketch's world frame when creating positive, reversed, and symmetric features", () => {
    const parent = plane("plane", 40);
    const sketch = createSketchDocument(profile(), parent.id, parent.constructionPlane!.pose);
    for (const direction of ["positive", "negative", "symmetric"] as const) {
      const raw = { ...sketch, id: "body", kind: "mesh" as const, height: 20, x: 0, z: 0, sketchFeature: { kind: "extrusion" as const, direction } };
      const body = placeSavedSketchExtrusion(raw, sketch, raw);
      expect(body.sketchFeature).toEqual({ kind: "extrusion", direction, sketchId: sketch.id });
      expect(body.z).toBeCloseTo(40 + (direction === "positive" ? 10 : direction === "negative" ? -10 : 0));
      expect(body.sketchProfile).toBe(sketch.sketchProfile);
    }
  });

  it("sorts long reference chains without recursive stack overflow", () => {
    const nodes = Array.from({ length: 5000 }, (_, index) => {
      const entry = plane(`plane-${index}`);
      if (index > 0) entry.constructionPlane = { kind: "angle", referencePlaneId: `plane-${index - 1}`, angle: 0, pose: principalPlanePose("xz") };
      return entry;
    });
    expect(orderedSketchNodes(nodes.reverse())).toHaveLength(5000);
  });

  it("rejects corrupt coordinates and degenerate frames without modifying the original", () => {
    const geometry = profile();
    expect(() => createSketchDocument(geometry, BASE_SKETCH_PLANE_ID, { origin: [0, 0, 0], quaternion: [0, 0, 0, 0] })).toThrow(/frame/);
    expect(() => createSketchDocument({ ...geometry, points: [{ id: "bad", x: NaN, z: 0 }] }, BASE_SKETCH_PLANE_ID, principalPlanePose("xz"))).toThrow(/finite/);
  });
});

describe("three-point reference planes", () => {
  it("uses point one as the origin and the first edge as local X", () => {
    const pose = threePointConstructionPlanePose([3, 7, 40], [13, 7, 40], [3, 17, 40]);
    expect(pose.origin).toEqual([3, 7, 40]);
    expect(localDirectionToWorld(pose, [1, 0, 0])).toEqual([1, 0, 0]);
    const point = [2, 0, 5] as [number, number, number];
    const restored = worldPointToLocal(pose, localPointToWorld(pose, point));
    restored.forEach((value, index) => expect(value).toBeCloseTo(point[index], 10));
  });
  it("handles model scale and rejects collinear, repeated, and non-finite points", () => {
    for (const scale of [1e-6, 1, 1e6]) expect(threePointConstructionPlanePose([0, 0, 0], [scale, 0, 0], [0, scale, 0]).quaternion.every(Number.isFinite)).toBe(true);
    expect(() => threePointConstructionPlanePose([0, 0, 0], [1, 1, 1], [2, 2, 2])).toThrow(/non-collinear/);
    expect(() => threePointConstructionPlanePose([0, 0, 0], [0, 0, 0], [1, 0, 0])).toThrow();
    expect(() => threePointConstructionPlanePose([NaN, 0, 0], [1, 0, 0], [0, 1, 0])).toThrow(/finite/);
  });
});
