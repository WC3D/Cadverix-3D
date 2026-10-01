import * as THREE from "three";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { BentTubeSegment } from "@/types/sketchforge";

export const DEFAULT_BENT_TUBE_SEGMENTS: BentTubeSegment[] = [
  { length: 25, bendAngle: 90, bendRadius: 15, roll: 0 },
  { length: 25, bendAngle: 0, bendRadius: 15, roll: 0 },
];

export type BentTubeGeometryOptions = {
  width: number;
  depth: number;
  height: number;
  bentTubeSize?: number;
  bentTubeWall?: number;
  bentTubeQuality?: number;
  bentTubeSegments?: BentTubeSegment[];
};

type Station = { point: THREE.Vector3; tangent: THREE.Vector3; u: THREE.Vector3; v: THREE.Vector3 };

export function normalizeBentTubeSegments(value: unknown, size = 10): BentTubeSegment[] {
  const minimumRadius = Math.max(0.6, size / 2 + 0.1);
  const source = Array.isArray(value) && value.length ? value : DEFAULT_BENT_TUBE_SEGMENTS;
  return source.slice(0, 12).map((entry) => {
    const segment = entry && typeof entry === "object" ? entry as Partial<BentTubeSegment> : {};
    return {
      length: Math.max(0, Math.min(1000, Number.isFinite(segment.length) ? segment.length! : 20)),
      bendAngle: Math.max(-180, Math.min(180, Number.isFinite(segment.bendAngle) ? segment.bendAngle! : 0)),
      bendRadius: Math.max(minimumRadius, Math.min(1000, Number.isFinite(segment.bendRadius) ? segment.bendRadius! : 15)),
      roll: Math.max(-180, Math.min(180, Number.isFinite(segment.roll) ? segment.roll! : 0)),
    };
  });
}

function stationsFor(options: BentTubeGeometryOptions, quality: number): Station[] {
  const segments = normalizeBentTubeSegments(options.bentTubeSegments, options.bentTubeSize);
  let point = new THREE.Vector3();
  let tangent = new THREE.Vector3(1, 0, 0);
  let bendDirection = new THREE.Vector3(0, 0, -1);
  let u = new THREE.Vector3(0, 0, -1);
  let v = new THREE.Vector3(0, 1, 0);
  const stations: Station[] = [{ point: point.clone(), tangent: tangent.clone(), u: u.clone(), v: v.clone() }];
  segments.forEach((segment) => {
    bendDirection.applyAxisAngle(tangent, THREE.MathUtils.degToRad(segment.roll)).normalize();
    if (segment.length > 0) {
      point = point.clone().addScaledVector(tangent, segment.length);
      stations.push({ point: point.clone(), tangent: tangent.clone(), u: u.clone(), v: v.clone() });
    }
    if (Math.abs(segment.bendAngle) > 0.001) {
      const toward = bendDirection.clone().multiplyScalar(Math.sign(segment.bendAngle));
      const axis = tangent.clone().cross(toward).normalize();
      const center = point.clone().addScaledVector(toward, segment.bendRadius);
      const radians = THREE.MathUtils.degToRad(Math.abs(segment.bendAngle));
      const steps = Math.max(1, Math.ceil(Math.abs(segment.bendAngle) * quality / 240));
      const startPoint = point.clone();
      const startTangent = tangent.clone();
      const startU = u.clone();
      const startV = v.clone();
      for (let step = 1; step <= steps; step += 1) {
        const angle = radians * step / steps;
        point = startPoint.clone().sub(center).applyAxisAngle(axis, angle).add(center);
        tangent = startTangent.clone().applyAxisAngle(axis, angle).normalize();
        u = startU.clone().applyAxisAngle(axis, angle).normalize();
        v = startV.clone().applyAxisAngle(axis, angle).normalize();
        stations.push({ point: point.clone(), tangent: tangent.clone(), u: u.clone(), v: v.clone() });
      }
      bendDirection.applyAxisAngle(axis, radians).normalize();
    }
  });
  return stations;
}

export function createBentTubeGeometry(options: BentTubeGeometryOptions): THREE.BufferGeometry {
  const quality = Math.max(12, Math.min(96, Math.round((options.bentTubeQuality ?? 32) / 4) * 4));
  const size = Math.max(1, options.bentTubeSize ?? 10);
  const wall = Math.max(0.2, Math.min(size / 2 - 0.1, options.bentTubeWall ?? 1.5));
  const stations = stationsFor(options, quality);
  const sides = quality;
  const outerRadius = size / 2;
  const innerRadius = outerRadius - wall;
  const positions: number[] = [];
  const indices: number[] = [];
  const placeRing = (station: Station, radius: number) => {
    for (let side = 0; side < sides; side += 1) {
      const angle = side / sides * Math.PI * 2;
      const p = station.point.clone().addScaledVector(station.u, Math.cos(angle) * radius).addScaledVector(station.v, Math.sin(angle) * radius);
      positions.push(p.x, p.y, p.z);
    }
  };
  stations.forEach((station) => placeRing(station, outerRadius));
  const innerOffset = stations.length * sides;
  stations.forEach((station) => placeRing(station, innerRadius));
  for (let station = 0; station < stations.length - 1; station += 1) {
    for (let side = 0; side < sides; side += 1) {
      const next = (side + 1) % sides;
      const a = station * sides + side;
      const b = station * sides + next;
      const c = (station + 1) * sides + next;
      const d = (station + 1) * sides + side;
      indices.push(a, b, c, a, c, d);
      indices.push(innerOffset + a, innerOffset + c, innerOffset + b, innerOffset + a, innerOffset + d, innerOffset + c);
    }
  }
  const last = (stations.length - 1) * sides;
  for (let side = 0; side < sides; side += 1) {
    const next = (side + 1) % sides;
    indices.push(side, innerOffset + next, next, side, innerOffset + side, innerOffset + next);
    indices.push(last + side, last + next, innerOffset + last + next, last + side, innerOffset + last + next, innerOffset + last + side);
  }
  const indexed = new THREE.BufferGeometry();
  indexed.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  indexed.setIndex(indices);
  indexed.computeBoundingBox();
  const bounds = indexed.boundingBox!;
  const natural = bounds.getSize(new THREE.Vector3());
  indexed.translate(-(bounds.min.x + bounds.max.x) / 2, -bounds.min.y, -(bounds.min.z + bounds.max.z) / 2);
  indexed.scale(options.width / Math.max(0.001, natural.x), options.height / Math.max(0.001, natural.y), options.depth / Math.max(0.001, natural.z));
  const geometry = toCreasedNormals(indexed, THREE.MathUtils.degToRad(35));
  indexed.dispose();
  return geometry;
}
