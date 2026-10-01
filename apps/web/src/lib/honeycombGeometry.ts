import * as THREE from "three";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export const DEFAULT_HONEYCOMB_WIDTH = 60;
export const DEFAULT_HONEYCOMB_DEPTH = 60;
export const DEFAULT_HONEYCOMB_HEIGHT = 3;
export const DEFAULT_HONEYCOMB_CELL_SIZE = 8;
export const DEFAULT_HONEYCOMB_WALL_THICKNESS = 1.6;
export const DEFAULT_HONEYCOMB_FRAME_WIDTH = 3;

export function normalizeHoneycombCellSize(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_HONEYCOMB_CELL_SIZE;
  return Math.max(2, Math.min(100, Math.round(value * 10) / 10));
}

export function normalizeHoneycombWallThickness(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_HONEYCOMB_WALL_THICKNESS;
  return Math.max(0.4, Math.min(50, Math.round(value * 10) / 10));
}

export function normalizeHoneycombFrameWidth(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_HONEYCOMB_FRAME_WIDTH;
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}

export type HoneycombGeometryOptions = {
  width?: number;
  depth?: number;
  height?: number;
  honeycombCellSize?: number;
  honeycombWallThickness?: number;
  honeycombFrameWidth?: number;
};

export function buildHoneycombHoles(
  width: number,
  depth: number,
  cellSize: number,
  wallThickness: number,
  frameWidth: number,
): THREE.Vector2[][] {
  const size = Math.max(1, cellSize);
  const thickness = Math.max(0.2, wallThickness);
  const maxFrame = Math.max(0, Math.min(width, depth) / 2 - 0.5);
  const frame = Math.min(Math.max(0, frameWidth), maxFrame);
  const effectiveFrame = Math.max(0.1, frame);
  const innerMinX = -width / 2 + effectiveFrame;
  const innerMaxX = width / 2 - effectiveFrame;
  const innerMinZ = -depth / 2 + effectiveFrame;
  const innerMaxZ = depth / 2 - effectiveFrame;
  if (innerMaxX <= innerMinX || innerMaxZ <= innerMinZ) return [];

  const spacing = size + thickness;
  const rowX = 0.5 * spacing;
  const rowZ = (Math.sqrt(3) / 2) * spacing;
  const radius = size / Math.sqrt(3);
  const maxI = Math.ceil(width / spacing) + 2;
  const maxJ = Math.ceil(depth / rowZ) + 2;
  const roundCoord = (value: number) => Math.round(value * 1e5) / 1e5;
  const holes: THREE.Vector2[][] = [];

  for (let j = -maxJ; j <= maxJ; j += 1) {
    for (let i = -maxI; i <= maxI; i += 1) {
      const cx = i * spacing + j * rowX;
      const cz = j * rowZ;
      const fullVerts: THREE.Vector2[] = [];
      let fullFits = true;
      for (let k = 0; k < 6; k += 1) {
        const angle = Math.PI / 6 + k * Math.PI / 3;
        const vx = roundCoord(cx + radius * Math.cos(angle));
        const vz = roundCoord(cz + radius * Math.sin(angle));
        if (vx < innerMinX || vx > innerMaxX || vz < innerMinZ || vz > innerMaxZ) {
          fullFits = false;
          break;
        }
        fullVerts.push(new THREE.Vector2(vx, vz));
      }

      if (fullFits) {
        holes.push(fullVerts);
      } else if (
        cz - radius >= innerMinZ && cz + radius <= innerMaxZ
        && cx - size / 2 >= innerMinX && cx <= innerMaxX
      ) {
        holes.push([
          new THREE.Vector2(roundCoord(cx), roundCoord(cz + radius)),
          new THREE.Vector2(roundCoord(cx - size / 2), roundCoord(cz + radius / 2)),
          new THREE.Vector2(roundCoord(cx - size / 2), roundCoord(cz - radius / 2)),
          new THREE.Vector2(roundCoord(cx), roundCoord(cz - radius)),
        ]);
      } else if (
        cz - radius >= innerMinZ && cz + radius <= innerMaxZ
        && cx >= innerMinX && cx + size / 2 <= innerMaxX
      ) {
        holes.push([
          new THREE.Vector2(roundCoord(cx), roundCoord(cz - radius)),
          new THREE.Vector2(roundCoord(cx + size / 2), roundCoord(cz - radius / 2)),
          new THREE.Vector2(roundCoord(cx + size / 2), roundCoord(cz + radius / 2)),
          new THREE.Vector2(roundCoord(cx), roundCoord(cz + radius)),
        ]);
      }
    }
  }

  return holes.map((points) => {
    if (!THREE.ShapeUtils.isClockWise(points)) points.reverse();
    return points;
  });
}

export function createHoneycombGeometry(options: HoneycombGeometryOptions = {}): THREE.BufferGeometry {
  const width = Math.max(0.001, options.width ?? DEFAULT_HONEYCOMB_WIDTH);
  const depth = Math.max(0.001, options.depth ?? DEFAULT_HONEYCOMB_DEPTH);
  const height = Math.max(0.001, options.height ?? DEFAULT_HONEYCOMB_HEIGHT);
  const cellSize = normalizeHoneycombCellSize(options.honeycombCellSize);
  const wallThickness = normalizeHoneycombWallThickness(options.honeycombWallThickness);
  const frameWidth = normalizeHoneycombFrameWidth(options.honeycombFrameWidth);
  const roundCoord = (value: number) => Math.round(value * 1e5) / 1e5;
  const holes = buildHoneycombHoles(width, depth, cellSize, wallThickness, frameWidth);
  const outer = [
    new THREE.Vector2(roundCoord(-width / 2), roundCoord(-depth / 2)),
    new THREE.Vector2(roundCoord(width / 2), roundCoord(-depth / 2)),
    new THREE.Vector2(roundCoord(width / 2), roundCoord(depth / 2)),
    new THREE.Vector2(roundCoord(-width / 2), roundCoord(depth / 2)),
  ];
  const allPoints = [...outer];
  const holeOffsets: { start: number; count: number }[] = [];
  for (const hole of holes) {
    holeOffsets.push({ start: allPoints.length, count: hole.length });
    allPoints.push(...hole);
  }

  const pointCount = allPoints.length;
  const positions: number[] = [];
  const indices: number[] = [];
  for (const point of allPoints) positions.push(point.x, 0, point.y);
  for (const point of allPoints) positions.push(point.x, height, point.y);

  const faces = THREE.ShapeUtils.triangulateShape(outer, holes).filter(([a, b, c]) => {
    const pa = allPoints[a];
    const pb = allPoints[b];
    const pc = allPoints[c];
    return Math.abs((pb.x - pa.x) * (pc.y - pa.y) - (pb.y - pa.y) * (pc.x - pa.x)) > 1e-7;
  });
  for (const [a, b, c] of faces) {
    indices.push(pointCount + a, pointCount + c, pointCount + b, a, b, c);
  }
  for (let i = 0; i < outer.length; i += 1) {
    const next = (i + 1) % outer.length;
    indices.push(i, pointCount + next, next, i, pointCount + i, pointCount + next);
  }
  for (const { start, count } of holeOffsets) {
    for (let i = 0; i < count; i += 1) {
      const next = (i + 1) % count;
      const bottom = start + i;
      const bottomNext = start + next;
      const top = pointCount + start + i;
      const topNext = pointCount + start + next;
      indices.push(bottom, topNext, bottomNext, bottom, top, topNext);
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
