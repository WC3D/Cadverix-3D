import * as THREE from "three";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { roundSideCount } from "@/lib/roundSideCount";

export const DEFAULT_SLOT_WIDTH = 40;
export const DEFAULT_SLOT_DEPTH = 20;
export const DEFAULT_SLOT_HEIGHT = 20;

export type SlotGeometryOptions = {
  width: number;
  depth: number;
  height: number;
  sides?: number;
};

type Point2D = { x: number; y: number };

export function buildSlotContourPoints(width: number, depth: number, sides?: number): Point2D[] {
  const safeW = Math.max(0.01, width);
  const safeD = Math.max(0.01, depth);
  const minDim = Math.min(safeW, safeD);
  const effectiveSides = roundSideCount(sides, minDim, minDim);
  const arcSteps = Math.max(4, Math.round(effectiveSides / 2));
  const pts: Point2D[] = [];

  if (safeW >= safeD) {
    const R = safeD / 2;
    const hx = (safeW - safeD) / 2;
    if (hx > 1e-4) {
      pts.push({ x: -hx, y: -R });
      pts.push({ x: hx, y: -R });
    } else {
      pts.push({ x: 0, y: -R });
    }
    for (let i = 1; i <= arcSteps; i += 1) {
      const phi = -Math.PI / 2 + (i / arcSteps) * Math.PI;
      pts.push({ x: hx + R * Math.cos(phi), y: R * Math.sin(phi) });
    }
    if (hx > 1e-4) pts.push({ x: -hx, y: R });
    for (let i = 1; i < arcSteps; i += 1) {
      const phi = Math.PI / 2 + (i / arcSteps) * Math.PI;
      pts.push({ x: -hx + R * Math.cos(phi), y: R * Math.sin(phi) });
    }
  } else {
    const R = safeW / 2;
    const hz = (safeD - safeW) / 2;
    if (hz > 1e-4) {
      pts.push({ x: R, y: -hz });
      pts.push({ x: R, y: hz });
    } else {
      pts.push({ x: R, y: 0 });
    }
    for (let i = 1; i <= arcSteps; i += 1) {
      const phi = (i / arcSteps) * Math.PI;
      pts.push({ x: R * Math.cos(phi), y: hz + R * Math.sin(phi) });
    }
    if (hz > 1e-4) pts.push({ x: -R, y: -hz });
    for (let i = 1; i < arcSteps; i += 1) {
      const phi = Math.PI + (i / arcSteps) * Math.PI;
      pts.push({ x: R * Math.cos(phi), y: -hz + R * Math.sin(phi) });
    }
  }
  return pts;
}

export function createSlotGeometry({ width, depth, height, sides }: SlotGeometryOptions): THREE.BufferGeometry {
  const safeWidth = Math.max(0.01, width);
  const safeDepth = Math.max(0.01, depth);
  const safeHeight = Math.max(0.01, height);
  const minDim = Math.min(safeWidth, safeDepth);
  const contour2D = buildSlotContourPoints(safeWidth, safeDepth, roundSideCount(sides, minDim, minDim));
  const M = contour2D.length;
  const positions: number[] = [];
  const indices: number[] = [];

  contour2D.forEach((p) => positions.push(p.x, 0, p.y));
  contour2D.forEach((p) => positions.push(p.x, safeHeight, p.y));

  const triPoints = contour2D.map((p) => new THREE.Vector2(p.x, p.y));
  const isClockwise = THREE.ShapeUtils.isClockWise(triPoints);
  THREE.ShapeUtils.triangulateShape(triPoints, []).forEach(([a, b, c]) => {
    if (isClockwise) {
      indices.push(M + a, M + b, M + c, a, c, b);
    } else {
      indices.push(M + a, M + c, M + b, a, b, c);
    }
  });
  for (let i = 0; i < M; i += 1) {
    const next = (i + 1) % M;
    if (isClockwise) {
      indices.push(i, next, M + next, i, M + next, M + i);
    } else {
      indices.push(i, M + next, next, i, M + i, M + next);
    }
  }

  const indexed = new THREE.BufferGeometry();
  indexed.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  indexed.setIndex(indices);
  const geometry = toCreasedNormals(indexed, THREE.MathUtils.degToRad(30));
  indexed.dispose();
  geometry.computeBoundingBox();
  return geometry;
}
