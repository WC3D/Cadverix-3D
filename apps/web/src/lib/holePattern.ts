// Face-pattern math adapted from henmedia/layerling (AGPL-3.0), f3092321.
import * as THREE from "three";
import type { PlacementWorkplane } from "@/lib/placementWorkplane";
export type HolePatternSettings = { form: "round" | "square" | "rectangle" | "hexagon" | "slot"; size: number; height: number; spacing: number; margin: number; staggered: boolean; depth: number | null };
export const DEFAULT_HOLE_PATTERN: HolePatternSettings = { form: "round", size: 3, height: 3, spacing: 6, margin: 2, staggered: false, depth: null };
export const MAX_PATTERN_HOLES = 256;
type Point = { x: number; y: number };
export type PatternMesh = { vertices: [number, number, number][]; faces: [number, number, number][] };
const cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const inside = (point: Point, polygon: Point[]) => {
  let value = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) value = !value;
  }
  return value;
};
function pointDistance(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
function segmentDistance(a: Point, b: Point, c: Point, d: Point) {
  if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return 0;
  return Math.min(pointDistance(a, c, d), pointDistance(b, c, d), pointDistance(c, a, b), pointDistance(d, a, b));
}
export function holeFootprint(settings: HolePatternSettings): Point[] {
  const { size, height, form } = settings;
  if (![size, height, settings.spacing, settings.margin].every(Number.isFinite) || size < 0.5 || size > 200 || height < 0.5 || height > 200 || settings.margin < 0 || settings.spacing <= 0 || settings.depth !== null && (!Number.isFinite(settings.depth) || settings.depth <= 0 || settings.depth > 1000)) throw new Error("Invalid hole pattern dimensions");
  if (!["round", "square", "rectangle", "hexagon", "slot"].includes(form)) throw new Error("Unknown hole pattern shape");
  const width = size, depth = form === "round" || form === "square" || form === "hexagon" ? size : height;
  if (settings.spacing < Math.max(width, depth) + .4) throw new Error("Spacing must leave at least 0.4 mm between holes");
  if (form === "square" || form === "rectangle") return [{ x: -width / 2, y: -depth / 2 }, { x: width / 2, y: -depth / 2 }, { x: width / 2, y: depth / 2 }, { x: -width / 2, y: depth / 2 }];
  if (form === "slot") {
    const radius = Math.min(width, depth) / 2, alongX = width >= depth, reach = Math.abs(width - depth) / 2;
    return Array.from({ length: 32 }, (_, index) => {
      const angle = index / 32 * Math.PI * 2, cos = Math.cos(angle), sin = Math.sin(angle);
      return alongX ? { x: cos * radius + Math.sign(cos) * reach, y: sin * radius } : { x: cos * radius, y: sin * radius + Math.sign(sin) * reach };
    });
  }
  return Array.from({ length: form === "hexagon" ? 6 : 48 }, (_, index) => { const angle = index / (form === "hexagon" ? 6 : 48) * Math.PI * 2; return { x: Math.cos(angle) * size / 2, y: Math.sin(angle) * size / 2 }; });
}

export function faceHolePattern(mesh: PatternMesh, plane: PlacementWorkplane, settings: HolePatternSettings) {
  if (mesh.faces.length > 100_000) throw new Error("Simplify this mesh below 100,000 triangles before making a hole pattern");
  const footprint = holeFootprint(settings), origin = new THREE.Vector3(plane.origin.x, plane.origin.y, plane.origin.z), normal = new THREE.Vector3(plane.normal.x, plane.normal.y, plane.normal.z).normalize();
  const u = new THREE.Vector3(plane.xAxis.x, plane.xAxis.y, plane.xAxis.z).normalize(), v = new THREE.Vector3(plane.zAxis.x, plane.zAxis.y, plane.zAxis.z).normalize();
  const points = mesh.vertices.map((vertex) => { const relative = new THREE.Vector3(...vertex).sub(origin); return { x: relative.dot(u), y: relative.dot(v), distance: relative.dot(normal) }; });
  const candidates = mesh.faces.filter((face) => face.every((id) => Math.abs(points[id].distance) < 1e-4) && Math.abs(cross(points[face[0]], points[face[1]], points[face[2]])) > 1e-9);
  if (!candidates.length) throw new Error("Pick a flat face, not a curved surface");
  const containsTriangle = (point: Point, face: [number, number, number]) => {
    const values = [cross(points[face[0]], points[face[1]], point), cross(points[face[1]], points[face[2]], point), cross(points[face[2]], points[face[0]], point)];
    return values.every((n) => n >= -1e-7) || values.every((n) => n <= 1e-7);
  };
  const key = (id: number) => { const p = points[id]; return `${Math.round(p.x * 1e5)},${Math.round(p.y * 1e5)}`; };
  const connected = new Map<string, number[]>();
  candidates.forEach((face, index) => face.forEach((id) => { const k = key(id); const entries = connected.get(k) ?? []; entries.push(index); connected.set(k, entries); }));
  const first = candidates.findIndex((face) => containsTriangle({ x: 0, y: 0 }, face));
  if (first < 0) throw new Error("The picked point is not on a supported flat face");
  const picked = candidates[first];
  const a = new THREE.Vector3(...mesh.vertices[picked[0]]), b = new THREE.Vector3(...mesh.vertices[picked[1]]), c = new THREE.Vector3(...mesh.vertices[picked[2]]);
  // Shift can reverse the workplane, but holes must still cut into the picked body.
  if (b.sub(a).cross(c.sub(a)).dot(normal) < 0) {
    normal.negate();
    for (const point of points) point.distance = -point.distance;
  }
  const pending = [first], visited = new Set<number>();
  while (pending.length) { const index = pending.pop()!; if (visited.has(index)) continue; visited.add(index); for (const id of candidates[index]) for (const next of connected.get(key(id)) ?? []) if (!visited.has(next)) pending.push(next); }
  const faces = [...visited].map((index) => candidates[index]);
  const edges = new Map<string, { a: Point; b: Point; uses: number }>();
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const face of faces) for (let index = 0; index < 3; index++) {
    const a = face[index], b = face[(index + 1) % 3], ka = key(a), kb = key(b), edgeKey = ka < kb ? `${ka}:${kb}` : `${kb}:${ka}`;
    const edge = edges.get(edgeKey); if (edge) edge.uses++; else edges.set(edgeKey, { a: points[a], b: points[b], uses: 1 });
    minX = Math.min(minX, points[a].x); maxX = Math.max(maxX, points[a].x); minY = Math.min(minY, points[a].y); maxY = Math.max(maxY, points[a].y);
  }
  const boundary = [...edges.values()].filter((edge) => edge.uses === 1);
  const pitchY = settings.spacing * (settings.staggered ? Math.sqrt(3) / 2 : 1), columns = Math.floor((maxX - minX) / settings.spacing) + 1, rows = Math.floor((maxY - minY) / pitchY) + 1;
  if (columns * rows > 60000) throw new Error("Pattern is too dense; increase spacing");
  // shortcut: bound synchronous face tests; move them to a worker for denser imported faces.
  if (columns * rows * faces.length * footprint.length * 4 > 25_000_000) throw new Error("This face is too detailed for an interactive pattern; simplify the mesh or increase spacing");
  let centers: Point[] = [];
  for (const offsetX of [0, settings.spacing / 2]) for (const offsetY of [0, pitchY / 2]) {
    const found: Point[] = [];
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const center = { x: (minX + maxX) / 2 + (column - (columns - 1) / 2) * settings.spacing + (settings.staggered && row % 2 ? settings.spacing / 2 : 0) + offsetX, y: (minY + maxY) / 2 + (row - (rows - 1) / 2) * pitchY + offsetY };
    const placed = footprint.map((point) => ({ x: point.x + center.x, y: point.y + center.y }));
    if (!faces.some((face) => containsTriangle(center, face)) || !placed.every((point) => faces.some((face) => containsTriangle(point, face)))) continue;
    if (boundary.some((edge) => inside(edge.a, placed) || placed.some((point, index) => segmentDistance(point, placed[(index + 1) % placed.length], edge.a, edge.b) < Math.max(1e-9, settings.margin - 1e-7)))) continue;
    found.push(center);
    if (found.length > MAX_PATTERN_HOLES) throw new Error(`Pattern exceeds ${MAX_PATTERN_HOLES} holes; increase spacing`);
    }
    if (found.length > centers.length) centers = found;
  }
  if (!centers.length) throw new Error("No holes fit this face with the chosen size, spacing and margin");
  let reach = 0;
  for (const point of points) reach = Math.min(reach, point.distance);
  const depth = settings.depth ?? Math.max(.1, -reach + .2);
  const cutters = centers.map((center): PatternMesh => {
    const vertices = [.1, -depth].flatMap((distance) => footprint.map((point): [number, number, number] => origin.clone().addScaledVector(u, point.x + center.x).addScaledVector(v, point.y + center.y).addScaledVector(normal, distance).toArray() as [number, number, number]));
    const count = footprint.length, triangles: [number, number, number][] = [];
    for (let i = 1; i + 1 < count; i++) { triangles.push([0, i + 1, i], [count, count + i, count + i + 1]); }
    for (let i = 0; i < count; i++) { const next = (i + 1) % count; triangles.push([i, next, next + count], [i, next + count, i + count]); }
    // The workplane's x/z frame is left-handed about its normal; keep cutter winding outward.
    if (u.clone().cross(v).dot(normal) > 0) for (const face of triangles) [face[1], face[2]] = [face[2], face[1]];
    return { vertices, faces: triangles };
  });
  return { centers, cutters };
}
