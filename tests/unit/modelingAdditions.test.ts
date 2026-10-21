import { expect, it, vi } from "vitest";
import * as THREE from "three";
import { horizontalPlacementWorkplane, placementWorkplaneFromSurface } from "@/lib/placementWorkplane";
import { DEFAULT_HOLE_PATTERN, faceHolePattern, type PatternMesh } from "@/lib/holePattern";
import { DEFAULT_SECTION, overhangPositions, sectionPlane } from "@/lib/viewportInspection";
import { carryShapePivot, shapePivotFromWorld, shapePivotWorld } from "@/lib/shapePivot";
import { overlayMaterial } from "@/lib/overlayMaterials";
import { independentLibraryShape } from "@/lib/customShapeCopies";
import { workplaneShapesEqual } from "@/lib/workplaneShapes";
import { separablePartCount } from "@/components/CadverixEditor";
import type { WorkplaneShape } from "@/types/sketchforge";

const box: WorkplaneShape = { id: "box", name: "Box", kind: "box", color: "#ff0000", x: 0, z: 0, elevation: 0, width: 40, depth: 30, height: 10, size: 40, rotation: 0 };
function boxMesh(): PatternMesh {
  const geometry = new THREE.BoxGeometry(40, 10, 30).translate(0, 5, 0), positions = geometry.getAttribute("position"), indices = geometry.index!;
  const vertices = Array.from({ length: positions.count }, (_, index) => [positions.getX(index), positions.getY(index), positions.getZ(index)] as [number, number, number]);
  const faces = Array.from({ length: indices.count / 3 }, (_, index) => [indices.getX(index * 3), indices.getX(index * 3 + 1), indices.getX(index * 3 + 2)] as [number, number, number]);
  geometry.dispose(); return { vertices, faces };
}

it.each(["round", "square", "rectangle", "hexagon", "slot"] as const)("makes bounded, outward-wound %s cutters on a flat face", (form) => {
  const result = faceHolePattern(boxMesh(), horizontalPlacementWorkplane(10), { ...DEFAULT_HOLE_PATTERN, form });
  expect(result.centers.length).toBeGreaterThan(0);
  for (const cutter of result.cutters) {
    let volume = 0;
    for (const [a, b, c] of cutter.faces) volume += new THREE.Vector3(...cutter.vertices[a]).dot(new THREE.Vector3(...cutter.vertices[b]).cross(new THREE.Vector3(...cutter.vertices[c]))) / 6;
    expect(volume).toBeGreaterThan(0);
    for (const [x, y, z] of cutter.vertices) { expect(Math.abs(x)).toBeLessThan(18.001); expect(Math.abs(z)).toBeLessThan(13.001); expect(y).toBeGreaterThanOrEqual(-.201); expect(y).toBeLessThanOrEqual(10.101); }
  }
});
it("perforates vertical faces as well as the top", () => {
  const plane = placementWorkplaneFromSurface({ x: 20, y: 5, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
  const result = faceHolePattern(boxMesh(), plane, { ...DEFAULT_HOLE_PATTERN, margin: .5 });
  expect(result.cutters.length).toBeGreaterThan(0);
});
it("cuts inward even if the picked workplane normal was reversed", () => {
  const plane = horizontalPlacementWorkplane(10); plane.normal.y = -1;
  const { cutters } = faceHolePattern(boxMesh(), plane, DEFAULT_HOLE_PATTERN);
  expect(Math.min(...cutters[0].vertices.map((vertex) => vertex[1]))).toBeCloseTo(-.2);
});
it("rejects unsafe spacing, curved/off-face picks, excessive patterns and empty fits", () => {
  expect(() => faceHolePattern(boxMesh(), horizontalPlacementWorkplane(10), { ...DEFAULT_HOLE_PATTERN, spacing: 1 })).toThrow("Spacing");
  expect(() => faceHolePattern(boxMesh(), horizontalPlacementWorkplane(5), DEFAULT_HOLE_PATTERN)).toThrow("flat face");
  expect(() => faceHolePattern(boxMesh(), horizontalPlacementWorkplane(10), { ...DEFAULT_HOLE_PATTERN, size: .5, height: .5, spacing: .9, margin: 0 })).toThrow("256");
  expect(() => faceHolePattern(boxMesh(), horizontalPlacementWorkplane(10), { ...DEFAULT_HOLE_PATTERN, size: 100, spacing: 101 })).toThrow("No holes fit");
});
it("keeps cutters out of existing openings", () => {
  const mesh = boxMesh();
  // Four strips surrounding a 10 × 10 opening, using duplicate vertices like an STL.
  const vertices: PatternMesh["vertices"] = [], faces: PatternMesh["faces"] = [];
  for (const [x0, z0, x1, z1] of [[-20, -15, -5, 15], [5, -15, 20, 15], [-5, -15, 5, -5], [-5, 5, 5, 15]]) {
    const i = vertices.length; vertices.push([x0, 10, z0], [x1, 10, z0], [x1, 10, z1], [x0, 10, z1]); faces.push([i, i + 2, i + 1], [i, i + 3, i + 2]);
  }
  const plane = horizontalPlacementWorkplane(10); plane.origin.x = -10;
  const result = faceHolePattern({ ...mesh, vertices, faces }, plane, DEFAULT_HOLE_PATTERN);
  for (const cutter of result.cutters) for (const [x, , z] of cutter.vertices) expect(Math.abs(x) >= 5 || Math.abs(z) >= 5).toBe(true);
});
it("maps section axes to Z-up and flips the retained half", () => {
  expect(sectionPlane(DEFAULT_SECTION)).toBeNull();
  expect(sectionPlane({ ...DEFAULT_SECTION, enabled: true })!.distanceToPoint(new THREE.Vector3(0, 15, 0))).toBe(5);
  expect(sectionPlane({ ...DEFAULT_SECTION, enabled: true, flipped: true })!.distanceToPoint(new THREE.Vector3(0, 15, 0))).toBe(-5);
});
it("highlights a floating body's underside, not its top or the plate-contact face", () => {
  const geometry = new THREE.BoxGeometry(10, 10, 10);
  expect(overhangPositions(geometry, new THREE.Matrix4().makeTranslation(0, 5, 0), 45)).toHaveLength(0);
  const floating = overhangPositions(geometry, new THREE.Matrix4().makeTranslation(0, 15, 0), 45);
  expect(floating).toHaveLength(18);
  expect(floating.filter((_, index) => index % 3 === 1).every((y) => y === 10)).toBe(true);
  geometry.dispose();
});
it("stores pivots in body space and preserves their world position when rebasing", () => {
  const source = { ...box, mirrorX: true, rotation: 35, rotationX: 20 };
  const point = new THREE.Vector3(4, 2, 8);
  const pivoted = { ...source, rotationPivot: shapePivotFromWorld(source, point) };
  expect(shapePivotWorld(pivoted)!.distanceTo(point)).toBeLessThan(1e-9);
  const target = carryShapePivot(pivoted, { ...box, x: 30, width: 100 });
  expect(shapePivotWorld(target)!.distanceTo(point)).toBeLessThan(1e-9);
  expect(workplaneShapesEqual(box, pivoted)).toBe(false);
  const moved = { ...pivoted, x: source.x + 10 };
  expect(shapePivotWorld(moved)!.x).toBeCloseTo(point.x + 10);
});
it("shares overlay materials within a viewport without mixing caches", () => {
  const create = vi.fn(() => new THREE.LineBasicMaterial()), cache = new Map<string, THREE.Material>();
  const first = overlayMaterial(cache, "edge", create);
  expect(overlayMaterial(cache, "edge", create)).toBe(first);
  expect(create).toHaveBeenCalledOnce();
  expect(first.userData.cached).toBe(true);
  const other = overlayMaterial(new Map(), "edge", create); expect(other).not.toBe(first);
  first.dispose(); other.dispose();
});
it("does not recount imported components when only the transform changes", () => {
  let reads = 0;
  const positions = new Proxy([0, 0, 0, 1, 0, 0, 0, 1, 0, 10, 0, 0, 11, 0, 0, 10, 1, 0], { get(target, key, receiver) { if (typeof key === "string" && /^\d+$/.test(key)) reads++; return Reflect.get(target, key, receiver); } });
  const shape: WorkplaneShape = { ...box, kind: "mesh", importedMesh: { positions, baseWidth: 40, baseHeight: 10, baseDepth: 30, triangleCount: 2, sourceFormat: "json" } };
  expect(separablePartCount(shape)).toBe(2); expect(reads).toBeGreaterThan(0); reads = 0;
  expect(separablePartCount({ ...shape, x: 90, width: 80, rotation: 40 })).toBe(2); expect(reads).toBe(0);
});

it("library copies detach live projections without changing their coordinates", () => {
  const original: WorkplaneShape = { ...box, locked: true, sketchProfile: { points: [{ id: "p", x: 4, z: 5, projectionId: "link" }], segments: [], projections: [{ id: "link", sourceShapeId: "other-body", sourceName: "Other", sourceKind: "sketch" }] } };
  const copy = independentLibraryShape(original);
  expect(copy.id).not.toBe(original.id); expect(copy.locked).toBe(false);
  expect(copy.sketchProfile!.projections).toEqual([]);
  expect(copy.sketchProfile!.points[0]).toEqual({ id: "p", x: 4, z: 5, projectionId: undefined });
  expect(original.sketchProfile!.projections).toHaveLength(1);
});
