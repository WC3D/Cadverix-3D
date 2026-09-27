import * as THREE from "three";
import type { ThreadFamily, ThreadHandedness, ThreadMode } from "@/types/sketchforge";

export type { ThreadFamily, ThreadHandedness, ThreadMode } from "@/types/sketchforge";

export type ThreadPreset = {
  id: string;
  label: string;
  family: Exclude<ThreadFamily, "custom">;
  diameter: number;
  pitch: number;
  headAcrossFlats: number;
  headHeight: number;
  nutAcrossFlats: number;
  nutHeight: number;
};

export const MIN_THREAD_QUALITY = 12;
export const MAX_THREAD_QUALITY = 96;
export const DEFAULT_THREAD_QUALITY = 36;
export const DEFAULT_THREAD_MODE: ThreadMode = "external";
export const DEFAULT_THREAD_HANDEDNESS: ThreadHandedness = "right";

// ISO 4017 hex-head and ISO 4032 regular-nut dimensions, in millimeters.
export const METRIC_THREAD_PRESETS: readonly ThreadPreset[] = [
  { id: "m3", label: "M3", family: "metric", diameter: 3, pitch: 0.5, headAcrossFlats: 5.5, headHeight: 2, nutAcrossFlats: 5.5, nutHeight: 2.4 },
  { id: "m4", label: "M4", family: "metric", diameter: 4, pitch: 0.7, headAcrossFlats: 7, headHeight: 2.8, nutAcrossFlats: 7, nutHeight: 3.2 },
  { id: "m5", label: "M5", family: "metric", diameter: 5, pitch: 0.8, headAcrossFlats: 8, headHeight: 3.5, nutAcrossFlats: 8, nutHeight: 4 },
  { id: "m6", label: "M6", family: "metric", diameter: 6, pitch: 1, headAcrossFlats: 10, headHeight: 4, nutAcrossFlats: 10, nutHeight: 5 },
  { id: "m8", label: "M8", family: "metric", diameter: 8, pitch: 1.25, headAcrossFlats: 13, headHeight: 5.3, nutAcrossFlats: 13, nutHeight: 6.5 },
  { id: "m10", label: "M10", family: "metric", diameter: 10, pitch: 1.5, headAcrossFlats: 16, headHeight: 6.4, nutAcrossFlats: 16, nutHeight: 8 },
  { id: "m12", label: "M12", family: "metric", diameter: 12, pitch: 1.75, headAcrossFlats: 18, headHeight: 7.5, nutAcrossFlats: 18, nutHeight: 10 },
] as const;

export const ISO_METRIC_THREAD_PRESETS = METRIC_THREAD_PRESETS;

// Common ASME hex-cap-screw and finished-hex-nut dimensions, converted to millimeters.
export const IMPERIAL_THREAD_PRESETS: readonly ThreadPreset[] = [
  { id: "8-32-unc", label: "#8-32", family: "unc", diameter: 4.1656, pitch: 25.4 / 32, headAcrossFlats: 6.35, headHeight: 2.794, nutAcrossFlats: 8.731, nutHeight: 3.175 },
  { id: "10-24-unc", label: "#10-24", family: "unc", diameter: 4.826, pitch: 25.4 / 24, headAcrossFlats: 7.9375, headHeight: 3.175, nutAcrossFlats: 9.525, nutHeight: 3.969 },
  { id: "10-32-unf", label: "#10-32", family: "unf", diameter: 4.826, pitch: 25.4 / 32, headAcrossFlats: 7.9375, headHeight: 3.175, nutAcrossFlats: 9.525, nutHeight: 3.969 },
  { id: "1/4-20-unc", label: "1/4-20", family: "unc", diameter: 6.35, pitch: 25.4 / 20, headAcrossFlats: 11.1125, headHeight: 4.366, nutAcrossFlats: 11.1125, nutHeight: 5.556 },
  { id: "1/4-28-unf", label: "1/4-28", family: "unf", diameter: 6.35, pitch: 25.4 / 28, headAcrossFlats: 11.1125, headHeight: 4.366, nutAcrossFlats: 11.1125, nutHeight: 5.556 },
  { id: "5/16-18-unc", label: "5/16-18", family: "unc", diameter: 7.9375, pitch: 25.4 / 18, headAcrossFlats: 12.7, headHeight: 5.159, nutAcrossFlats: 12.7, nutHeight: 6.747 },
  { id: "5/16-24-unf", label: "5/16-24", family: "unf", diameter: 7.9375, pitch: 25.4 / 24, headAcrossFlats: 12.7, headHeight: 5.159, nutAcrossFlats: 12.7, nutHeight: 6.747 },
  { id: "3/8-16-unc", label: "3/8-16", family: "unc", diameter: 9.525, pitch: 25.4 / 16, headAcrossFlats: 14.2875, headHeight: 6.35, nutAcrossFlats: 14.2875, nutHeight: 8.334 },
  { id: "3/8-24-unf", label: "3/8-24", family: "unf", diameter: 9.525, pitch: 25.4 / 24, headAcrossFlats: 14.2875, headHeight: 6.35, nutAcrossFlats: 14.2875, nutHeight: 8.334 },
] as const;

export const UNC_THREAD_PRESETS = IMPERIAL_THREAD_PRESETS.filter((preset) => preset.family === "unc");
export const UNF_THREAD_PRESETS = IMPERIAL_THREAD_PRESETS.filter((preset) => preset.family === "unf");

export const THREAD_PRESETS: readonly ThreadPreset[] = [
  ...METRIC_THREAD_PRESETS,
  ...IMPERIAL_THREAD_PRESETS,
];

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function finiteOr(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? value as number : fallback;
}

export function normalizeThreadMode(value?: string): ThreadMode {
  return value === "none" || value === "internal" ? value : DEFAULT_THREAD_MODE;
}

export function normalizeThreadHandedness(value?: string): ThreadHandedness {
  return value === "left" ? "left" : DEFAULT_THREAD_HANDEDNESS;
}

export function normalizeThreadFamily(value?: string): ThreadFamily {
  return value === "metric" || value === "unc" || value === "unf" ? value : "custom";
}

export function normalizeFastenerDiameter(value?: number, fallback = 10) {
  return clamp(finiteOr(value, fallback), 0.1, 1000);
}

export const normalizeThreadDiameter = normalizeFastenerDiameter;

export function normalizeThreadPitch(value?: number, diameter = 10) {
  const safeDiameter = normalizeFastenerDiameter(diameter);
  return clamp(finiteOr(value, safeDiameter * 0.15), 0.1, Math.max(0.1, safeDiameter * 2));
}

export function normalizeThreadDepth(value?: number, diameter = 10, pitch?: number) {
  const safeDiameter = normalizeFastenerDiameter(diameter);
  const safePitch = normalizeThreadPitch(pitch, safeDiameter);
  return clamp(finiteOr(value, safePitch * 0.3), 0, safeDiameter * 0.22);
}

export function normalizeBoreDiameter(value: number | undefined, outerDiameter: number) {
  const safeOuter = normalizeFastenerDiameter(outerDiameter);
  return clamp(finiteOr(value, safeOuter * 0.5), 0.1, safeOuter * 0.9);
}

export function normalizeThreadQuality(value?: number) {
  return clamp(Math.round(finiteOr(value, DEFAULT_THREAD_QUALITY)), MIN_THREAD_QUALITY, MAX_THREAD_QUALITY);
}

export type ThreadGeometrySettings = {
  threadMode?: ThreadMode;
  threadPitch?: number;
  threadDepth?: number;
  threadHandedness?: ThreadHandedness;
  threadQuality?: number;
};

export type ThreadedCylinderGeometryOptions = ThreadGeometrySettings & {
  width: number;
  depth: number;
  height: number;
  boreDiameter?: number;
};

export type ScrewGeometryOptions = Omit<ThreadGeometrySettings, "threadMode"> & {
  width: number;
  depth: number;
  height: number;
  shaftDiameter?: number;
  headHeight?: number;
};

export type NutGeometryOptions = Omit<ThreadGeometrySettings, "threadMode"> & {
  width: number;
  depth: number;
  height: number;
  boreDiameter?: number;
};

export type WasherGeometryOptions = {
  width: number;
  depth: number;
  height: number;
  boreDiameter?: number;
  quality?: number;
};

type Ring = {
  y: number;
  outerRadius: (angle: number) => number;
  innerRadius?: (angle: number) => number;
};

function radialSegments(quality: number) {
  return Math.min(MAX_THREAD_QUALITY, Math.ceil(normalizeThreadQuality(quality) / 12) * 12);
}

function threadRidge(angle: number, y: number, pitch: number, handedness: ThreadHandedness) {
  const direction = handedness === "right" ? 1 : -1;
  const phase = angle / (Math.PI * 2) - direction * y / pitch;
  const centered = phase - Math.floor(phase + 0.5);
  return Math.max(0, 1 - Math.abs(centered) * 4);
}

function threadedRings(
  height: number,
  pitch: number,
  quality: number,
  makeRing: (y: number) => Ring,
) {
  const samplesPerTurn = clamp(Math.round(normalizeThreadQuality(quality) / 6), 4, 16);
  const count = clamp(Math.ceil(height / pitch * samplesPerTurn), 1, 256);
  return Array.from({ length: count + 1 }, (_, index) => makeRing(height * index / count));
}

function createRingGeometry(rings: Ring[], segments: number, scaleX: number, scaleZ: number) {
  const positions: number[] = [];
  const indices: number[] = [];
  const hasBore = rings[0].innerRadius !== undefined;
  const verticesPerRing = segments * (hasBore ? 2 : 1);
  const outerIndex = (ring: number, point: number) => ring * verticesPerRing + point;
  const innerIndex = (ring: number, point: number) => ring * verticesPerRing + segments + point;

  for (const ring of rings) {
    for (let point = 0; point < segments; point += 1) {
      const angle = point / segments * Math.PI * 2;
      const radius = ring.outerRadius(angle);
      positions.push(Math.cos(angle) * radius * scaleX, ring.y, Math.sin(angle) * radius * scaleZ);
    }
    if (ring.innerRadius) {
      for (let point = 0; point < segments; point += 1) {
        const angle = point / segments * Math.PI * 2;
        const radius = ring.innerRadius(angle);
        positions.push(Math.cos(angle) * radius * scaleX, ring.y, Math.sin(angle) * radius * scaleZ);
      }
    }
  }

  for (let ring = 0; ring < rings.length - 1; ring += 1) {
    for (let point = 0; point < segments; point += 1) {
      const next = (point + 1) % segments;
      const lower = outerIndex(ring, point);
      const lowerNext = outerIndex(ring, next);
      const upper = outerIndex(ring + 1, point);
      const upperNext = outerIndex(ring + 1, next);
      indices.push(lower, upper, upperNext, lower, upperNext, lowerNext);
      if (hasBore) {
        const innerLower = innerIndex(ring, point);
        const innerLowerNext = innerIndex(ring, next);
        const innerUpper = innerIndex(ring + 1, point);
        const innerUpperNext = innerIndex(ring + 1, next);
        indices.push(innerLower, innerLowerNext, innerUpperNext, innerLower, innerUpperNext, innerUpper);
      }
    }
  }

  const topRing = rings.length - 1;
  if (hasBore) {
    for (let point = 0; point < segments; point += 1) {
      const next = (point + 1) % segments;
      indices.push(
        outerIndex(0, point), outerIndex(0, next), innerIndex(0, next),
        outerIndex(0, point), innerIndex(0, next), innerIndex(0, point),
        outerIndex(topRing, point), innerIndex(topRing, point), innerIndex(topRing, next),
        outerIndex(topRing, point), innerIndex(topRing, next), outerIndex(topRing, next),
      );
    }
  } else {
    const bottomCenter = positions.length / 3;
    positions.push(0, rings[0].y, 0);
    const topCenter = positions.length / 3;
    positions.push(0, rings[topRing].y, 0);
    for (let point = 0; point < segments; point += 1) {
      const next = (point + 1) % segments;
      indices.push(
        outerIndex(0, point), outerIndex(0, next), bottomCenter,
        outerIndex(topRing, point), topCenter, outerIndex(topRing, next),
      );
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function ellipseRadius(angle: number, width: number, depth: number) {
  return 1 / Math.hypot(Math.cos(angle) / (width / 2), Math.sin(angle) / (depth / 2));
}

function hexRadius(angle: number, width: number, depth: number) {
  const apothem = Math.cos(Math.PI / 6);
  const radiusX = width / 2;
  const radiusZ = depth / (2 * Math.sin(Math.PI / 3));
  let limit = 0;
  for (let side = 0; side < 6; side += 1) {
    const normal = Math.PI / 6 + side * Math.PI / 3;
    limit = Math.max(
      limit,
      Math.cos(angle) * Math.cos(normal) / radiusX
        + Math.sin(angle) * Math.sin(normal) / radiusZ,
    );
  }
  return apothem / limit;
}

function fitHorizontalBounds(geometry: THREE.BufferGeometry, width: number, depth: number) {
  const bounds = geometry.boundingBox;
  if (!bounds) return geometry;
  geometry.scale(
    width / (bounds.max.x - bounds.min.x),
    1,
    depth / (bounds.max.z - bounds.min.z),
  );
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function createThreadedCylinderGeometry(options: ThreadedCylinderGeometryOptions) {
  const width = normalizeFastenerDiameter(options.width);
  const depth = normalizeFastenerDiameter(options.depth, width);
  const height = Math.max(0.1, finiteOr(options.height, 10));
  const mode = normalizeThreadMode(options.threadMode);
  const diameter = Math.min(width, depth);
  const pitch = normalizeThreadPitch(options.threadPitch, diameter);
  const threadDepth = normalizeThreadDepth(options.threadDepth, diameter, pitch);
  const handedness = normalizeThreadHandedness(options.threadHandedness);
  const quality = normalizeThreadQuality(options.threadQuality);
  const bore = normalizeBoreDiameter(options.boreDiameter, diameter) / 2;
  const safeInternalDepth = Math.max(0, Math.min(threadDepth, diameter / 2 - bore - 0.01));
  const makeRing = (y: number): Ring => ({
    y,
    outerRadius: mode === "external"
      ? (angle) => ellipseRadius(angle, width, depth) - threadDepth * (1 - threadRidge(angle, y, pitch, handedness))
      : (angle) => ellipseRadius(angle, width, depth),
    innerRadius: mode === "internal"
      ? (angle) => bore + safeInternalDepth * threadRidge(angle, y, pitch, handedness)
      : undefined,
  });
  const rings = mode === "none"
    ? [makeRing(0), makeRing(height)]
    : threadedRings(height, pitch, quality, makeRing);
  const geometry = createRingGeometry(rings, radialSegments(quality), 1, 1);
  return mode === "external" ? fitHorizontalBounds(geometry, width, depth) : geometry;
}

export function createScrewGeometry(options: ScrewGeometryOptions) {
  const width = normalizeFastenerDiameter(options.width);
  const depth = normalizeFastenerDiameter(options.depth, width);
  const height = Math.max(0.2, finiteOr(options.height, 12));
  const shaftDiameter = clamp(finiteOr(options.shaftDiameter, Math.min(width, depth) * 0.6), 0.1, Math.min(width, depth) * 0.9);
  const headHeight = clamp(finiteOr(options.headHeight, height * 0.28), 0.1, height * 0.8);
  const shaftHeight = height - headHeight;
  const pitch = normalizeThreadPitch(options.threadPitch, shaftDiameter);
  const threadDepth = normalizeThreadDepth(options.threadDepth, shaftDiameter, pitch);
  const handedness = normalizeThreadHandedness(options.threadHandedness);
  const quality = normalizeThreadQuality(options.threadQuality);
  const root = shaftDiameter / 2 - threadDepth;
  const shaftRings = threadedRings(shaftHeight, pitch, quality, (y) => ({
    y,
    outerRadius: (angle) => root + threadDepth * threadRidge(angle, y, pitch, handedness),
  }));
  const headRadius = (angle: number) => hexRadius(angle, width, depth);
  const rings = [
    ...shaftRings,
    { y: shaftHeight, outerRadius: headRadius },
    { y: height, outerRadius: headRadius },
  ];
  return createRingGeometry(rings, radialSegments(quality), 1, 1);
}

export function createNutGeometry(options: NutGeometryOptions) {
  const width = normalizeFastenerDiameter(options.width);
  const depth = normalizeFastenerDiameter(options.depth, width);
  const height = Math.max(0.1, finiteOr(options.height, 5));
  const diameter = Math.min(width, depth);
  const boreDiameter = normalizeBoreDiameter(options.boreDiameter, diameter);
  const pitch = normalizeThreadPitch(options.threadPitch, boreDiameter);
  const threadDepth = normalizeThreadDepth(options.threadDepth, boreDiameter, pitch);
  const handedness = normalizeThreadHandedness(options.threadHandedness);
  const quality = normalizeThreadQuality(options.threadQuality);
  const bore = boreDiameter / 2;
  const safeThreadDepth = Math.min(threadDepth, diameter * 0.45 - bore);
  const rings = threadedRings(height, pitch, quality, (y) => ({
    y,
    outerRadius: (angle) => hexRadius(angle, width, depth),
    innerRadius: (angle) => bore + safeThreadDepth * threadRidge(angle, y, pitch, handedness),
  }));
  return createRingGeometry(rings, radialSegments(quality), 1, 1);
}

export function createWasherGeometry(options: WasherGeometryOptions) {
  const width = normalizeFastenerDiameter(options.width);
  const depth = normalizeFastenerDiameter(options.depth, width);
  const height = Math.max(0.1, finiteOr(options.height, 1));
  const bore = normalizeBoreDiameter(options.boreDiameter, Math.min(width, depth)) / 2;
  const ring = (y: number): Ring => ({
    y,
    outerRadius: (angle) => ellipseRadius(angle, width, depth),
    innerRadius: () => bore,
  });
  return createRingGeometry([ring(0), ring(height)], radialSegments(options.quality ?? DEFAULT_THREAD_QUALITY), 1, 1);
}
