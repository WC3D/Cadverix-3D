import { restoreShapeBeforeEdgeTreatment } from "@/lib/edgeTreatmentHistory";
import type { ShapeFeatureKind, WorkplaneShape } from "@/types/sketchforge";

export type ShapeFeatureRemoval =
  | { type: "replace"; shape: WorkplaneShape }
  | { type: "delete-shape" }
  | { type: "ungroup" };

export function shapeFeatureKinds(shape: WorkplaneShape): ShapeFeatureKind[] {
  if (shape.kind === "sketchProfile") return [];
  const kinds: ShapeFeatureKind[] = [];
  if ((shape.edgeTreatmentHistory?.length ?? 0) > 0) kinds.push("edge");
  if (shape.sculpted && shape.sculptSource) kinds.push("sculpt");
  if (shape.sketchProfile) kinds.push("sketch");
  if (shape.groupedShapes?.length) kinds.push("group");
  return kinds;
}

export function shapeFeatureEnabled(shape: WorkplaneShape, kind: ShapeFeatureKind) {
  return !shape.disabledFeatures?.includes(kind);
}

export function withShapeFeatureEnabled(shape: WorkplaneShape, kind: ShapeFeatureKind, enabled: boolean): WorkplaneShape {
  const disabled = new Set(shape.disabledFeatures ?? []);
  if (enabled) disabled.delete(kind);
  else disabled.add(kind);
  return { ...shape, disabledFeatures: disabled.size ? [...disabled] : undefined };
}

function sourceWithCurrentState(source: WorkplaneShape, current: WorkplaneShape): WorkplaneShape {
  return {
    ...source,
    id: current.id,
    name: current.name,
    color: current.color,
    hidden: current.hidden,
    locked: current.locked,
    hole: current.hole,
    disabledFeatures: current.disabledFeatures,
    sculptSource: current.sculptSource,
    sculpted: current.sculpted,
  };
}

function sculptSourceWithCurrentFrame(shape: WorkplaneShape): WorkplaneShape {
  if (!shape.sculptSource) return shape;
  return {
    ...sourceWithCurrentState(shape.sculptSource, shape),
    x: shape.x,
    z: shape.z,
    elevation: shape.elevation,
    width: shape.width,
    depth: shape.depth,
    height: shape.height,
    size: shape.size,
    rotation: shape.rotation,
    rotationX: shape.rotationX,
    rotationZ: shape.rotationZ,
    mirrorX: shape.mirrorX,
    mirrorY: shape.mirrorY,
    mirrorZ: shape.mirrorZ,
  };
}

function disabledFeaturesWithout(shape: WorkplaneShape, kind: ShapeFeatureKind) {
  const disabledFeatures = shape.disabledFeatures?.filter((candidate) => candidate !== kind);
  return disabledFeatures?.length ? disabledFeatures : undefined;
}

export function removeShapeFeature(shape: WorkplaneShape, kind: ShapeFeatureKind): ShapeFeatureRemoval | null {
  if (kind === "edge") {
    const firstEntry = shape.edgeTreatmentHistory?.[0];
    if (!firstEntry) return null;
    return {
      type: "replace",
      shape: {
        ...restoreShapeBeforeEdgeTreatment(shape, firstEntry),
        disabledFeatures: disabledFeaturesWithout(shape, kind),
      },
    };
  }
  if (kind === "sculpt") {
    if (!shape.sculpted || !shape.sculptSource) return null;
    return {
      type: "replace",
      shape: {
        ...sculptSourceWithCurrentFrame(shape),
        sculpted: undefined,
        sculptSource: undefined,
        disabledFeatures: disabledFeaturesWithout(shape, kind),
      },
    };
  }
  if (kind === "sketch") {
    return shape.sketchProfile ? { type: "delete-shape" } : null;
  }
  return shape.groupedShapes?.length ? { type: "ungroup" } : null;
}

export function shapeWithFeatureToggles(shape: WorkplaneShape): WorkplaneShape {
  const disabled = new Set(shape.disabledFeatures ?? []);
  let effective = shape;

  if (disabled.has("edge") && shape.edgeTreatmentHistory?.length) {
    effective = sourceWithCurrentState(restoreShapeBeforeEdgeTreatment(shape, shape.edgeTreatmentHistory[0]), shape);
  }
  if (disabled.has("sculpt") && shape.sculptSource) {
    effective = sculptSourceWithCurrentFrame(shape);
  }
  if (disabled.has("group") && effective.groupedShapes?.length) {
    effective = { ...effective, importedMesh: undefined, cadBrep: undefined, cadBrepFrame: undefined, cadDisplayEdges: undefined };
  }
  if (disabled.has("sketch") && shape.sketchProfile) {
    effective = { ...effective, hidden: true };
  }
  return effective;
}
