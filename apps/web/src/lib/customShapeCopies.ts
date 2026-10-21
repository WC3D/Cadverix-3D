import { createLocalId } from "@/lib/localIds";
import { cloneWorkplaneShapeTreeWithFreshIds } from "@/lib/workplaneShapes";
import type { WorkplaneShape } from "@/types/sketchforge";

// Keep the baked coordinates, not live links back into the originating project.
export function independentLibraryShape(source: WorkplaneShape): WorkplaneShape {
  function detach(shape: WorkplaneShape): WorkplaneShape {
    return {
      ...shape,
      sketchProfile: shape.sketchProfile?.projections?.length ? {
        ...shape.sketchProfile, projections: [],
        points: shape.sketchProfile.points.map((point) => ({ ...point, projectionId: undefined })),
        segments: shape.sketchProfile.segments.map((segment) => ({ ...segment, projectionId: undefined })),
      } : shape.sketchProfile,
      // An unmatched plane ID makes the editor use the saved pose as a fixed frame.
      sketchPlane: shape.sketchPlane ? { ...shape.sketchPlane, constructionPlaneId: createLocalId("library-plane") } : undefined,
      groupedShapes: shape.groupedShapes?.map(detach),
      sculptSource: shape.sculptSource ? detach(shape.sculptSource) : undefined,
      edgeTreatmentHistory: shape.edgeTreatmentHistory?.map((entry) => ({ ...entry, before: detach(entry.before) })),
    };
  }
  return { ...detach(cloneWorkplaneShapeTreeWithFreshIds(source, "library")), locked: false, hidden: false };
}
