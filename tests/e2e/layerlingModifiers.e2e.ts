import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Module, { type ManifoldToplevel } from "manifold-3d";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { OcctKernel } from "occt-wasm";
import { MODIFIER_DEFAULTS } from "@/lib/layerlingModifierTypes";
import { articulateSolid } from "@/lib/flexiJoints";
import { cookieCutterForSolid, lidForSolid, textureSolid } from "@/lib/layerlingSolidTools";
import { cadFaceList, deleteFacesSolid, modifyCadSolid } from "@/lib/cadSolidTools";

describe("new modifiers against real geometry kernels", () => {
  let runtime: ManifoldToplevel;
  let cad: OcctKernel;
  const made: { delete(): void }[] = [];
  const keep = <T extends { delete(): void }>(value: T): T => { made.push(value); return value; };
  beforeAll(async () => {
    runtime = await Module(); runtime.setup();
    cad = await OcctKernel.init({ wasm: join(dirname(fileURLToPath(import.meta.resolve("occt-wasm"))), "occt-wasm.wasm") });
  });
  afterAll(() => { new Set(made).forEach((value) => value.delete()); cad?.releaseAll(); });

  it("makes three separate retained flexi links without overlapping material", () => {
    const source = keep(runtime.Manifold.cube([90, 8, 24]));
    const result = articulateSolid(runtime, source, { ...MODIFIER_DEFAULTS.flexi, joints: 2 }); made.push(...result.links);
    expect(result.links).toHaveLength(3);
    for (const link of result.links) { expect(link.status()).toBe("NoError"); expect(link.volume()).toBeGreaterThan(0); }
    expect(keep(result.links[0].intersect(result.links[1])).volume()).toBeLessThan(1e-5);
    expect(result.swing).toBeGreaterThanOrEqual(5);
    expect(source.volume()).toBeCloseTo(90 * 8 * 24);
  });
  it("refuses joints in an undersized body", () => {
    const source = keep(runtime.Manifold.cube([20, 0.5, 3]));
    expect(() => articulateSolid(runtime, source, MODIFIER_DEFAULTS.flexi)).toThrow();
  });
  it.each(["plug", "cap", "both", "flat"] as const)("makes a closed %s lid beside an open body", (type) => {
    const outer = keep(runtime.Manifold.cube([30, 20, 30]));
    const inside = keep(keep(runtime.Manifold.cube([26, 20, 26])).translate([2, 2, 2]));
    const body = keep(outer.subtract(inside));
    const lid = keep(lidForSolid(runtime, body, { ...MODIFIER_DEFAULTS.lid, type }));
    expect(lid.status()).toBe("NoError"); expect(lid.volume()).toBeGreaterThan(0);
    expect(lid.boundingBox().min[0]).toBeGreaterThan(body.boundingBox().max[0]);
    expect(lid.boundingBox().min[1]).toBeCloseTo(0, 5);
  });
  it("rejects a plug lid for a closed body without changing it", () => {
    const body = keep(runtime.Manifold.cube([20, 20, 20]));
    expect(() => lidForSolid(runtime, body, MODIFIER_DEFAULTS.lid)).toThrow(/closed/);
    expect(body.volume()).toBeCloseTo(8000);
  });
  it("makes a connected cutter with inner walls and a backing plate", () => {
    const outer = keep(runtime.Manifold.cube([30, 4, 30]));
    const hole = keep(keep(runtime.Manifold.cube([10, 8, 10])).translate([10, -2, 10]));
    const body = keep(outer.subtract(hole));
    const cutter = keep(cookieCutterForSolid(runtime, body, { ...MODIFIER_DEFAULTS.cookie, plate: 1 }));
    expect(cutter.status()).toBe("NoError"); expect(cutter.volume()).toBeGreaterThan(0);
    const parts = cutter.decompose(); made.push(...parts); expect(parts).toHaveLength(1);
    expect(cutter.boundingBox().max[1] - cutter.boundingBox().min[1]).toBeCloseTo(15, 2);
  });
  it("makes the default cookie cutter without a backing plate", () => {
    const body = keep(runtime.Manifold.cube([20, 20, 20]));
    const cutter = keep(cookieCutterForSolid(runtime, body, MODIFIER_DEFAULTS.cookie));
    expect(cutter.status()).toBe("NoError"); expect(cutter.volume()).toBeGreaterThan(0);
  });
  it("simplifies a sphere and builds closed relief geometry", () => {
    const sphere = keep(runtime.Manifold.sphere(10, 48));
    const simplified = keep(sphere.simplify(0.2));
    expect(simplified.numTri()).toBeLessThan(sphere.numTri());
    const texture = keep(textureSolid(runtime, sphere, { ...MODIFIER_DEFAULTS.texture, top: true, bottom: true }));
    expect(texture.status()).toBe("NoError"); expect(texture.numTri()).toBeGreaterThan(sphere.numTri());
    expect(texture.volume()).toBeLessThan(sphere.volume());
  });
  it("grows and shrinks a CAD body with exact offsets", () => {
    const box = cad.makeBox(20, 20, 20);
    const grown = modifyCadSolid(cad, box, { kind: "offset", options: { amount: 1 } });
    const shrunk = modifyCadSolid(cad, box, { kind: "offset", options: { amount: -1 } });
    expect(cad.isValid(grown.shape)).toBe(true); expect(cad.getVolume(grown.shape)).toBeGreaterThan(8000);
    expect(cad.isValid(shrunk.shape)).toBe(true); expect(cad.getVolume(shrunk.shape)).toBeLessThan(8000);
  });
  it("pushes and pockets a planar face and rejects impossible face deletion", () => {
    const box = cad.makeBox(20, 20, 20), faces = cadFaceList(cad, box);
    const top = faces.find((face) => face.normal?.y === 1)!;
    expect(top).toBeDefined();
    expect(top.center.y).toBeCloseTo(20);
    expect(faces.find((face) => face.normal?.y === -1)?.center.y).toBeCloseTo(0);
    const pushed = modifyCadSolid(cad, box, { kind: "face", options: { ...MODIFIER_DEFAULTS.face, faceIds: [top.id] } });
    const pocket = modifyCadSolid(cad, box, { kind: "face", options: { ...MODIFIER_DEFAULTS.face, direction: "in", inset: 2, faceIds: [top.id] } });
    expect(cad.getVolume(pushed.shape)).toBeCloseTo(8800, 3); expect(cad.getVolume(pocket.shape)).toBeCloseTo(7488, 3);
    expect(() => deleteFacesSolid(cad, box, [top.id])).toThrow(/cannot be deleted/);
    expect(cad.getVolume(box)).toBeCloseTo(8000);
  });
  it("heals a complete cylindrical hole rather than leaving an open mesh", () => {
    const box = cad.makeBox(20, 20, 20), drill = cad.translate(cad.makeCylinder(3, 30), 10, 10, -5);
    const cut = cad.cut(box, drill), solids = cad.getSubShapes(cut, "solid"), body = solids[0];
    const face = cadFaceList(cad, body).find((face) => face.kind === "cylinder")!;
    const healed = deleteFacesSolid(cad, body, [face.id]);
    expect(cad.isValid(healed)).toBe(true); expect(cad.getVolume(healed)).toBeCloseTo(8000, 3);
  });
});
