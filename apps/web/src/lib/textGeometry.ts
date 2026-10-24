import type { BufferGeometry } from "three";
import { shapeDepth, shapeWidth } from "@/lib/workplaneShapes";
import type { WorkplaneShape } from "@/types/sketchforge";

export function fitTextGeometry(geometry: BufferGeometry, shape: WorkplaneShape) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (box && !box.isEmpty()) {
    // Fit each local axis independently before applying the object's rotation.
    geometry.scale(
      shapeWidth(shape) / Math.max(0.001, box.max.x - box.min.x),
      shapeDepth(shape) / Math.max(0.001, box.max.y - box.min.y),
      shape.height / Math.max(0.001, box.max.z - box.min.z),
    );
  }
  geometry.rotateX(-Math.PI / 2);
  geometry.computeBoundingBox();
  const rotatedBox = geometry.boundingBox;
  if (rotatedBox && !rotatedBox.isEmpty()) {
    geometry.translate(
      -(rotatedBox.min.x + rotatedBox.max.x) / 2,
      -rotatedBox.min.y,
      -(rotatedBox.min.z + rotatedBox.max.z) / 2,
    );
  }
  return geometry;
}
