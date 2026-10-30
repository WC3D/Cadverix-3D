import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { quaternionForShape } from "@/lib/geometryRotation";
import { localPointToWorld, principalPlanePose } from "@/lib/constructionPlanes";
import { extrusionCenterOffset, isSketchExtrusion, refreshSketchPlanePose, resizeSketchExtrusion, sketchHasDependentEdits, type ExtrusionDirection } from "@/lib/sketchExtrusion";
import type { WorkplaneShape } from "@/types/sketchforge";

function shape(direction: ExtrusionDirection = "positive"): WorkplaneShape {
  return {
    id: "extrusion", name: "Circle", kind: "mesh", color: "#888888",
    x: 12, z: 18, elevation: 15, width: 30, depth: 30, height: 10, size: 30,
    rotation: 0, rotationX: 90, rotationZ: 0,
    sketchProfile: { points: [], segments: [] }, sketchOperation: "extrude",
    sketchFeature: { kind: "extrusion", direction },
    importedMesh: { positions: [0, 0, 0, 1, 10, 0, 1, 0, 1], baseWidth: 30, baseDepth: 30, baseHeight: 10, triangleCount: 1, sourceFormat: "json" },
    cadBrep: "exact geometry", cadBrepFrame: { x: 0, z: 0, elevation: 0, width: 30, depth: 30, height: 10 },
  };
}

function center(source: WorkplaneShape) {
  return new THREE.Vector3(source.x, (source.elevation ?? 0) + source.height / 2, source.z);
}

describe("parametric extrusion distance", () => {
  it("preserves deliberate body rotation and applies only the parent's pose delta", () => {
    const source = shape();
    const pose = principalPlanePose("xy");
    source.rotation = 25;
    source.sketchPlane = { constructionPlaneId: "front", pose, localCenter: [12, 18, -20] };
    expect(refreshSketchPlanePose(source, pose)).toBe(source);
    const nextPose = principalPlanePose("yz", 7);
    const updated = refreshSketchPlanePose(source, nextPose);
    const expected = new THREE.Quaternion(...nextPose.quaternion)
      .multiply(new THREE.Quaternion(...pose.quaternion).invert())
      .multiply(quaternionForShape(source));
    expect(quaternionForShape(updated).angleTo(expected)).toBeCloseTo(0);
    expect(center(updated).distanceTo(new THREE.Vector3(...localPointToWorld(nextPose, source.sketchPlane.localCenter)))).toBeLessThan(1e-10);
    expect(updated.importedMesh).toBe(source.importedMesh);
    expect(refreshSketchPlanePose(updated, nextPose)).toBe(updated);
  });
  it("protects downstream work that cannot yet be rebuilt from a base sketch", () => {
    const source = shape();
    expect(sketchHasDependentEdits(source)).toBe(false);
    for (const patch of [
      { sculpted: true },
      { edgeTreatments: [{ kind: "fillet" as const, amount: 1, edgeCount: 1 }] },
      { groupedShapes: [shape()] },
      { taperTopWidth: 15 },
    ]) expect(sketchHasDependentEdits({ ...source, ...patch })).toBe(true);
  });
  for (const rotation of [{ rotationX: 0 }, { rotationX: 90 }, { rotationZ: 270 }, { rotation: 27, rotationX: 34, rotationZ: 12 }]) {
    it(`keeps the sketch face and cross-section fixed at ${JSON.stringify(rotation)}`, () => {
      const source = { ...shape(), rotationX: 0, ...rotation };
      const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternionForShape(source));
      const start = center(source).addScaledVector(normal, -source.height / 2);
      const updated = { ...source, ...resizeSketchExtrusion(source, 40) };
      expect(center(updated).addScaledVector(normal, -updated.height / 2).distanceTo(start)).toBeLessThan(1e-10);
      expect(updated.width).toBe(30);
      expect(updated.depth).toBe(30);
      expect(quaternionForShape(updated).angleTo(quaternionForShape(source))).toBeCloseTo(0);
      expect(updated.importedMesh).toBe(source.importedMesh);
      expect(updated.cadBrep).toBe(source.cadBrep);
      expect(updated.cadBrepFrame).toBe(source.cadBrepFrame);
      expect(source.height).toBe(10);
    });
  }

  for (const direction of ["negative", "symmetric"] as const) {
    it(`preserves the sketch plane for ${direction} extrusion`, () => {
      const source = shape(direction);
      const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternionForShape(source));
      const start = center(source).addScaledVector(normal, -extrusionCenterOffset(source.height, direction));
      const updated = { ...source, ...resizeSketchExtrusion(source, 40) };
      expect(center(updated).addScaledVector(normal, -extrusionCenterOffset(updated.height, direction)).distanceTo(start)).toBeLessThan(1e-10);
    });
  }

  it("updates its plane-local center so attachment refresh cannot rotate or recenter it", () => {
    const source = shape();
    source.sketchPlane = { constructionPlaneId: "front", pose: principalPlanePose("xy"), localCenter: [12, 18, -20] };
    const updated = { ...source, ...resizeSketchExtrusion(source, 40, "bottom") };
    const attachment = updated.sketchPlane!;
    const world = new THREE.Vector3(...localPointToWorld(attachment.pose, attachment.localCenter));
    expect(world.distanceTo(center(updated))).toBeLessThan(1e-10);
    expect(updated.rotationX).toBe(90);
  });

  it("rejects invalid distances and does not misidentify sweep or revolve features", () => {
    for (const value of [0, -1, Number.NaN, Infinity]) expect(() => resizeSketchExtrusion(shape(), value)).toThrow();
    expect(isSketchExtrusion(shape())).toBe(true);
    expect(isSketchExtrusion({ ...shape(), sketchOperation: "revolve" })).toBe(false);
    expect(isSketchExtrusion({ ...shape(), sketchFeature: { kind: "sweep", pathSegmentIds: [], sectionSegmentIds: [] } })).toBe(false);
  });
});
