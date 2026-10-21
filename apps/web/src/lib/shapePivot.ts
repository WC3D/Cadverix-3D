// Adapted from henmedia/layerling rotationPivot.ts (AGPL-3.0), f3092321.
import * as THREE from "three";
import { quaternionForShape } from "@/lib/geometryRotation";
import type { WorkplaneShape } from "@/types/sketchforge";

function pivotFrame(shape: WorkplaneShape) {
  return {
    center: new THREE.Vector3(shape.x, (shape.elevation ?? 0) + shape.height / 2, shape.z),
    size: new THREE.Vector3(shape.width, shape.height, shape.depth).max(new THREE.Vector3(1e-6, 1e-6, 1e-6)),
    mirror: new THREE.Vector3(shape.mirrorX ? -1 : 1, shape.mirrorY ? -1 : 1, shape.mirrorZ ? -1 : 1),
    rotation: quaternionForShape(shape),
  };
}
export function shapePivotWorld(shape: WorkplaneShape): THREE.Vector3 | null {
  if (!shape.rotationPivot?.every(Number.isFinite)) return null;
  const frame = pivotFrame(shape);
  return new THREE.Vector3(...shape.rotationPivot).multiply(frame.size).multiply(frame.mirror).applyQuaternion(frame.rotation).add(frame.center);
}
export function shapePivotFromWorld(shape: WorkplaneShape, point: THREE.Vector3): [number, number, number] {
  const frame = pivotFrame(shape);
  return point.clone().sub(frame.center).applyQuaternion(frame.rotation.invert()).multiply(frame.mirror).divide(frame.size).toArray() as [number, number, number];
}
export function carryShapePivot(source: WorkplaneShape, target: WorkplaneShape): WorkplaneShape {
  const point = shapePivotWorld(source);
  return point ? { ...target, rotationPivot: shapePivotFromWorld(target, point) } : target;
}
