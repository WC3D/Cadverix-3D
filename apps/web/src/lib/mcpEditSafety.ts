import type { WorkplaneShape } from "@/types/sketchforge";

export function requireUnlockedObjects(shapes: Pick<WorkplaneShape, "locked">[]) {
  if (shapes.some((shape) => shape.locked)) throw new Error("Unlock the objects before changing them");
}
