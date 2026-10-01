import * as THREE from "three";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { WorkplaneShape } from "@/types/sketchforge";

export const DEFAULT_DOVETAIL_WIDTH = 30;
export const DEFAULT_DOVETAIL_DEPTH = 20;
export const DEFAULT_DOVETAIL_HEIGHT = 10;
export const DEFAULT_DOVETAIL_NECK_RATIO = 0.5;
export const DEFAULT_DOVETAIL_CLEARANCE = 0.2;
export const MAX_DOVETAIL_CLEARANCE = 2;
const MIN_DOVETAIL_NECK = 0.1;

type Point2D = { x: number; y: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeDovetailNeckWidth(value: number | undefined, width: number) {
  const safeWidth = Math.max(0.01, width);
  const requested = Number.isFinite(value) ? (value as number) : safeWidth * DEFAULT_DOVETAIL_NECK_RATIO;
  return clamp(requested, Math.min(MIN_DOVETAIL_NECK, safeWidth * 0.5), safeWidth * 0.95);
}

export function normalizeDovetailClearance(value?: number) {
  return clamp(Number.isFinite(value) ? (value as number) : DEFAULT_DOVETAIL_CLEARANCE, 0, MAX_DOVETAIL_CLEARANCE);
}

export function dovetailFlankAngle(width: number, depth: number, neckWidth: number) {
  return THREE.MathUtils.radToDeg(Math.atan2((width - neckWidth) / 2, Math.max(0.01, depth)));
}

export function dovetailContourPoints(width: number, depth: number, neckWidth: number, clearance = 0): Point2D[] {
  const safeWidth = Math.max(0.01, width);
  const safeDepth = Math.max(0.01, depth);
  const neck = normalizeDovetailNeckWidth(neckWidth, safeWidth);
  const halfDepth = safeDepth / 2;
  const c = Math.max(0, clearance);
  const run = (safeWidth - neck) / 2;
  const secant = Math.hypot(run, safeDepth) / safeDepth;
  const tangent = run / safeDepth;
  const endBack = -halfDepth - c;
  const endFront = halfDepth + c;
  const halfWidthAt = (y: number) => neck / 2 + c * secant + tangent * (y + halfDepth);
  return [
    { x: -halfWidthAt(endBack), y: endBack },
    { x: halfWidthAt(endBack), y: endBack },
    { x: halfWidthAt(endFront), y: endFront },
    { x: -halfWidthAt(endFront), y: endFront },
  ];
}

export type DovetailGeometryOptions = {
  width: number;
  depth: number;
  height: number;
  dovetailNeckWidth?: number;
  dovetailClearance?: number;
  hole?: boolean;
};

export function dovetailOutlineForShape(shape: Pick<WorkplaneShape, "width" | "depth" | "hole" | "dovetailNeckWidth" | "dovetailClearance">) {
  const depth = shape.depth ?? shape.width;
  return dovetailContourPoints(
    shape.width,
    depth,
    normalizeDovetailNeckWidth(shape.dovetailNeckWidth, shape.width),
    shape.hole ? normalizeDovetailClearance(shape.dovetailClearance) : 0,
  );
}

export function createDovetailGeometry(options: DovetailGeometryOptions): THREE.BufferGeometry {
  const height = Math.max(0.01, options.height);
  const contour = dovetailOutlineForShape(options);
  const count = contour.length;
  const positions: number[] = [];
  const indices: number[] = [];
  contour.forEach((point) => positions.push(point.x, 0, point.y));
  contour.forEach((point) => positions.push(point.x, height, point.y));
  const outline = contour.map((point) => new THREE.Vector2(point.x, point.y));
  const clockwise = THREE.ShapeUtils.isClockWise(outline);
  THREE.ShapeUtils.triangulateShape(outline, []).forEach(([a, b, c]) => {
    if (clockwise) indices.push(count + a, count + b, count + c, a, c, b);
    else indices.push(count + a, count + c, count + b, a, b, c);
  });
  for (let i = 0; i < count; i += 1) {
    const next = (i + 1) % count;
    if (clockwise) indices.push(i, next, count + next, i, count + next, count + i);
    else indices.push(i, count + next, next, i, count + i, count + next);
  }
  const indexed = new THREE.BufferGeometry();
  indexed.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  indexed.setIndex(indices);
  const geometry = toCreasedNormals(indexed, THREE.MathUtils.degToRad(30));
  indexed.dispose();
  geometry.computeBoundingBox();
  return geometry;
}
