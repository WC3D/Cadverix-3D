import type { OcctKernel, ShapeHandle } from "occt-wasm";
import type { RimRoundProfile } from "@/lib/cadPlanarRim";
import { isCadModifierWasmMemoryFault, rethrowCadModifierMemoryFault, validateCadModifierShape } from "@/lib/cadModifierRuntime";

type RimCutPlan = {
  loop: { x: number; z: number }[];
  topLoop: { x: number; z: number }[];
  bottom: number;
  height: number;
  top: number;
  fits: boolean;
  profiles?: RimRoundProfile[];
};

/** Build a top-band cutting solid without entering OCCT's edge-fillet builder.
 * Fillet sides are ruled between rational circular profiles; chamfers use a
 * straight loft. Temporary handles never escape the operation. */
export function cutPlanarCadRim(cad: OcctKernel, solid: ShapeHandle, plan: RimCutPlan) {
  if (!plan.fits) throw new Error("The rim treatment is too large for the available material");
  const temporary: ShapeHandle[] = [];
  let result: ShapeHandle | null = null;
  let memoryFault = false;
  const own = (shape: ShapeHandle) => { if (!temporary.includes(shape)) temporary.push(shape); return shape; };
  try {
    const wire = (points: RimCutPlan["loop"], y: number) => own(cad.makeWire(points.map((point, i) => {
      const next = points[(i + 1) % points.length]!;
      return own(cad.makeLineEdge({ x: point.x, y, z: point.z }, { x: next.x, y, z: next.z }));
    })));
    let keep: ShapeHandle;
    if (plan.profiles) {
      const profiles = plan.profiles.map((profile) => own(cad.makeWire([
        own(cad.makeBSplineEdge(profile.poles, profile.weights, profile.knots, profile.multiplicities, 2, false)),
      ])));
      const faces: ShapeHandle[] = [];
      for (let i = 0; i < profiles.length; i++) {
        const side = own(cad.loft([profiles[i]!, profiles[(i + 1) % profiles.length]!], false, true));
        faces.push(...cad.getSubShapes(side, "face").map(own));
      }
      const topFace = own(cad.makeFace(wire(plan.topLoop, plan.height)));
      faces.push(topFace, own(cad.makeFace(wire(plan.loop, plan.bottom))));
      let rounded = own(cad.sewAndSolidify(faces, 1e-5));
      rounded = own(cad.fixShape(rounded));
      rounded = own(cad.fixFaceOrientations(rounded));
      if (!validateCadModifierShape(() => cad.isValid(rounded))) throw new Error("The rounded rim could not be closed into a valid solid");
      const extension = own(cad.extrude(topFace, 0, plan.top - plan.height, 0));
      keep = own(cad.fuse(rounded, extension));
    } else {
      keep = own(cad.loft([wire(plan.loop, plan.bottom), wire(plan.topLoop, plan.top)], true, true));
    }
    const bounds = cad.getBoundingBox(solid, false);
    const slab = own(cad.makeBoxFromCorners(
      { x: bounds.xmin - 1, y: plan.bottom, z: bounds.zmin - 1 },
      { x: bounds.xmax + 1, y: plan.top, z: bounds.zmax + 1 },
    ));
    result = cad.cut(solid, own(cad.cut(slab, keep)));
    if (!validateCadModifierShape(() => cad.isValid(result!))) throw new Error("The rim treatment could not produce a valid solid");
    if (cad.getBoundingBox(result, false).ymax < plan.height - 0.0001) throw new Error("The rim treatment removes the entire top face; use a smaller size");
    return result;
  } catch (error) {
    memoryFault = isCadModifierWasmMemoryFault(error instanceof Error ? error.message : String(error), error instanceof Error ? error.name : "");
    if (!memoryFault && result !== null) cad.release(result);
    throw error;
  } finally {
    if (!memoryFault) {
      for (const handle of temporary.reverse()) {
        try { cad.release(handle); } catch (error) { rethrowCadModifierMemoryFault(error); }
      }
    }
  }
}
