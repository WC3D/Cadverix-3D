// Face healing adapted from henmedia/layerling cadDeleteFaces.ts (AGPL-3.0).
import type { OcctKernel, ShapeHandle } from "occt-wasm";
import type { ModifierFace, ModifierJob } from "@/lib/layerlingModifierTypes";
import { rethrowCadModifierMemoryFault } from "@/lib/cadModifierRuntime";

export function cadFaceList(cad: OcctKernel, solid: ShapeHandle): ModifierFace[] {
  const faces = cad.getSubShapes(solid, "face");
  try {
    return faces.map((face, id) => {
      const kind = cad.surfaceType(face), center = cad.getSurfaceCenterOfMass(face);
      const info: ModifierFace = { id, kind, center, area: cad.getSurfaceArea(face) };
      if (kind === "plane") {
        const uv = cad.uvFromPoint(face, center), normal = cad.surfaceNormal(face, uv.u, uv.v);
        const length = Math.hypot(normal.x, normal.y, normal.z);
        // occt-wasm surfaceNormal already applies the face orientation.
        info.normal = { x: normal.x / length, y: normal.y / length, z: normal.z / length };
      }
      return info;
    });
  } finally { faces.forEach((face) => cad.release(face)); }
}

function faceSignature(cad: OcctKernel, face: ShapeHandle) {
  const center = cad.getSurfaceCenterOfMass(face), box = cad.getBoundingBox(face);
  return { kind: cad.surfaceType(face), area: cad.getSurfaceArea(face), values: [center.x, center.y, center.z, box.xmin, box.ymin, box.zmin, box.xmax, box.ymax, box.zmax] };
}
function sameFace(a: ReturnType<typeof faceSignature>, b: ReturnType<typeof faceSignature>) {
  return a.kind === b.kind && Math.abs(a.area - b.area) <= 1e-6 * Math.max(1, a.area) && a.values.every((value, i) => Math.abs(value - b.values[i]) <= 1e-4);
}
export function deleteFacesSolid(cad: OcctKernel, solid: ShapeHandle, ids: number[]) {
  const faces = cad.getSubShapes(solid, "face");
  const unchanged = "These faces cannot be deleted: the surrounding faces cannot close the gap. Original retained.";
  let result: ShapeHandle | undefined;
  const release: ShapeHandle[] = [...faces];
  try {
    const picked = [...new Set(ids)].map((id) => {
      if (!Number.isInteger(id) || id < 0 || id >= faces.length) throw new Error("The selected CAD faces have changed; restart the tool");
      return faces[id];
    });
    if (!picked.length) throw new Error("Select faces to remove");
    const signatures = picked.map((face) => faceSignature(cad, face));
    result = cad.defeature(solid, picked, 1e-4);
    if (!cad.isSolid(result) || !cad.isValid(result)) throw new Error(unchanged);
    const remaining = cad.getSubShapes(result, "face"); release.push(...remaining);
    const left = remaining.map((face) => faceSignature(cad, face));
    if (signatures.some((signature) => left.some((other) => sameFace(signature, other)))) throw new Error(unchanged);
    return result;
  } catch (error) {
    rethrowCadModifierMemoryFault(error);
    if (result !== undefined) cad.release(result);
    throw new Error(unchanged);
  } finally { new Set(release).forEach((handle) => cad.release(handle)); }
}

export function modifyCadSolid(cad: OcctKernel, solid: ShapeHandle, job: Extract<ModifierJob, { kind: "offset" | "deleteFace" | "face" }>) {
  if (job.kind === "deleteFace") return { shape: deleteFacesSolid(cad, solid, job.options.faceIds), separate: false };
  if (job.kind === "offset") {
    const shape = cad.offset(solid, job.options.amount, 1e-6);
    if (!cad.isSolid(shape) || !cad.isValid(shape) || cad.getVolume(shape) <= 1e-6) throw new Error("Offset collapses or self-intersects the body. Try a smaller distance.");
    return { shape, separate: false };
  }
  const faces = cad.getSubShapes(solid, "face"), list = cadFaceList(cad, solid);
  const id = job.options.faceIds[0], info = list[id], face = faces[id];
  try {
    if (face === undefined || !info?.normal) throw new Error("Choose one planar CAD face for push / pocket");
    const n = info.normal, options = job.options;
    let profile = face;
    if (options.inset > 0) {
      const wires = cad.getSubShapes(face, "wire");
      if (wires.length !== 1) throw new Error("Inset on faces with holes is not supported; use zero inset or a sketch");
      const offset = cad.offsetWire2D(wires[0], -options.inset);
      const candidates = cad.isWire(offset) ? [offset] : cad.getSubShapes(offset, "wire");
      if (candidates.length !== 1) throw new Error("Inset leaves no single closed face; reduce the inset");
      profile = cad.makeFace(candidates[0]);
      if (cad.getSurfaceArea(profile) >= info.area || cad.getSurfaceArea(profile) < 1e-6) throw new Error("Inset does not fit this face");
    }
    const inside = options.direction === "in";
    const base = cad.translate(profile, -n.x * (inside ? options.depth : 0.1), -n.y * (inside ? options.depth : 0.1), -n.z * (inside ? options.depth : 0.1));
    const part = cad.extrude(base, n.x * (options.depth + 0.1), n.y * (options.depth + 0.1), n.z * (options.depth + 0.1));
    const shape = options.separate ? part : inside ? cad.cut(solid, part) : cad.fuse(solid, part);
    if (!cad.isValid(shape) || cad.getVolume(shape) <= 1e-6) throw new Error("Face operation did not produce a valid solid");
    return { shape, separate: options.separate, hole: inside && options.separate };
  } finally { faces.forEach((handle) => cad.release(handle)); }
}
