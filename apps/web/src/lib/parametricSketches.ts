import * as THREE from "three";
import { localPointToWorld, normalizeQuaternion, type ConstructionPlanePose } from "@/lib/constructionPlanes";
import { createLocalId } from "@/lib/localIds";
import { canonicalizeShape } from "@/lib/workplaneShapes";
import { extrusionCenterOffset, extrusionDirection } from "@/lib/sketchExtrusion";
import type { SketchProfile, WorkplaneShape } from "@/types/sketchforge";

export const BASE_SKETCH_PLANE_ID = "construction-plane-base";

export function createSketchDocument(profile: SketchProfile, planeId: string, pose: ConstructionPlanePose, existing?: WorkplaneShape): WorkplaneShape {
  const coordinates = profile.points.flatMap((point) => [point, ...(point.handleIn ? [point.handleIn] : []), ...(point.handleOut ? [point.handleOut] : [])]);
  if (coordinates.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.z)) || pose.origin.some((value) => !Number.isFinite(value)) || pose.quaternion.some((value) => !Number.isFinite(value)) || Math.hypot(...pose.quaternion) < 1e-12) throw new Error("Sketch coordinates and frame must be finite and non-degenerate");
  const xs = coordinates.map((point) => point.x);
  const zs = coordinates.map((point) => point.z);
  const minX = xs.length ? Math.min(...xs) : 0;
  const maxX = xs.length ? Math.max(...xs) : 0;
  const minZ = zs.length ? Math.min(...zs) : 0;
  const maxZ = zs.length ? Math.max(...zs) : 0;
  const localCenter: [number, number, number] = [(minX + maxX) / 2, 0, (minZ + maxZ) / 2];
  const normalizedPose = { origin: [...pose.origin] as [number, number, number], quaternion: normalizeQuaternion(pose.quaternion) };
  const center = localPointToWorld(normalizedPose, localCenter);
  const rotation = new THREE.Euler().setFromQuaternion(new THREE.Quaternion(...normalizedPose.quaternion), "XYZ");
  return canonicalizeShape({
    id: existing?.id ?? createLocalId("sketch"), name: existing?.name ?? "Sketch", kind: "sketchProfile", color: existing?.color ?? "#3389c9",
    hidden: existing?.hidden, locked: existing?.locked,
    x: center[0], z: center[2], elevation: center[1] - 0.005,
    width: Math.max(0.01, maxX - minX), depth: Math.max(0.01, maxZ - minZ), height: 0.01, size: Math.max(0.01, maxX - minX, maxZ - minZ),
    rotation: THREE.MathUtils.radToDeg(rotation.y), rotationX: THREE.MathUtils.radToDeg(rotation.x), rotationZ: THREE.MathUtils.radToDeg(rotation.z),
    sketchProfile: structuredClone(profile), sketchPlane: { constructionPlaneId: planeId, pose: normalizedPose, localCenter },
  });
}

// Tessellation is only a display cache; the source curves remain in sketchProfile.
export function sketchWirePositions(shape: WorkplaneShape): number[] {
  const profile = shape.sketchProfile;
  if (!profile || !shape.sketchPlane) return [];
  const points = new Map(profile.points.map((point) => [point.id, point]));
  const [cx, , cz] = shape.sketchPlane.localCenter;
  const positions: number[] = [];
  for (const segment of profile.segments) {
    const start = points.get(segment.startId);
    const end = points.get(segment.endId);
    if (!start || !end) continue;
    const curve = segment.kind !== "line" && start.handleOut && end.handleIn
      ? new THREE.CubicBezierCurve(new THREE.Vector2(start.x, start.z), new THREE.Vector2(start.handleOut.x, start.handleOut.z), new THREE.Vector2(end.handleIn.x, end.handleIn.z), new THREE.Vector2(end.x, end.z)) : null;
    const samples = curve ? curve.getPoints(48) : [new THREE.Vector2(start.x, start.z), new THREE.Vector2(end.x, end.z)];
    for (let i = 1; i < samples.length; i++) positions.push(samples[i - 1].x - cx, 0, samples[i - 1].y - cz, samples[i].x - cx, 0, samples[i].y - cz);
  }
  return positions;
}

export function placeSavedSketchExtrusion(raw: WorkplaneShape, sketch: WorkplaneShape, settings: WorkplaneShape): WorkplaneShape {
  if (sketch.kind !== "sketchProfile" || !sketch.sketchPlane || !sketch.sketchProfile) throw new Error("Extrusion source must be an independent sketch");
  const pose = sketch.sketchPlane.pose;
  const localCenter: [number, number, number] = [raw.x, extrusionCenterOffset(raw.height, extrusionDirection(settings)), raw.z];
  const center = localPointToWorld(pose, localCenter);
  const rotation = new THREE.Euler().setFromQuaternion(new THREE.Quaternion(...pose.quaternion), "XYZ");
  return canonicalizeShape({
    ...raw,
    x: center[0], z: center[2], elevation: center[1] - raw.height / 2,
    rotation: THREE.MathUtils.radToDeg(rotation.y), rotationX: THREE.MathUtils.radToDeg(rotation.x), rotationZ: THREE.MathUtils.radToDeg(rotation.z),
    sketchOperation: "extrude", sketchProfile: sketch.sketchProfile,
    sketchPlane: { ...sketch.sketchPlane, localCenter },
    sketchFeature: { ...(settings.sketchFeature?.kind === "extrusion" ? settings.sketchFeature : { kind: "extrusion" }), sketchId: sketch.id },
  });
}

export function sketchNodeDependencies(shape: WorkplaneShape): string[] {
  const plane = shape.constructionPlane;
  return [...new Set([
    ...(shape.sketchPlane ? [shape.sketchPlane.constructionPlaneId] : []),
    ...(plane?.kind === "face" ? [plane.sourceShapeId] : plane?.kind === "angle" ? [plane.referencePlaneId] : plane?.kind === "midplane" ? [plane.firstPlaneId, plane.secondPlaneId] : []),
    ...(shape.sketchFeature?.kind === "extrusion" && shape.sketchFeature.sketchId ? [shape.sketchFeature.sketchId] : []),
    ...(shape.sketchProfile?.projections?.map((link) => link.sourceShapeId) ?? []),
  ])].filter((id) => id !== BASE_SKETCH_PLANE_ID);
}

export function orderedSketchNodes(shapes: WorkplaneShape[]): WorkplaneShape[] {
  const nodes = new Map(shapes.map((shape) => [shape.id, shape]));
  if (nodes.size !== shapes.length) throw new Error("Duplicate document node ID");
  const result: WorkplaneShape[] = [];
  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const shape of shapes) {
    const dependencies = sketchNodeDependencies(shape);
    indegree.set(shape.id, dependencies.length);
    if (shape.kind === "sketchProfile" && shape.sketchPlane?.constructionPlaneId !== BASE_SKETCH_PLANE_ID && nodes.get(shape.sketchPlane?.constructionPlaneId ?? "")?.kind !== "constructionPlane") throw new Error("Independent sketch requires an existing reference plane");
    if (shape.sketchFeature?.kind === "extrusion" && shape.sketchFeature.sketchId && nodes.get(shape.sketchFeature.sketchId)?.kind !== "sketchProfile") throw new Error("Extrusion source must reference an independent sketch");
    for (const id of dependencies) {
      if (!nodes.has(id)) throw new Error(`Missing sketch or plane reference: ${id}`);
      const entries = dependents.get(id) ?? [];
      entries.push(shape.id);
      dependents.set(id, entries);
    }
  }
  const queue = shapes.filter((shape) => indegree.get(shape.id) === 0);
  for (let index = 0; index < queue.length; index++) {
    const shape = queue[index];
    result.push(shape);
    for (const id of dependents.get(shape.id) ?? []) {
      const remaining = indegree.get(id)! - 1;
      indegree.set(id, remaining);
      if (remaining === 0) queue.push(nodes.get(id)!);
    }
  }
  if (result.length !== shapes.length) throw new Error("Circular sketch or plane dependency");
  return result;
}

export function sketchDeletionBlockers(shapes: WorkplaneShape[], ids: readonly string[]) {
  const deleted = new Set(ids);
  return shapes.filter((shape) => !deleted.has(shape.id) && sketchNodeDependencies(shape).some((id) => deleted.has(id)));
}
