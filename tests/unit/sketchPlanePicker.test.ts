import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createSketchPlanePicker, highlightSketchPlane, SKETCH_PLANES } from "@/lib/sketchPlanePicker";

describe("sketch plane picker", () => {
  it("shows three pickable principal planes with the project's Y-up convention", () => {
    const group = createSketchPlanePicker(100);
    group.updateMatrixWorld(true);
    expect(group.children.map((child) => child.userData.sketchPlane)).toEqual(SKETCH_PLANES.map((plane) => plane.id));
    for (const [plane, origin, direction] of [
      ["xz", [12, 60, 18], [0, -1, 0]],
      ["xy", [12, 18, 60], [0, 0, -1]],
      ["yz", [60, 12, 18], [-1, 0, 0]],
    ] as const) {
      const raycaster = new THREE.Raycaster(new THREE.Vector3(...origin), new THREE.Vector3(...direction));
      const hits = raycaster.intersectObjects(group.children, false);
      expect(hits[0]?.object.userData.sketchPlane).toBe(plane);
    }
  });

  it("highlights only the hovered plane and resets it on leave", () => {
    const group = createSketchPlanePicker(100);
    highlightSketchPlane(group, "xy");
    for (const child of group.children as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[]) {
      expect(child.material.opacity).toBe(child.userData.sketchPlane === "xy" ? 0.55 : 0.22);
      expect(child.material.depthWrite).toBe(false);
    }
    highlightSketchPlane(group, null);
    expect(group.children.every((child) => (child as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>).material.opacity === 0.22)).toBe(true);
  });
});
