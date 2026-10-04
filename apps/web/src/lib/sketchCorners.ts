import { createLocalId } from "@/lib/localIds";
import type { SketchPoint, SketchProfile, SketchSegment } from "@/types/sketchforge";

export function treatSketchCorner(profile: SketchProfile, pointId: string, kind: "fillet" | "chamfer", amount: number): SketchProfile {
  const corner = profile.points.find((point) => point.id === pointId);
  const edges = profile.segments.filter((segment) => segment.startId === pointId || segment.endId === pointId);
  if (!corner || corner.projectionId || edges.length !== 2 || edges.some((edge) => edge.projectionId || (edge.kind && edge.kind !== "line"))) throw new Error("Choose an unlinked corner joining exactly two straight segments");
  const affected = new Set(edges.map((edge) => edge.id));
  if (profile.constraints?.some((c) => c.kind === "fixed" ? c.pointId === pointId : affected.has(c.segmentId)) || profile.dimensions?.some((d) => d.kind === "length" && affected.has(d.segmentId))) throw new Error("Remove constraints and driving lengths from this corner before treating it");
  if (profile.dimensions?.some((d) => d.kind === "distance" && [d.start, d.end].some((a) => a.kind === "point" ? a.pointId === pointId : a.kind === "midpoint" ? affected.has(a.segmentId) : affected.has(a.firstSegmentId) || affected.has(a.secondSegmentId)))) throw new Error("Remove measurements attached to this corner before treating it");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a positive radius or chamfer distance");
  const ends = edges.map((edge) => profile.points.find((point) => point.id === (edge.startId === pointId ? edge.endId : edge.startId))!);
  const lengths = ends.map((p) => Math.hypot(p.x - corner.x, p.z - corner.z));
  if (lengths.some((n) => n < 1e-6)) throw new Error("Corner has a zero-length segment");
  const directions = ends.map((p, i) => ({ x: (p.x - corner.x) / lengths[i], z: (p.z - corner.z) / lengths[i] }));
  const theta = Math.acos(Math.max(-1, Math.min(1, directions[0].x * directions[1].x + directions[0].z * directions[1].z)));
  if (theta < 0.001 || Math.PI - theta < 0.001) throw new Error("Choose a non-collinear corner");
  const distance = kind === "fillet" ? amount / Math.tan(theta / 2) : amount;
  if (lengths.some((length) => distance >= length - 1e-6)) throw new Error("Radius or chamfer distance is too large for the adjoining segments");
  const points: SketchPoint[] = directions.map((direction) => ({ id: createLocalId("corner-point"), x: corner.x + direction.x * distance, z: corner.z + direction.z * distance, mode: "corner" }));
  if (kind === "fillet") {
    const control = 4 / 3 * Math.tan((Math.PI - theta) / 4) * amount;
    points[0].handleOut = { x: points[0].x - directions[0].x * control, z: points[0].z - directions[0].z * control };
    points[1].handleIn = { x: points[1].x - directions[1].x * control, z: points[1].z - directions[1].z * control };
  }
  const bridge: SketchSegment = { id: createLocalId("corner-segment"), startId: points[0].id, endId: points[1].id, kind: kind === "fillet" ? "bezier" : "line" };
  return { ...profile, points: [...profile.points.filter((point) => point.id !== pointId), ...points], segments: [...profile.segments.map((edge) => {
    const index = edges.findIndex((candidate) => candidate.id === edge.id);
    return index < 0 ? edge : { ...edge, startId: edge.startId === pointId ? points[index].id : edge.startId, endId: edge.endId === pointId ? points[index].id : edge.endId };
  }), bridge] };
}
