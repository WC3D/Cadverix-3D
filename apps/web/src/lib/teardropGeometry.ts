import * as THREE from "three";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export const DEFAULT_TEARDROP_WIDTH = 6;
export const DEFAULT_TEARDROP_DEPTH = 20;
export const DEFAULT_TEARDROP_TIP_ANGLE = 90;
export const MIN_TEARDROP_TIP_ANGLE = 40;
export const MAX_TEARDROP_TIP_ANGLE = 140;
const TEARDROP_CIRCLE_SEGMENTS = 48;
const MIN_TIP_RISE = 1.02;

type Point2D = { x: number; y: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeTeardropTipAngle(angle: number) {
  return clamp(Number.isFinite(angle) ? angle : DEFAULT_TEARDROP_TIP_ANGLE, MIN_TEARDROP_TIP_ANGLE, MAX_TEARDROP_TIP_ANGLE);
}

export function teardropHeightForTipAngle(width: number, tipAngle: number) {
  const radius = Math.max(0.005, width / 2);
  const half = THREE.MathUtils.degToRad(normalizeTeardropTipAngle(tipAngle) / 2);
  return radius + radius / Math.sin(half);
}

export function teardropTipAngle(width: number, height: number) {
  const radius = Math.max(0.005, width / 2);
  const rise = height - radius;
  if (rise <= radius * MIN_TIP_RISE) return 180;
  return THREE.MathUtils.radToDeg(2 * Math.asin(radius / rise));
}

export function teardropContourPoints(width: number, height: number, circleSegments = TEARDROP_CIRCLE_SEGMENTS): Point2D[] {
  const radius = Math.max(0.005, width / 2);
  const safeHeight = Math.max(0.01, height);
  const rise = Math.max(safeHeight - radius, radius * MIN_TIP_RISE);
  const naturalHeight = radius + rise;
  const tangent = Math.acos(radius / rise);
  const arcStart = Math.PI / 2 - tangent;
  const arcEnd = Math.PI / 2 + tangent;
  const arcSpan = 2 * Math.PI - (arcEnd - arcStart);
  const steps = Math.max(8, Math.ceil((Math.max(3, circleSegments) * arcSpan) / (2 * Math.PI)));
  const squash = safeHeight / naturalHeight;
  const points: Point2D[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const angle = arcEnd + (arcSpan * i) / steps;
    points.push({ x: radius * Math.cos(angle), y: (radius + radius * Math.sin(angle)) * squash });
  }
  points.push({ x: 0, y: (radius + rise) * squash });
  return points;
}

export type TeardropGeometryOptions = {
  width: number;
  depth: number;
  height: number;
  sides?: number;
};

export function createTeardropGeometry({ width, depth, height, sides }: TeardropGeometryOptions): THREE.BufferGeometry {
  const safeDepth = Math.max(0.01, depth);
  const contour = teardropContourPoints(width, height, sides);
  const count = contour.length;
  const front = safeDepth / 2;
  const back = -safeDepth / 2;
  const positions: number[] = [];
  const indices: number[] = [];
  contour.forEach((point) => positions.push(point.x, point.y, back));
  contour.forEach((point) => positions.push(point.x, point.y, front));
  const outline = contour.map((point) => new THREE.Vector2(point.x, point.y));
  const clockwise = THREE.ShapeUtils.isClockWise(outline);
  THREE.ShapeUtils.triangulateShape(outline, []).forEach(([a, b, c]) => {
    if (clockwise) indices.push(count + a, count + c, count + b, a, b, c);
    else indices.push(count + a, count + b, count + c, a, c, b);
  });
  for (let i = 0; i < count; i += 1) {
    const next = (i + 1) % count;
    if (clockwise) indices.push(i, count + next, next, i, count + i, count + next);
    else indices.push(i, next, count + next, i, count + next, count + i);
  }
  const indexed = new THREE.BufferGeometry();
  indexed.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  indexed.setIndex(indices);
  const geometry = toCreasedNormals(indexed, THREE.MathUtils.degToRad(30));
  indexed.dispose();
  geometry.computeBoundingBox();
  return geometry;
}

export function teardropExactSection(width: number, height: number) {
  const radius = Math.max(0.005, width / 2);
  const rise = height - radius;
  if (!(rise > radius * MIN_TIP_RISE)) return null;
  const tangent = Math.acos(radius / rise);
  const start = Math.PI / 2 + tangent;
  const end = Math.PI / 2 - tangent + Math.PI * 2;
  const at = (angle: number) => ({ x: radius * Math.cos(angle), z: radius + radius * Math.sin(angle) });
  return {
    arc: { start: at(start), end: at(end), arc: { cx: 0, cz: radius, rx: radius, rz: radius, start, end } },
    tip: { x: 0, z: radius + rise },
  };
}
