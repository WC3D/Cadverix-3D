import * as THREE from "three";
import { quaternionForShape } from "@/lib/geometryRotation";
import { localPointToWorld, worldPointToLocal, type ConstructionPlanePose } from "@/lib/constructionPlanes";
import { canonicalizeShape, shapeHasTaper } from "@/lib/workplaneShapes";
import type { SketchFeature, WorkplaneShape } from "@/types/sketchforge";

export type ExtrusionDirection = NonNullable<Extract<SketchFeature, { kind: "extrusion" }>["direction"]>;

export function isSketchExtrusion(shape: WorkplaneShape) {
  return Boolean(shape.kind !== "sketchProfile" && shape.sketchProfile && shape.sketchFeature?.kind !== "sweep" && shape.sketchOperation !== "revolve" && !shape.sketchRevolve);
}

export function sketchHasDependentEdits(shape: WorkplaneShape) {
  return Boolean(shape.edgeTreatmentHistory?.length || shape.edgeTreatments?.length || shape.sculpted || shape.groupedShapes?.length || shapeHasTaper(shape));
}

export function refreshSketchPlanePose(shape: WorkplaneShape, pose: ConstructionPlanePose): WorkplaneShape {
  const attachment = shape.sketchPlane;
  if (!attachment) return shape;
  const previousRotation = new THREE.Quaternion(...attachment.pose.quaternion).normalize();
  const nextRotation = new THREE.Quaternion(...pose.quaternion).normalize();
  if (Math.abs(previousRotation.dot(nextRotation)) > 1 - 1e-12 && pose.origin.every((value, index) => Math.abs(value - attachment.pose.origin[index]) < 1e-9)) return shape;
  const delta = nextRotation.multiply(previousRotation.invert());
  const rotation = new THREE.Euler().setFromQuaternion(delta.multiply(quaternionForShape(shape)), "XYZ");
  const center = localPointToWorld(pose, attachment.localCenter);
  return canonicalizeShape({
    ...shape,
    x: center[0], z: center[2], elevation: center[1] - shape.height / 2,
    rotationX: THREE.MathUtils.radToDeg(rotation.x),
    rotation: THREE.MathUtils.radToDeg(rotation.y),
    rotationZ: THREE.MathUtils.radToDeg(rotation.z),
    sketchPlane: { ...attachment, pose },
  });
}

export function extrusionDirection(shape: WorkplaneShape): ExtrusionDirection {
  return shape.sketchFeature?.kind === "extrusion" ? shape.sketchFeature.direction ?? "positive" : "positive";
}

export function extrusionCenterOffset(distance: number, direction: ExtrusionDirection) {
  return direction === "symmetric" ? 0 : distance / 2 * (direction === "negative" ? -1 : 1);
}

// Change the feature along its own normal; never bake its mesh into the world frame.
export function resizeSketchExtrusion(shape: WorkplaneShape, distance: number, anchor: "start" | "bottom" | "top" = "start"): Partial<WorkplaneShape> {
  if (!Number.isFinite(distance) || distance <= 0) throw new RangeError("Extrusion distance must be positive");
  const delta = anchor === "start"
    ? extrusionCenterOffset(distance - shape.height, extrusionDirection(shape))
    : (distance - shape.height) / 2 * (anchor === "top" ? -1 : 1);
  const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternionForShape(shape));
  const center = new THREE.Vector3(shape.x, (shape.elevation ?? 0) + shape.height / 2, shape.z).addScaledVector(normal, delta);
  return {
    height: distance,
    x: center.x,
    z: center.z,
    elevation: center.y - distance / 2,
    ...(shape.sketchPlane ? { sketchPlane: { ...shape.sketchPlane, localCenter: worldPointToLocal(shape.sketchPlane.pose, center.toArray()) } } : {}),
  };
}
