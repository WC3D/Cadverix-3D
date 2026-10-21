// Section and overhang tools follow henmedia/layerling (AGPL-3.0), f3092321.
import * as THREE from "three";
export type SectionSettings = { enabled: boolean; axis: "x" | "y" | "z"; offset: number; flipped: boolean };
export const DEFAULT_SECTION: SectionSettings = { enabled: false, axis: "z", offset: 10, flipped: false };
export function sectionPlane(settings: SectionSettings) {
  if (!settings.enabled) return null;
  // UI axes are Z-up; the viewport is Y-up.
  const normal = new THREE.Vector3(settings.axis === "x" ? 1 : 0, settings.axis === "z" ? 1 : 0, settings.axis === "y" ? 1 : 0);
  const sign = settings.flipped ? -1 : 1;
  return new THREE.Plane(normal.multiplyScalar(sign), -sign * settings.offset);
}

export function overhangPositions(geometry: THREE.BufferGeometry, matrix: THREE.Matrix4, angle: number) {
  const positions: number[] = [], attribute = geometry.getAttribute("position"), index = geometry.getIndex();
  if (!attribute) return positions;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), ab = new THREE.Vector3(), ac = new THREE.Vector3();
  const limit = Math.cos(THREE.MathUtils.degToRad(Math.min(89, Math.max(1, angle))));
  const flip = matrix.determinant() < 0 ? -1 : 1;
  for (let offset = 0; offset + 2 < (index?.count ?? attribute.count); offset += 3) {
    a.fromBufferAttribute(attribute, index ? index.getX(offset) : offset).applyMatrix4(matrix);
    b.fromBufferAttribute(attribute, index ? index.getX(offset + 1) : offset + 1).applyMatrix4(matrix);
    c.fromBufferAttribute(attribute, index ? index.getX(offset + 2) : offset + 2).applyMatrix4(matrix);
    if (Math.max(a.y, b.y, c.y) <= 0.05) continue;
    ab.subVectors(b, a); ac.subVectors(c, a); ab.cross(ac);
    if (ab.lengthSq() > 1e-16 && -ab.y * flip / ab.length() > limit) positions.push(...a.toArray(), ...b.toArray(), ...c.toArray());
  }
  return positions;
}
