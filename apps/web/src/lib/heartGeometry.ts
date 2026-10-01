import * as THREE from "three";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { WorkplaneShape } from "@/types/sketchforge";

export const DEFAULT_HEART_WIDTH = 40;
export const DEFAULT_HEART_DEPTH = 40;
export const DEFAULT_HEART_HEIGHT = 10;
export const DEFAULT_HEART_TIP_FILLET = 0;
export const DEFAULT_HEART_QUALITY = 32;
export const MIN_HEART_QUALITY = 16;
export const MAX_HEART_QUALITY = 64;
export const MIN_HEART_FILLET = 0;
export const MAX_HEART_FILLET = 20;

type Point2D = { x: number; y: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeHeartQuality(value?: number) {
  return clamp(Math.round(Number.isFinite(value) ? (value as number) : DEFAULT_HEART_QUALITY), MIN_HEART_QUALITY, MAX_HEART_QUALITY);
}

export function normalizeHeartTipFillet(value?: number) {
  return clamp(Number.isFinite(value) ? (value as number) : DEFAULT_HEART_TIP_FILLET, MIN_HEART_FILLET, MAX_HEART_FILLET);
}

export function heartSettings(shape: Pick<WorkplaneShape, "width" | "depth" | "heartTipFillet" | "heartQuality">) {
  return {
    tipFillet: normalizeHeartTipFillet(shape.heartTipFillet),
    quality: normalizeHeartQuality(shape.heartQuality),
  };
}

export type HeartGeometryOptions = {
  width: number;
  depth: number;
  height: number;
  heartTipFillet?: number;
  heartQuality?: number;
};

function cornerAngles(pPrev: Point2D, pCurr: Point2D, pNext: Point2D) {
  const dx1 = pPrev.x - pCurr.x;
  const dy1 = pPrev.y - pCurr.y;
  const len1 = Math.hypot(dx1, dy1) || 1;
  const dx2 = pNext.x - pCurr.x;
  const dy2 = pNext.y - pCurr.y;
  const len2 = Math.hypot(dx2, dy2) || 1;
  const dot = (dx1 * dx2 + dy1 * dy2) / (len1 * len2);
  const cosAlpha = Math.max(1e-4, Math.sqrt((1 + clamp(dot, -1, 1)) / 2));
  const sinAlpha = Math.max(1e-4, Math.sqrt((1 - clamp(dot, -1, 1)) / 2));
  return { sinAlpha, tanAlpha: sinAlpha / cosAlpha };
}

function shortestAngleDelta(from: number, to: number) {
  let delta = to - from;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

export function buildHeartContourPoints(width: number, depth: number, requestedTipFillet = DEFAULT_HEART_TIP_FILLET, quality = DEFAULT_HEART_QUALITY): Point2D[] {
  const safeWidth = Math.max(0.01, width);
  const safeDepth = Math.max(0.01, depth);
  const fillet = normalizeHeartTipFillet(requestedTipFillet);
  const steps = normalizeHeartQuality(quality);
  const R = 0.28;
  const xc = 0.22;
  const yc = 0.18;
  const yTip = 0.5;
  const phiBase = Math.atan2(-yc - yTip, -xc);
  const phiTangent = phiBase + Math.acos(clamp(R / Math.hypot(xc, yc + yTip), -1, 1));
  const yCleft = yc + Math.sqrt(Math.max(0, R * R - xc * xc));
  const phiCleftRight = Math.atan2(yCleft - yc, -xc);
  let deltaRight = phiCleftRight - phiTangent;
  while (deltaRight < 0) deltaRight += Math.PI * 2;
  const rightSteps = Math.max(4, Math.round(steps / 2));
  const rawPoints: Point2D[] = [{ x: 0, y: -yTip }];
  for (let i = 0; i < rightSteps; i += 1) {
    const phi = phiTangent + (i / rightSteps) * deltaRight;
    rawPoints.push({ x: xc + R * Math.cos(phi), y: yc + R * Math.sin(phi) });
  }
  rawPoints.push({ x: 0, y: yCleft });
  for (let i = rightSteps - 1; i >= 0; i -= 1) {
    const phi = phiTangent + (i / rightSteps) * deltaRight;
    rawPoints.push({ x: -(xc + R * Math.cos(phi)), y: yc + R * Math.sin(phi) });
  }

  const xs = rawPoints.map((p) => p.x);
  const ys = rawPoints.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = Math.max(1e-5, maxX - minX);
  const spanY = Math.max(1e-5, maxY - minY);
  const scaled = rawPoints.map((p) => ({
    x: ((p.x - (minX + maxX) / 2) / spanX) * safeWidth,
    y: ((p.y - (minY + maxY) / 2) / spanY) * safeDepth,
  }));
  if (fillet <= 0.01) return scaled;

  const P = scaled[0];
  const prev = scaled[scaled.length - 1];
  const next = scaled[1];
  const edgeLen = Math.hypot(next.x - P.x, next.y - P.y);
  const { sinAlpha, tanAlpha } = cornerAngles(prev, P, next);
  const t = Math.min(edgeLen * 0.45, fillet / tanAlpha);
  const r = t * tanAlpha;
  if (t <= 0.01 || r <= 0.01) return scaled;
  const prevLen = Math.hypot(prev.x - P.x, prev.y - P.y);
  const nextLen = Math.hypot(next.x - P.x, next.y - P.y);
  const u1 = { x: (prev.x - P.x) / prevLen, y: (prev.y - P.y) / prevLen };
  const u2 = { x: (next.x - P.x) / nextLen, y: (next.y - P.y) / nextLen };
  const bLen = Math.hypot(u1.x + u2.x, u1.y + u2.y) || 1;
  const b = { x: (u1.x + u2.x) / bLen, y: (u1.y + u2.y) / bLen };
  const C = { x: P.x + (r / sinAlpha) * b.x, y: P.y + (r / sinAlpha) * b.y };
  const T1 = { x: P.x + t * u1.x, y: P.y + t * u1.y };
  const T2 = { x: P.x + t * u2.x, y: P.y + t * u2.y };
  const phi1 = Math.atan2(T1.y - C.y, T1.x - C.x);
  const delta = shortestAngleDelta(phi1, Math.atan2(T2.y - C.y, T2.x - C.x));
  const filletSteps = Math.max(4, Math.round(steps / 4));
  const arc: Point2D[] = [];
  for (let i = 0; i <= filletSteps; i += 1) {
    const phi = phi1 + (i / filletSteps) * delta;
    arc.push({ x: C.x + r * Math.cos(phi), y: C.y + r * Math.sin(phi) });
  }
  return [...arc, ...scaled.slice(1)];
}

export function createHeartGeometry(options: HeartGeometryOptions): THREE.BufferGeometry {
  const height = Math.max(0.01, options.height);
  const contour = buildHeartContourPoints(Math.max(0.01, options.width), Math.max(0.01, options.depth), normalizeHeartTipFillet(options.heartTipFillet), normalizeHeartQuality(options.heartQuality));
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
