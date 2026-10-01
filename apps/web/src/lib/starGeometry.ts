import * as THREE from "three";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { WorkplaneShape } from "@/types/sketchforge";

export const DEFAULT_STAR_POINTS = 5;
export const MIN_STAR_POINTS = 3;
export const MAX_STAR_POINTS = 32;
export const DEFAULT_STAR_OUTER_SIZE = 40;
export const DEFAULT_STAR_INNER_SIZE = 20;
export const DEFAULT_STAR_HEIGHT = 10;
export const DEFAULT_STAR_OUTER_FILLET = 0;
export const DEFAULT_STAR_INNER_FILLET = 0;
export const DEFAULT_STAR_INNER_RATIO = 0.5;
export const MIN_STAR_INNER_SIZE = 0.1;
export const MIN_STAR_FILLET = 0;
export const MAX_STAR_FILLET = 80;
export const DEFAULT_STAR_QUALITY = 16;
export const MIN_STAR_QUALITY = 4;
export const MAX_STAR_QUALITY = 48;

type Point2D = { x: number; y: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeStarQuality(value?: number) {
  return clamp(Math.round(Number.isFinite(value) ? (value as number) : DEFAULT_STAR_QUALITY), MIN_STAR_QUALITY, MAX_STAR_QUALITY);
}

function cornerAngles(pPrev: Point2D, pCurr: Point2D, pNext: Point2D) {
  const dx1 = pPrev.x - pCurr.x;
  const dy1 = pPrev.y - pCurr.y;
  const len1 = Math.hypot(dx1, dy1) || 1;
  const dx2 = pNext.x - pCurr.x;
  const dy2 = pNext.y - pCurr.y;
  const len2 = Math.hypot(dx2, dy2) || 1;
  const dot = (dx1 * dx2 + dy1 * dy2) / (len1 * len2);
  const clampedDot = Math.max(-1, Math.min(1, dot));
  const cosAlpha = Math.max(1e-4, Math.sqrt((1 + clampedDot) / 2));
  const sinAlpha = Math.max(1e-4, Math.sqrt((1 - clampedDot) / 2));
  return { sinAlpha, cosAlpha, tanAlpha: sinAlpha / cosAlpha };
}

export function normalizeStarPoints(value?: number) {
  return clamp(Math.round(Number.isFinite(value) ? (value as number) : DEFAULT_STAR_POINTS), MIN_STAR_POINTS, MAX_STAR_POINTS);
}

export function normalizeStarInnerSize(value: number | undefined, outerSize: number) {
  const maxInner = Math.max(MIN_STAR_INNER_SIZE, outerSize - 0.1);
  return clamp(Number.isFinite(value) ? (value as number) : outerSize * DEFAULT_STAR_INNER_RATIO, MIN_STAR_INNER_SIZE, maxInner);
}

export function normalizeStarOuterFillet(value: number | undefined) {
  return clamp(Number.isFinite(value) ? (value as number) : 0, MIN_STAR_FILLET, MAX_STAR_FILLET);
}

export function normalizeStarInnerFillet(value: number | undefined) {
  return clamp(Number.isFinite(value) ? (value as number) : 0, MIN_STAR_FILLET, MAX_STAR_FILLET);
}

export const normalizeStarFillet = normalizeStarOuterFillet;

export function starMaxFilletRadii(outerSize: number, innerSize: number, points: number) {
  const N = normalizeStarPoints(points);
  const Ro = Math.max(0.01, outerSize) / 2;
  const Ri = normalizeStarInnerSize(innerSize, Math.max(0.01, outerSize)) / 2;
  const angleIn1 = -Math.PI / 2 + Math.PI / N;
  const pOut = { x: 0, y: -Ro };
  const pIn1 = { x: Ri * Math.cos(angleIn1), y: Ri * Math.sin(angleIn1) };
  const pInLeft = { x: Ri * Math.cos(-Math.PI / 2 - Math.PI / N), y: Ri * Math.sin(-Math.PI / 2 - Math.PI / N) };
  const edgeLength = Math.hypot(pIn1.x - pOut.x, pIn1.y - pOut.y);
  const { tanAlpha: tanAlphaOut } = cornerAngles(pInLeft, pOut, pIn1);
  const angleOut2 = -Math.PI / 2 + (2 * Math.PI) / N;
  const pOut2 = { x: Ro * Math.cos(angleOut2), y: Ro * Math.sin(angleOut2) };
  const { tanAlpha: tanAlphaIn } = cornerAngles(pOut, pIn1, pOut2);
  const maxTangent = edgeLength * 0.96;
  return {
    maxOuterRadius: Math.max(0.1, maxTangent * tanAlphaOut),
    maxInnerRadius: Math.max(0.1, maxTangent * tanAlphaIn),
    edgeLength,
  };
}

export function starSettings(shape: Pick<WorkplaneShape, "width" | "depth" | "starPoints" | "starInnerSize" | "starOuterFillet" | "starInnerFillet" | "starQuality">) {
  const outerSize = Math.max(0.01, Math.min(shape.width, shape.depth));
  return {
    points: normalizeStarPoints(shape.starPoints),
    innerSize: normalizeStarInnerSize(shape.starInnerSize, outerSize),
    outerFillet: normalizeStarOuterFillet(shape.starOuterFillet),
    innerFillet: normalizeStarInnerFillet(shape.starInnerFillet),
    quality: normalizeStarQuality(shape.starQuality),
  };
}

export type StarGeometryOptions = {
  width: number;
  depth: number;
  height: number;
  starPoints?: number;
  starInnerSize?: number;
  starOuterFillet?: number;
  starInnerFillet?: number;
  starQuality?: number;
};

function shortestAngleDelta(from: number, to: number): number {
  let delta = to - from;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

export function buildStarContourPoints(
  outerSize: number,
  innerSize: number,
  points: number,
  requestedOuterFillet: number,
  requestedInnerFillet: number,
  segmentsPerFillet = DEFAULT_STAR_QUALITY,
): Point2D[] {
  const N = normalizeStarPoints(points);
  const Ro = Math.max(0.01, outerSize / 2);
  const Ri = Math.max(0.005, Math.min(Ro - 0.05, innerSize / 2));
  const totalVertices = N * 2;
  const baseCorners: Point2D[] = [];
  for (let k = 0; k < totalVertices; k += 1) {
    const angle = -Math.PI / 2 + (k * Math.PI) / N;
    const r = k % 2 === 0 ? Ro : Ri;
    baseCorners.push({ x: r * Math.cos(angle), y: r * Math.sin(angle) });
  }

  const edgeLength = Math.hypot(baseCorners[1].x - baseCorners[0].x, baseCorners[1].y - baseCorners[0].y);
  const { tanAlpha: tanAlphaOut } = cornerAngles(baseCorners[totalVertices - 1], baseCorners[0], baseCorners[1]);
  const { tanAlpha: tanAlphaIn } = cornerAngles(baseCorners[0], baseCorners[1], baseCorners[2]);
  let tOut = requestedOuterFillet > 0 ? requestedOuterFillet / tanAlphaOut : 0;
  let tIn = requestedInnerFillet > 0 ? requestedInnerFillet / tanAlphaIn : 0;
  const maxTotalTangent = edgeLength * 0.96;
  if (tOut + tIn > maxTotalTangent && tOut + tIn > 0) {
    const scale = maxTotalTangent / (tOut + tIn);
    tOut *= scale;
    tIn *= scale;
  }

  const effectiveOuterRadius = tOut * tanAlphaOut;
  const effectiveInnerRadius = tIn * tanAlphaIn;
  const contour: Point2D[] = [];
  for (let k = 0; k < totalVertices; k += 1) {
    const isOuter = k % 2 === 0;
    const t = isOuter ? tOut : tIn;
    const r = isOuter ? effectiveOuterRadius : effectiveInnerRadius;
    const P = baseCorners[k];
    const prev = baseCorners[(k - 1 + totalVertices) % totalVertices];
    const next = baseCorners[(k + 1) % totalVertices];
    if (t <= 1e-4 || r <= 1e-4) {
      contour.push(P);
      continue;
    }
    const { sinAlpha } = cornerAngles(prev, P, next);
    const u1 = { x: (prev.x - P.x) / edgeLength, y: (prev.y - P.y) / edgeLength };
    const u2 = { x: (next.x - P.x) / edgeLength, y: (next.y - P.y) / edgeLength };
    const bLen = Math.hypot(u1.x + u2.x, u1.y + u2.y);
    const b = { x: (u1.x + u2.x) / bLen, y: (u1.y + u2.y) / bLen };
    const C = { x: P.x + (r / sinAlpha) * b.x, y: P.y + (r / sinAlpha) * b.y };
    const T1 = { x: P.x + t * u1.x, y: P.y + t * u1.y };
    const T2 = { x: P.x + t * u2.x, y: P.y + t * u2.y };
    const phi1 = Math.atan2(T1.y - C.y, T1.x - C.x);
    const deltaPhi = shortestAngleDelta(phi1, Math.atan2(T2.y - C.y, T2.x - C.x));
    const steps = Math.max(2, segmentsPerFillet);
    for (let s = 0; s <= steps; s += 1) {
      const phi = phi1 + (s / steps) * deltaPhi;
      contour.push({ x: C.x + r * Math.cos(phi), y: C.y + r * Math.sin(phi) });
    }
  }
  return contour;
}

export function createStarGeometry(options: StarGeometryOptions): THREE.BufferGeometry {
  const safeWidth = Math.max(0.01, options.width);
  const safeDepth = Math.max(0.01, options.depth);
  const safeHeight = Math.max(0.01, options.height);
  const outerSize = Math.max(safeWidth, safeDepth);
  const contour = buildStarContourPoints(
    outerSize,
    normalizeStarInnerSize(options.starInnerSize, outerSize),
    normalizeStarPoints(options.starPoints),
    normalizeStarOuterFillet(options.starOuterFillet),
    normalizeStarInnerFillet(options.starInnerFillet),
    normalizeStarQuality(options.starQuality),
  );
  const count = contour.length;
  const positions: number[] = [];
  const indices: number[] = [];
  const scaleX = safeWidth / outerSize;
  const scaleZ = safeDepth / outerSize;
  contour.forEach((p) => positions.push(p.x * scaleX, 0, p.y * scaleZ));
  contour.forEach((p) => positions.push(p.x * scaleX, safeHeight, p.y * scaleZ));
  const bottomCenter = count * 2;
  const topCenter = count * 2 + 1;
  positions.push(0, 0, 0, 0, safeHeight, 0);
  for (let i = 0; i < count; i += 1) {
    const next = (i + 1) % count;
    indices.push(bottomCenter, i, next, topCenter, count + next, count + i);
    indices.push(i, count + next, next, i, count + i, count + next);
  }
  const indexed = new THREE.BufferGeometry();
  indexed.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  indexed.setIndex(indices);
  const geometry = toCreasedNormals(indexed, THREE.MathUtils.degToRad(30));
  indexed.dispose();
  geometry.computeBoundingBox();
  return geometry;
}
