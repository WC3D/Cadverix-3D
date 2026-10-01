import * as THREE from "three";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export const DEFAULT_SPRING_TURNS = 6;
export const DEFAULT_SPRING_WIRE = 3;
export const DEFAULT_SPRING_QUALITY = 36;
export const MIN_SPRING_TURNS = 1;
export const MAX_SPRING_TURNS = 60;
export const MIN_SPRING_WIRE = 0.3;
export const MIN_SPRING_QUALITY = 12;
export const MAX_SPRING_QUALITY = 96;
const MIN_PITCH_FACTOR = 1.05;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function finite(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? value as number : fallback;
}

export type SpringShapeFields = {
  springTurns?: number;
  springWire?: number;
  springQuality?: number;
};

export type SpringSettings = {
  turns: number;
  wire: number;
  quality: number;
};

export function springWireLimits(diameter: number, height: number) {
  const across = Math.max(0.2, Math.min(diameter, height));
  return { min: MIN_SPRING_WIRE, max: Math.max(MIN_SPRING_WIRE, across * 0.4) };
}

export function normalizeSpringWire(value: number | undefined, diameter: number, height: number) {
  const limits = springWireLimits(diameter, height);
  return clamp(finite(value, DEFAULT_SPRING_WIRE), limits.min, limits.max);
}

export function springTurnLimits(diameter: number, height: number, wire?: number) {
  const thickness = normalizeSpringWire(wire, diameter, height);
  const usable = Math.max(0, height - thickness);
  const fit = Math.floor(usable / (thickness * MIN_PITCH_FACTOR));
  return { min: MIN_SPRING_TURNS, max: clamp(fit, MIN_SPRING_TURNS, MAX_SPRING_TURNS) };
}

export function normalizeSpringTurns(value: number | undefined, diameter: number, height: number, wire?: number) {
  const limits = springTurnLimits(diameter, height, wire);
  return clamp(Math.round(finite(value, DEFAULT_SPRING_TURNS)), limits.min, limits.max);
}

export function normalizeSpringQuality(value?: number) {
  const rounded = Math.round(clamp(finite(value, DEFAULT_SPRING_QUALITY), MIN_SPRING_QUALITY, MAX_SPRING_QUALITY) / 4) * 4;
  return clamp(rounded, MIN_SPRING_QUALITY, MAX_SPRING_QUALITY);
}

export function springSettings(shape: SpringShapeFields, diameter: number, height: number): SpringSettings {
  const wire = normalizeSpringWire(shape.springWire, diameter, height);
  return {
    wire,
    turns: normalizeSpringTurns(shape.springTurns, diameter, height, wire),
    quality: normalizeSpringQuality(shape.springQuality),
  };
}

export type SpringGeometryOptions = SpringShapeFields & {
  width: number;
  depth: number;
  height: number;
};

type Builder = { positions: number[]; indices: number[] };

function triangle(builder: Builder, a: number, b: number, c: number) {
  if (a !== b && b !== c && a !== c) builder.indices.push(a, b, c);
}

export function createSpringGeometry(options: SpringGeometryOptions) {
  const width = Math.max(0.2, options.width);
  const depth = Math.max(0.2, options.depth);
  const height = Math.max(0.2, options.height);
  const diameter = Math.max(width, depth);
  const settings = springSettings(options, diameter, height);
  const wireRadius = settings.wire / 2;
  const coilRadius = Math.max(0.05, diameter / 2 - wireRadius);
  const stations = Math.max(8, Math.round(settings.quality)) * settings.turns;
  const ringSegments = clamp(Math.round(settings.quality / 3) * 2, 8, 24);
  const twist = Math.PI * 2 * settings.turns;
  const reach = coilRadius * twist;
  let span = Math.max(0.01, height - settings.wire);
  for (let pass = 0; pass < 4; pass += 1) {
    const horizontalShare = reach / Math.hypot(reach, span);
    span = Math.max(0.01, height - settings.wire * horizontalShare);
  }
  const bottom = (height - span) / 2;
  const builder: Builder = { positions: [], indices: [] };
  const rings: number[][] = [];
  const centres: number[] = [];

  for (let station = 0; station <= stations; station += 1) {
    const progress = station / stations;
    const angle = twist * progress;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const centreX = cos * coilRadius;
    const centreY = bottom + span * progress;
    const centreZ = sin * coilRadius;
    const tangentX = -sin * coilRadius * twist;
    const tangentY = span;
    const tangentZ = cos * coilRadius * twist;
    const tangentLength = Math.hypot(tangentX, tangentY, tangentZ) || 1;
    const tx = tangentX / tangentLength;
    const ty = tangentY / tangentLength;
    const tz = tangentZ / tangentLength;
    let ax = tz;
    const ay = 0;
    let az = -tx;
    const aLength = Math.hypot(ax, ay, az) || 1;
    ax /= aLength;
    az /= aLength;
    const bx = ty * az - tz * ay;
    const by = tz * ax - tx * az;
    const bz = tx * ay - ty * ax;
    const ring: number[] = [];
    for (let segment = 0; segment < ringSegments; segment += 1) {
      const around = (segment / ringSegments) * Math.PI * 2;
      const c = Math.cos(around) * wireRadius;
      const s = Math.sin(around) * wireRadius;
      const index = builder.positions.length / 3;
      builder.positions.push(
        centreX + ax * c + bx * s,
        centreY + ay * c + by * s,
        centreZ + az * c + bz * s,
      );
      ring.push(index);
    }
    rings.push(ring);
    centres.push(builder.positions.length / 3);
    builder.positions.push(centreX, centreY, centreZ);
  }

  for (let station = 0; station < stations; station += 1) {
    const here = rings[station];
    const next = rings[station + 1];
    for (let segment = 0; segment < ringSegments; segment += 1) {
      const after = (segment + 1) % ringSegments;
      triangle(builder, here[segment], here[after], next[after]);
      triangle(builder, here[segment], next[after], next[segment]);
    }
  }

  const first = rings[0];
  const last = rings[rings.length - 1];
  for (let segment = 0; segment < ringSegments; segment += 1) {
    const after = (segment + 1) % ringSegments;
    triangle(builder, centres[0], first[after], first[segment]);
    triangle(builder, centres[centres.length - 1], last[segment], last[after]);
  }

  const scaleX = width / diameter;
  const scaleZ = depth / diameter;
  if (scaleX !== 1 || scaleZ !== 1) {
    for (let offset = 0; offset < builder.positions.length; offset += 3) {
      builder.positions[offset] *= scaleX;
      builder.positions[offset + 2] *= scaleZ;
    }
  }

  const indexed = new THREE.BufferGeometry();
  indexed.setAttribute("position", new THREE.Float32BufferAttribute(builder.positions, 3));
  indexed.setIndex(builder.indices);
  const geometry = toCreasedNormals(indexed, THREE.MathUtils.degToRad(35));
  indexed.dispose();
  geometry.computeBoundingBox();
  return geometry;
}
