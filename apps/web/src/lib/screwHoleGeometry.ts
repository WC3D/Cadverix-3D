import * as THREE from "three";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type ScrewHoleKind = "counterbore" | "countersink";

export const DEFAULT_COUNTERBORE_WIDTH = 6.4;
export const DEFAULT_COUNTERBORE_HEIGHT = 12;
export const DEFAULT_COUNTERSINK_WIDTH = 6.6;
export const DEFAULT_COUNTERSINK_HEIGHT = 8;
export const DEFAULT_SCREW_HOLE_SHAFT = 3.4;
export const DEFAULT_SCREW_HOLE_HEAD_DEPTH = 3.2;
export const DEFAULT_SCREW_HOLE_ANGLE = 90;
export const MIN_SCREW_HOLE_ANGLE = 30;
export const MAX_SCREW_HOLE_ANGLE = 150;
const DEFAULT_SEGMENTS = 48;
const MAX_SHAFT_SHARE = 0.95;
const MIN_SHAFT = 0.1;
const MIN_SHAFT_LENGTH = 0.2;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeScrewHoleShaft(value: number | undefined, headWidth: number) {
  const requested = Number.isFinite(value) ? value as number : DEFAULT_SCREW_HOLE_SHAFT;
  return clamp(requested, Math.min(MIN_SHAFT, headWidth * 0.5), Math.max(MIN_SHAFT, headWidth * MAX_SHAFT_SHARE));
}

export function normalizeScrewHoleHeadDepth(value: number | undefined, height: number) {
  const requested = Number.isFinite(value) ? value as number : DEFAULT_SCREW_HOLE_HEAD_DEPTH;
  return clamp(requested, 0.1, Math.max(0.1, height - MIN_SHAFT_LENGTH));
}

export function normalizeScrewHoleAngle(value: number | undefined) {
  return clamp(Number.isFinite(value) ? value as number : DEFAULT_SCREW_HOLE_ANGLE, MIN_SCREW_HOLE_ANGLE, MAX_SCREW_HOLE_ANGLE);
}

export function countersinkDepth(headWidth: number, shaft: number, angle: number) {
  return Math.max(0, (headWidth - shaft) / 2 / Math.tan(THREE.MathUtils.degToRad(normalizeScrewHoleAngle(angle)) / 2));
}

type ProfilePoint = { r: number; y: number };

export type ScrewHoleGeometryOptions = {
  kind: ScrewHoleKind;
  width: number;
  depth: number;
  height: number;
  screwHoleShaft?: number;
  screwHoleHeadDepth?: number;
  screwHoleAngle?: number;
  sides?: number;
};

export function screwHoleProfile({
  kind,
  width,
  height,
  screwHoleShaft,
  screwHoleHeadDepth,
  screwHoleAngle,
}: Omit<ScrewHoleGeometryOptions, "depth">): ProfilePoint[] {
  const safeHeight = Math.max(0.01, height);
  const headRadius = Math.max(0.005, width / 2);
  const shaftRadius = normalizeScrewHoleShaft(screwHoleShaft, width) / 2;
  if (kind === "counterbore") {
    const stepY = safeHeight - normalizeScrewHoleHeadDepth(screwHoleHeadDepth, safeHeight);
    return [
      { r: shaftRadius, y: 0 },
      { r: shaftRadius, y: stepY },
      { r: headRadius, y: stepY },
      { r: headRadius, y: safeHeight },
    ];
  }
  const coneDepth = Math.min(
    countersinkDepth(width, shaftRadius * 2, screwHoleAngle ?? DEFAULT_SCREW_HOLE_ANGLE),
    safeHeight - MIN_SHAFT_LENGTH,
  );
  return [
    { r: shaftRadius, y: 0 },
    { r: shaftRadius, y: safeHeight - coneDepth },
    { r: headRadius, y: safeHeight },
  ];
}

export function createScrewHoleGeometry(options: ScrewHoleGeometryOptions): THREE.BufferGeometry {
  const profile = screwHoleProfile(options);
  const rings = profile.length;
  const segments = Math.max(3, Math.round(options.sides ?? DEFAULT_SEGMENTS));
  const stretch = Math.max(0.01, options.depth) / Math.max(0.01, options.width);
  const positions: number[] = [];
  const indices: number[] = [];
  profile.forEach(({ r, y }) => {
    for (let s = 0; s < segments; s += 1) {
      const angle = (s / segments) * Math.PI * 2;
      positions.push(r * Math.cos(angle), y, r * Math.sin(angle) * stretch);
    }
  });
  const bottomCentre = rings * segments;
  const topCentre = bottomCentre + 1;
  positions.push(0, profile[0].y, 0, 0, profile[rings - 1].y, 0);
  for (let s = 0; s < segments; s += 1) {
    const next = (s + 1) % segments;
    indices.push(bottomCentre, s, next);
    indices.push(topCentre, (rings - 1) * segments + next, (rings - 1) * segments + s);
    for (let ring = 0; ring < rings - 1; ring += 1) {
      const a = ring * segments + s;
      const b = ring * segments + next;
      const c = (ring + 1) * segments + next;
      const d = (ring + 1) * segments + s;
      indices.push(a, d, c, a, c, b);
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
