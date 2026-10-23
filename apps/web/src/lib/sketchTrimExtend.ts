import { pruneSketchParameters } from "@/lib/sketchConstraints";
import { addLineIntersectionPoints, closestPointOnSketchSegment } from "@/lib/sketchPointRefinement";
import type { SketchProfile, SketchSegment } from "@/types/sketchforge";

const EPSILON = 1e-7;
const isLine = (segment: SketchSegment) => !segment.kind || segment.kind === "line";

export function trimExtendSketchLine(
  profile: SketchProfile,
  segmentId: string,
  click: { x: number; z: number },
  mode: "trim" | "extend",
  createId: (prefix: string) => string,
): SketchProfile {
  const segment = profile.segments.find((entry) => entry.id === segmentId);
  if (!segment || !isLine(segment)) throw new Error("Trim/Extend currently supports straight lines only");
  if (segment.projectionId) throw new Error("Unlink projected geometry before editing it");
  const start = profile.points.find((point) => point.id === segment.startId);
  const end = profile.points.find((point) => point.id === segment.endId);
  if (!start || !end) throw new Error("Line endpoints are missing");
  if (![start.x, start.z, end.x, end.z, click.x, click.z].every(Number.isFinite)) throw new Error("Invalid line coordinates");
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  if (Math.hypot(dx, dz) <= EPSILON) throw new Error("Cannot edit a zero-length line");
  const amount = closestPointOnSketchSegment(segment, start, end, click).amount;
  const intersections: number[] = [];
  // shortcut: straight-line boundaries only; add curve intersections with curve Trim/Extend.
  for (const boundary of profile.segments) {
    if (boundary.id === segmentId || !isLine(boundary)) continue;
    const a = profile.points.find((point) => point.id === boundary.startId);
    const b = profile.points.find((point) => point.id === boundary.endId);
    if (!a || !b) continue;
    const sx = b.x - a.x;
    const sz = b.z - a.z;
    const denominator = dx * sz - dz * sx;
    if (Math.abs(denominator) <= EPSILON * Math.hypot(dx, dz) * Math.hypot(sx, sz)) continue;
    const t = ((a.x - start.x) * sz - (a.z - start.z) * sx) / denominator;
    const u = ((a.x - start.x) * dz - (a.z - start.z) * dx) / denominator;
    if (Number.isFinite(t) && u >= -EPSILON && u <= 1 + EPSILON) intersections.push(t);
  }

  let intervals: number[][];
  if (mode === "trim") {
    const cuts = [0, ...intersections.filter((t) => t > EPSILON && t < 1 - EPSILON), 1].sort((a, b) => a - b);
    const unique = cuts.filter((t, index) => index === 0 || t - cuts[index - 1] > EPSILON);
    const index = unique.findIndex((t, i) => i < unique.length - 1 && amount <= unique[i + 1] + EPSILON);
    const lower = unique[Math.max(0, index)];
    const upper = unique[Math.max(0, index) + 1];
    intervals = [[0, lower], [upper, 1]].filter(([a, b]) => b - a > EPSILON);
  } else {
    const extendStart = amount < 0.5;
    const endpoint = extendStart ? start : end;
    if (profile.constraints?.some((constraint) => constraint.kind === "fixed" && constraint.pointId === endpoint.id)) {
      throw new Error("Release the fixed endpoint before extending it");
    }
    const candidates = intersections.filter((t) => extendStart ? t < -EPSILON : t > 1 + EPSILON);
    if (!candidates.length) throw new Error("No straight-line boundary beyond this endpoint");
    const target = extendStart ? Math.max(...candidates) : Math.min(...candidates);
    intervals = [extendStart ? [target, 1] : [0, target]];
  }

  const points = [...profile.points];
  const pointAt = (t: number) => {
    if (t === 0) return start.id;
    if (t === 1) return end.id;
    const position = { x: start.x + dx * t, z: start.z + dz * t };
    const existing = points.find((point) => !point.projectionId && Math.hypot(point.x - position.x, point.z - position.z) <= EPSILON);
    if (existing) return existing.id;
    const id = createId("sketch-point");
    points.push({ id, ...position, mode: "corner" });
    return id;
  };
  const replacements = intervals.map(([a, b]) => ({ ...segment, id: createId("sketch-segment"), startId: pointAt(a), endId: pointAt(b) }));
  const constraints = (profile.constraints ?? []).flatMap((constraint) => constraint.kind !== "fixed" && constraint.segmentId === segmentId
    ? replacements.map((replacement) => ({ ...constraint, id: createId("sketch-constraint"), segmentId: replacement.id }))
    : [constraint]);
  const segments = profile.segments.flatMap((entry) => entry.id === segmentId ? replacements : [entry]);
  const used = new Set(segments.flatMap((entry) => [entry.startId, entry.endId]));
  const next = addLineIntersectionPoints({
    ...profile,
    points: points.filter((point) => used.has(point.id) || point.id !== start.id && point.id !== end.id
      || constraints.some((constraint) => constraint.kind === "fixed" && constraint.pointId === point.id)),
    segments,
    constraints,
  }, createId);
  // A driving length on a newly split boundary must not pull the intersection away again.
  const changed = new Set(segments.filter((entry) => {
    const result = next.segments.find((candidate) => candidate.id === entry.id);
    return result && (entry.startId !== result.startId || entry.endId !== result.endId);
  }).map((entry) => entry.id));
  return pruneSketchParameters({ ...next, dimensions: next.dimensions?.filter((dimension) => dimension.kind !== "length" || !changed.has(dimension.segmentId)) });
}
