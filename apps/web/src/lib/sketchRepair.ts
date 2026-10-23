import type { SketchPoint, SketchProfile } from "@/types/sketchforge";

export const SKETCH_REPAIR_GAP_LIMIT = 0.5;

export function inspectSketchEndpoints(profile: SketchProfile) {
  const points = new Map(profile.points.filter((point) => !point.projectionId && Number.isFinite(point.x) && Number.isFinite(point.z)).map((point) => [point.id, point]));
  const incident = new Map<string, string[]>();
  for (const segment of profile.segments) {
    if (segment.projectionId || segment.startId === segment.endId || !points.has(segment.startId) || !points.has(segment.endId)) continue;
    for (const id of [segment.startId, segment.endId]) {
      const segments = incident.get(id) ?? [];
      segments.push(segment.id);
      incident.set(id, segments);
    }
  }
  const endpoints = [...points.values()].filter((point) => incident.get(point.id)?.length === 1).sort((a, b) => a.x - b.x || a.z - b.z);
  const gaps: Array<{ start: SketchPoint; end: SketchPoint; distance: number }> = [];
  for (let i = 0; i < endpoints.length; i++) {
    const start = endpoints[i];
    for (let j = i + 1; j < endpoints.length; j++) {
      const end = endpoints[j];
      if (end.x - start.x > SKETCH_REPAIR_GAP_LIMIT) break;
      if (incident.get(start.id)![0] === incident.get(end.id)![0]) continue;
      const distance = Math.hypot(end.x - start.x, end.z - start.z);
      if (distance <= SKETCH_REPAIR_GAP_LIMIT) gaps.push({ start, end, distance });
    }
  }
  return { endpoints, gaps: gaps.sort((a, b) => a.distance - b.distance) };
}
