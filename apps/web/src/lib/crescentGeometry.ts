import * as THREE from "three";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { WorkplaneShape } from "@/types/sketchforge";

export const DEFAULT_CRESCENT_WIDTH = 40;
export const DEFAULT_CRESCENT_DEPTH = 40;
export const DEFAULT_CRESCENT_HEIGHT = 10;
export const DEFAULT_CRESCENT_THICKNESS = 14;
export const DEFAULT_CRESCENT_TIP_FILLET = 0.5;
export const DEFAULT_CRESCENT_QUALITY = 32;
export const MIN_CRESCENT_QUALITY = 16;
export const MAX_CRESCENT_QUALITY = 64;
export const MIN_CRESCENT_FILLET = 0;
export const MAX_CRESCENT_FILLET = 8;
export const MIN_CRESCENT_THICKNESS = 1;

type Point2D = { x: number; y: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeCrescentQuality(value?: number) {
  return clamp(Math.round(Number.isFinite(value) ? (value as number) : DEFAULT_CRESCENT_QUALITY), MIN_CRESCENT_QUALITY, MAX_CRESCENT_QUALITY);
}

export function normalizeCrescentTipFillet(value?: number) {
  return clamp(Number.isFinite(value) ? (value as number) : DEFAULT_CRESCENT_TIP_FILLET, MIN_CRESCENT_FILLET, MAX_CRESCENT_FILLET);
}

export function normalizeCrescentThickness(value: number | undefined, width: number) {
  return clamp(Number.isFinite(value) ? (value as number) : width * 0.35, MIN_CRESCENT_THICKNESS, Math.max(MIN_CRESCENT_THICKNESS, width * 0.85));
}

export function crescentSettings(shape: Pick<WorkplaneShape, "width" | "depth" | "crescentThickness" | "crescentTipFillet" | "crescentQuality">) {
  const width = Math.max(0.01, shape.width);
  return {
    thickness: normalizeCrescentThickness(shape.crescentThickness, width),
    tipFillet: normalizeCrescentTipFillet(shape.crescentTipFillet),
    quality: normalizeCrescentQuality(shape.crescentQuality),
  };
}

export type CrescentGeometryOptions = {
  width: number;
  depth: number;
  height: number;
  crescentThickness?: number;
  crescentTipFillet?: number;
  crescentQuality?: number;
};

function cornerAngles(prev: Point2D, point: Point2D, next: Point2D) {
  const v1 = { x: prev.x - point.x, y: prev.y - point.y };
  const v2 = { x: next.x - point.x, y: next.y - point.y };
  const len1 = Math.hypot(v1.x, v1.y) || 1;
  const len2 = Math.hypot(v2.x, v2.y) || 1;
  const dot = clamp((v1.x * v2.x + v1.y * v2.y) / (len1 * len2), -1, 1);
  const cosAlpha = Math.max(1e-4, Math.sqrt((1 + dot) / 2));
  const sinAlpha = Math.max(1e-4, Math.sqrt((1 - dot) / 2));
  return { sinAlpha, tanAlpha: sinAlpha / cosAlpha };
}

function shortestAngleDelta(from: number, to: number) {
  let delta = to - from;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

export function buildCrescentContourPoints(width: number, depth: number, requestedThickness?: number, requestedTipFillet?: number, quality = DEFAULT_CRESCENT_QUALITY): Point2D[] {
  const safeWidth = Math.max(0.01, width);
  const safeDepth = Math.max(0.01, depth);
  const thickness = normalizeCrescentThickness(requestedThickness, safeWidth);
  const fillet = normalizeCrescentTipFillet(requestedTipFillet);
  const steps = normalizeCrescentQuality(quality);
  const halfW = safeWidth / 2;
  const halfD = safeDepth / 2;
  const xo = (safeDepth * safeDepth) / (8 * safeWidth);
  const Ro = halfW + xo;
  const xin = -halfW + thickness;
  const xi = (safeWidth * safeWidth / 4 + safeDepth * safeDepth / 4 - xin * xin) / (2 * (safeWidth - thickness));
  const Ri = xi - xin;
  const phiO1 = Math.atan2(-halfD, halfW - xo);
  const phiO2 = Math.atan2(halfD, halfW - xo);
  const phiI1 = Math.atan2(-halfD, halfW - xi);
  const phiI2 = Math.atan2(halfD, halfW - xi);
  const outerSteps = Math.max(8, Math.round(steps / 2));
  let deltaOuter = phiO2 - phiO1;
  if (deltaOuter > 0) deltaOuter -= Math.PI * 2;
  const raw: Point2D[] = [];
  for (let i = 0; i < outerSteps; i += 1) {
    const phi = phiO1 + (i / outerSteps) * deltaOuter;
    raw.push({ x: xo + Ro * Math.cos(phi), y: Ro * Math.sin(phi) });
  }
  raw.push({ x: halfW, y: halfD });
  const innerSteps = Math.max(8, Math.round(steps / 2));
  let deltaInner = phiI1 - phiI2;
  if (deltaInner < 0) deltaInner += Math.PI * 2;
  for (let i = 1; i < innerSteps; i += 1) {
    const phi = phiI2 + (i / innerSteps) * deltaInner;
    raw.push({ x: xi + Ri * Math.cos(phi), y: Ri * Math.sin(phi) });
  }

  const xs = raw.map((p) => p.x);
  const ys = raw.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = Math.max(1e-5, maxX - minX);
  const spanY = Math.max(1e-5, maxY - minY);
  const scaled = raw.map((p) => ({
    x: ((p.x - (minX + maxX) / 2) / spanX) * safeWidth,
    y: ((p.y - (minY + maxY) / 2) / spanY) * safeDepth,
  }));
  if (fillet <= 0.01) return scaled;

  const applyFilletAt = (points: Point2D[], index: number): Point2D[] => {
    const point = points[index];
    const prev = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    const len1 = Math.hypot(prev.x - point.x, prev.y - point.y);
    const len2 = Math.hypot(next.x - point.x, next.y - point.y);
    const { sinAlpha, tanAlpha } = cornerAngles(prev, point, next);
    const t = Math.min(Math.min(len1, len2) * 0.4, fillet / tanAlpha);
    const r = t * tanAlpha;
    if (t <= 0.01 || r <= 0.01) return points;
    const u1 = { x: (prev.x - point.x) / len1, y: (prev.y - point.y) / len1 };
    const u2 = { x: (next.x - point.x) / len2, y: (next.y - point.y) / len2 };
    const bLen = Math.hypot(u1.x + u2.x, u1.y + u2.y) || 1;
    const b = { x: (u1.x + u2.x) / bLen, y: (u1.y + u2.y) / bLen };
    const center = { x: point.x + (r / sinAlpha) * b.x, y: point.y + (r / sinAlpha) * b.y };
    const t1 = { x: point.x + t * u1.x, y: point.y + t * u1.y };
    const t2 = { x: point.x + t * u2.x, y: point.y + t * u2.y };
    const phi1 = Math.atan2(t1.y - center.y, t1.x - center.x);
    const delta = shortestAngleDelta(phi1, Math.atan2(t2.y - center.y, t2.x - center.x));
    const filletSteps = Math.max(3, Math.round(steps / 6));
    const arc: Point2D[] = [];
    for (let i = 0; i <= filletSteps; i += 1) {
      const phi = phi1 + (i / filletSteps) * delta;
      arc.push({ x: center.x + r * Math.cos(phi), y: center.y + r * Math.sin(phi) });
    }
    return [...points.slice(0, index), ...arc, ...points.slice(index + 1)];
  };
  return applyFilletAt(applyFilletAt(scaled, outerSteps), 0);
}

export function createCrescentGeometry(options: CrescentGeometryOptions): THREE.BufferGeometry {
  const width = Math.max(0.01, options.width);
  const depth = Math.max(0.01, options.depth);
  const height = Math.max(0.01, options.height);
  const contour = buildCrescentContourPoints(width, depth, normalizeCrescentThickness(options.crescentThickness, width), normalizeCrescentTipFillet(options.crescentTipFillet), normalizeCrescentQuality(options.crescentQuality));
  const count = contour.length;
  const positions: number[] = [];
  const indices: number[] = [];
  contour.forEach((p) => positions.push(p.x, 0, p.y));
  contour.forEach((p) => positions.push(p.x, height, p.y));
  const outline = contour.map((p) => new THREE.Vector2(p.x, p.y));
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
