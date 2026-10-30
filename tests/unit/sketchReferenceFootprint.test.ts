import { beforeAll, describe, expect, it } from "vitest";
import manifoldModule, { type ManifoldToplevel } from "manifold-3d";
import { BoxGeometry, BufferGeometry, CylinderGeometry, Float32BufferAttribute, SphereGeometry, TorusGeometry } from "three";
import { importedMeshFootprint } from "@/components/SketchWorkspace";
import type { WorkplaneShape } from "@/types/sketchforge";

let runtime: ManifoldToplevel;
beforeAll(async () => { runtime = await manifoldModule(); runtime.setup(); });

function meshShape(geometry: BufferGeometry, width: number, height: number, depth = width): WorkplaneShape {
  const positions = Array.from((geometry.index ? geometry.toNonIndexed() : geometry).getAttribute("position").array);
  return {
    id: "reference", name: "Reference", kind: "mesh", color: "#ff0000", x: 0, z: 0,
    size: Math.max(width, depth), width, depth, height, rotation: 0,
    importedMesh: { positions, baseWidth: width, baseDepth: depth, baseHeight: height, triangleCount: positions.length / 9 },
  };
}

function rings(path: string) {
  return path.split("M ").slice(1).map((ring) => {
    const coordinates = [...ring.matchAll(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)].map((match) => Number(match[0]));
    return Array.from({ length: coordinates.length / 2 }, (_, index) => [coordinates[index * 2], coordinates[index * 2 + 1]]);
  });
}

function area(ring: number[][]) {
  return ring.reduce((sum, [x, z], index) => {
    const next = ring[(index + 1) % ring.length];
    return sum + x * next[1] - z * next[0];
  }, 0) / 2;
}

describe("sketch mesh references", () => {
  it("unions nearly coincident surfaces from different tessellations without losing the outline", () => {
    const first = new BoxGeometry(10, 4, 10, 3, 1, 7).toNonIndexed();
    const second = new BoxGeometry(10, 4, 10, 7, 1, 3).translate(1e-8, 8, -1e-8).toNonIndexed();
    const geometry = new BufferGeometry().setAttribute("position", new Float32BufferAttribute([
      ...first.getAttribute("position").array, ...second.getAttribute("position").array,
    ], 3));
    const footprint = importedMeshFootprint(meshShape(geometry, 10, 12, 10), runtime)!;
    const contours = rings(footprint.outlineD!);
    expect(contours).toHaveLength(1);
    expect(Math.abs(area(contours[0]))).toBeCloseTo(100, 4);
    expect(footprint.fillD).toBe(footprint.outlineD);
  });

  it("unions overlapping projected surfaces without drawing hidden internal edges", () => {
    const front = new BoxGeometry(10, 4, 10).translate(-3, 0, 0).toNonIndexed();
    const back = new BoxGeometry(10, 4, 10).translate(3, 8, 0).toNonIndexed();
    const geometry = new BufferGeometry().setAttribute("position", new Float32BufferAttribute([
      ...front.getAttribute("position").array, ...back.getAttribute("position").array,
    ], 3));
    const footprint = importedMeshFootprint(meshShape(geometry, 16, 12, 10), runtime)!;
    const contours = rings(footprint.outlineD!);
    expect(contours).toHaveLength(1);
    expect(contours[0]).toHaveLength(4);
    expect(Math.abs(area(contours[0]))).toBeCloseTo(160, 6);
    expect(footprint.fillD).toBe(footprint.outlineD);
  });

  it("shows the complete side of a cylinder instead of a jagged strip", () => {
    const geometry = new CylinderGeometry(10, 10, 40, 32).rotateX(Math.PI / 2);
    const footprint = importedMeshFootprint(meshShape(geometry, 20, 20, 40), runtime);
    const coordinates = [...footprint!.outlineD!.matchAll(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)].map((match) => Number(match[0]));
    const xs = coordinates.filter((_, index) => index % 2 === 0);
    const zs = coordinates.filter((_, index) => index % 2 === 1);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(20, 1);
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(40, 1);
  });

  it("projects a curved body instead of selecting only triangles near its lowest point", () => {
    const footprint = importedMeshFootprint(meshShape(new SphereGeometry(10, 32, 24), 20, 20), runtime);
    const coordinates = [...footprint!.outlineD!.matchAll(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)].map((match) => Number(match[0]));
    const xs = coordinates.filter((_, index) => index % 2 === 0);
    const zs = coordinates.filter((_, index) => index % 2 === 1);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(20, 1);
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(20, 1);
  });

  it("keeps the silhouette of a dense imported mesh small and filled", () => {
    const footprint = importedMeshFootprint(meshShape(new SphereGeometry(10, 256, 256), 20, 20), runtime)!;
    const contours = rings(footprint.outlineD!);
    expect(contours).toHaveLength(1);
    expect(contours[0].length).toBeLessThanOrEqual(260);
    expect(footprint.fillD).toBe(footprint.outlineD);
    expect(Math.abs(area(contours[0]))).toBeCloseTo(Math.PI * 100, 0);
  }, 10000);

  it("preserves separate components instead of bridging the empty space between them", () => {
    const left = new BoxGeometry(10, 4, 10).translate(-15, 0, 0).toNonIndexed();
    const right = new BoxGeometry(10, 4, 10).translate(15, 0, 0).toNonIndexed();
    const geometry = new BufferGeometry().setAttribute("position", new Float32BufferAttribute([
      ...left.getAttribute("position").array, ...right.getAttribute("position").array,
    ], 3));
    const contours = rings(importedMeshFootprint(meshShape(geometry, 40, 4, 10), runtime)!.outlineD!);
    expect(contours).toHaveLength(2);
    expect(contours.reduce((sum, contour) => sum + Math.abs(area(contour)), 0)).toBeCloseTo(200, 6);
  });

  it("does not return invalid SVG coordinates for non-finite mesh data", () => {
    const shape = meshShape(new BoxGeometry(10, 10, 10), 10, 10);
    shape.importedMesh!.positions[0] = NaN;
    expect(importedMeshFootprint(shape, runtime)).toBeNull();
  });

  it("does not fill a through-hole with a convex-hull approximation", () => {
    const geometry = new TorusGeometry(10, 3, 12, 32).rotateX(Math.PI / 2);
    const footprint = importedMeshFootprint(meshShape(geometry, 26, 6), runtime);
    expect(footprint?.fillD).toBeTruthy();
    const contours = rings(footprint!.fillD!);
    expect(contours).toHaveLength(2);
    expect(area(contours[0]) * area(contours[1])).toBeLessThan(0);
    expect(footprint!.fillD).toBe(footprint!.outlineD);
  });
});
