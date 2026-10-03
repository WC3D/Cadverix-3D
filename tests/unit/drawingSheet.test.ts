import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createDrawingSheet, drawingPaper, drawingMeasurement, drawingValue, drawingEntityPoints, parseDrawingSheet, reconfigureDrawingSheet, DRAWING_VIEWS, type DrawingDimension, type DrawingPoint3 } from "@/lib/drawingSheet";
import { projectDrawingMeshes, type DrawingMesh } from "@/lib/drawingProjection";
import { drawingDimensionGeometry } from "@/lib/drawingDimensions";

function mesh(geometry: THREE.BufferGeometry): DrawingMesh {
  const position = geometry.getAttribute("position");
  const vertices = Array.from({ length: position.count }, (_, i) => [position.getX(i), position.getY(i), position.getZ(i)] as DrawingPoint3);
  const indices = geometry.index ? Array.from(geometry.index.array) : vertices.map((_, i) => i);
  const faces = Array.from({ length: indices.length / 3 }, (_, i) => indices.slice(i * 3, i * 3 + 3) as [number, number, number]);
  geometry.dispose(); return { vertices, faces };
}

describe("CAD drawing sheets", () => {
  it("uses physical ISO/ANSI paper sizes and portrait orientation", () => {
    const sheet = createDrawingSheet();
    expect(drawingPaper(sheet)).toMatchObject({ width: 297, height: 210, left: 20, standard: "ISO" });
    expect(drawingPaper({ ...sheet, orientation: "portrait" })).toMatchObject({ width: 210, height: 297 });
    expect(drawingPaper({ ...sheet, template: "ANSI B" })).toMatchObject({ width: 431.8, height: 279.4, standard: "ANSI" });
    expect(drawingPaper({ ...sheet, template: "ANSI E" })).toMatchObject({ width: 1117.6, height: 863.6 });
  });

  it("projects front, top and right views with correct dimensions", () => {
    const box = mesh(new THREE.BoxGeometry(20, 10, 30));
    expect(projectDrawingMeshes([box], DRAWING_VIEWS.Front)).toMatchObject({ width: 20, height: 10 });
    expect(projectDrawingMeshes([box], DRAWING_VIEWS.Top).height).toBeCloseTo(30);
    expect(projectDrawingMeshes([box], DRAWING_VIEWS.Right).width).toBeCloseTo(30);
    expect(projectDrawingMeshes([box], DRAWING_VIEWS.Front).lines.filter((line) => !line.hidden)).toHaveLength(4);
  });

  it("repositions a canonical three-view set when switching projection convention", () => {
    const sheet = createDrawingSheet();
    sheet.views = ["Front", "Top", "Right"].map((name, i) => ({ id: name, name, shapeIds: ["box"], rotation: [...DRAWING_VIEWS[name as keyof typeof DRAWING_VIEWS]], x: i === 2 ? 80 : 150, y: i === 1 ? 110 : 50, scale: 1, showHidden: true }));
    const next = reconfigureDrawingSheet(sheet, { projection: "third" });
    expect(next.views[1]!.y).toBeLessThan(next.views[0]!.y);
    expect(next.views[2]!.x).toBeGreaterThan(next.views[0]!.x);
    expect(sheet.views[0]!.x).toBe(150);
  });

  it("includes smooth-surface silhouettes and separates occluded lines", () => {
    const cylinder = projectDrawingMeshes([mesh(new THREE.CylinderGeometry(10, 10, 20, 32))], DRAWING_VIEWS.Front);
    expect(cylinder.lines.filter((line) => !line.hidden && Math.abs(line.a[0] - line.b[0]) < 1e-5 && Math.abs(line.a[1] - line.b[1]) > 19)).toHaveLength(2);
    const front = mesh(new THREE.BoxGeometry(20, 20, 10));
    const back = mesh(new THREE.BoxGeometry(10, 10, 10).translate(0, 0, -20));
    const assembly = projectDrawingMeshes([front, back], DRAWING_VIEWS.Front);
    expect(assembly.lines.filter((line) => line.hidden)).toHaveLength(4);
    expect(assembly.lines.filter((line) => !line.hidden)).toHaveLength(4);
  });

  it("keeps model dimensions independent of sheet placement and view scale", () => {
    const projection = projectDrawingMeshes([mesh(new THREE.BoxGeometry(20, 10, 30))], DRAWING_VIEWS.Front);
    const sheet = createDrawingSheet();
    sheet.views = [{ id: "view", name: "Front", shapeIds: ["box"], rotation: [0, 0, 0], x: 100, y: 80, scale: 0.5, showHidden: true }];
    const dimension: DrawingDimension = { id: "dim", kind: "horizontal", anchors: [{ type: "view", viewId: "view", point: [-10, 5, 15] }, { type: "view", viewId: "view", point: [10, 5, 15] }], offset: -8, sourceFingerprint: "geometry" };
    const results = new Map([["view", { projection, fingerprint: "geometry" }]]);
    const first = drawingDimensionGeometry(sheet, dimension, results)!;
    expect(first.value).toBe(20);
    expect(first.line![1][0] - first.line![0][0]).toBe(10);
    sheet.views[0]!.scale = 2;
    expect(drawingDimensionGeometry(sheet, dimension, results)!.value).toBe(20);
    expect(drawingDimensionGeometry(sheet, dimension, results)!.line![1][0] - drawingDimensionGeometry(sheet, dimension, results)!.line![0][0]).toBe(40);
    expect(drawingDimensionGeometry(sheet, dimension, new Map([["view", { projection, fingerprint: "changed" }]]))).toBeNull();
  });

  it("measures aligned lengths, angles and three-point circles in model space", () => {
    expect(drawingMeasurement("aligned", [[0, 0, 0], [3, 4, 12]])).toBe(13);
    expect(drawingMeasurement("angle", [[1, 0, 0], [0, 0, 0], [0, 1, 0]])).toBe(90);
    expect(drawingMeasurement("radius", [[-1, 0, 0], [0, 1, 0], [1, 0, 0]])).toBeCloseTo(1);
    expect(drawingMeasurement("diameter", [[-1, 0, 0], [0, 1, 0], [1, 0, 0]])).toBeCloseTo(2);
    expect(drawingMeasurement("radius", [[0, 0, 0], [1, 0, 0], [2, 0, 0]])).toBeNull();
    expect(drawingValue(25.4, "aligned", "in")).toBe("1.000");
  });

  it("rotates editable paper shapes and rejects malformed persisted sheets", () => {
    const sheet = createDrawingSheet();
    sheet.entities = [{ id: "r", kind: "rectangle", a: [0, 0], b: [20, 10], angle: 90, text: "" }];
    const points = drawingEntityPoints(sheet.entities[0]!);
    expect(points[0]![0]).toBeCloseTo(15);
    expect(points[0]![1]).toBeCloseTo(-5);
    expect(parseDrawingSheet(sheet)).toEqual(sheet);
    expect(() => parseDrawingSheet({ ...sheet, template: "unknown" })).toThrow();
    expect(() => parseDrawingSheet({ ...sheet, entities: [...sheet.entities, ...sheet.entities] })).toThrow("Duplicate");
    expect(() => parseDrawingSheet({ ...sheet, views: [{ id: "v", name: "", shapeIds: ["box"], rotation: [0, 0, 0], x: NaN, y: 0, scale: 1, showHidden: true }] })).toThrow("number");
    expect(() => parseDrawingSheet({ ...sheet, title: "Bad\u0000title" })).toThrow("text");
  });
});
