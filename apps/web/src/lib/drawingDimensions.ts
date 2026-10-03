import { drawingEntityPoints, drawingMeasurement, drawingValue, type DrawingAnchor, type DrawingDimension, type DrawingPoint, type DrawingPoint3, type DrawingSheet } from "@/lib/drawingSheet";
import { projectDrawingPoint, type DrawingProjection } from "@/lib/drawingProjection";

export type DrawingViewResult = { projection?: DrawingProjection; fingerprint: string; error?: string };
export type DrawingViewResults = ReadonlyMap<string, DrawingViewResult>;

export function resolveDrawingAnchor(sheet: DrawingSheet, anchor: DrawingAnchor, results: DrawingViewResults) {
  if (anchor.type === "entity") {
    const entity = sheet.entities.find((item) => item.id === anchor.entityId);
    const paper = entity ? drawingEntityPoints(entity)[anchor.index] : undefined;
    return paper ? { paper, projected: paper, model: [...paper, 0] as DrawingPoint3 } : null;
  }
  const view = sheet.views.find((item) => item.id === anchor.viewId);
  const projection = results.get(anchor.viewId)?.projection;
  if (!view || !projection) return null;
  const projected = projectDrawingPoint(anchor.point, view.rotation, projection.center);
  return { paper: [view.x + projected[0] * view.scale, view.y + projected[1] * view.scale] as DrawingPoint, projected, model: anchor.point };
}

export function drawingDimensionIsStale(dimension: DrawingDimension, results: DrawingViewResults) {
  const first = dimension.anchors[0];
  return first?.type === "view" && results.get(first.viewId)?.fingerprint !== dimension.sourceFingerprint;
}

export function drawingDimensionGeometry(sheet: DrawingSheet, dimension: DrawingDimension, results: DrawingViewResults) {
  if (drawingDimensionIsStale(dimension, results)) return null;
  const resolved = dimension.anchors.map((anchor) => resolveDrawingAnchor(sheet, anchor, results));
  if (resolved.some((anchor) => !anchor)) return null;
  const anchors = resolved.filter((anchor): anchor is NonNullable<typeof anchor> => Boolean(anchor));
  const values = anchors.map((anchor) => dimension.kind === "horizontal" || dimension.kind === "vertical" ? [...anchor.projected, 0] as DrawingPoint3 : anchor.model);
  const value = drawingMeasurement(dimension.kind, values);
  if (value === null || value < 1e-8) return null;
  const label = drawingValue(value, dimension.kind, sheet.units);
  const a = anchors[0]!.paper, b = anchors[1]!.paper;
  const guides: [DrawingPoint, DrawingPoint][] = [];
  let line: [DrawingPoint, DrawingPoint] | null = null;
  let arc: string | undefined;
  let text: DrawingPoint;
  if (dimension.kind === "angle") {
    const c = anchors[2]!.paper;
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-8 || Math.hypot(c[0] - b[0], c[1] - b[1]) < 1e-8) return null;
    const first = Math.atan2(a[1] - b[1], a[0] - b[0]);
    let delta = Math.atan2(c[1] - b[1], c[0] - b[0]) - first;
    delta = ((delta + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    if (Math.abs(delta) < 1e-8) return null;
    const radius = Math.max(5, Math.abs(dimension.offset));
    const point = (angle: number, r = radius): DrawingPoint => [b[0] + Math.cos(angle) * r, b[1] + Math.sin(angle) * r];
    const p = point(first), q = point(first + delta);
    arc = `M ${p.join(" ")} A ${radius} ${radius} 0 0 ${delta >= 0 ? 1 : 0} ${q.join(" ")}`;
    guides.push([b, point(first, radius + 2)], [b, point(first + delta, radius + 2)]);
    text = point(first + delta / 2, radius + 4);
  } else if (dimension.kind === "radius" || dimension.kind === "diameter") {
    const target = anchors.length === 2 ? b : a;
    const offset = dimension.labelOffset ?? [dimension.offset, -Math.abs(dimension.offset)];
    text = [target[0] + offset[0]!, target[1] + offset[1]!];
    line = [text, target];
  } else {
    const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
    if (length < 1e-8) return null;
    const normal: DrawingPoint = dimension.kind === "horizontal" ? [0, 1] : dimension.kind === "vertical" ? [1, 0] : [-dy / length, dx / length];
    const center: DrawingPoint = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const shift = (p: DrawingPoint): DrawingPoint => dimension.kind === "horizontal" ? [p[0], center[1] + dimension.offset]
      : dimension.kind === "vertical" ? [center[0] + dimension.offset, p[1]]
        : [p[0] + normal[0] * dimension.offset, p[1] + normal[1] * dimension.offset];
    const start = shift(a), end = shift(b);
    const extension = (p: DrawingPoint): DrawingPoint => [p[0] + normal[0] * Math.sign(dimension.offset || 1) * 2, p[1] + normal[1] * Math.sign(dimension.offset || 1) * 2];
    guides.push([a, extension(start)], [b, extension(end)]);
    line = [start, end];
    text = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2 - 1.5];
  }
  return { guides, line, arc, text, label, value };
}

export function drawingDimensionOffset(sheet: DrawingSheet, kind: DrawingDimension["kind"], anchors: DrawingAnchor[], point: DrawingPoint, results: DrawingViewResults) {
  const a = resolveDrawingAnchor(sheet, anchors[0]!, results)?.paper;
  const b = resolveDrawingAnchor(sheet, anchors[1]!, results)?.paper;
  if (!a || !b) return 10;
  const center = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  if (kind === "horizontal") return point[1] - center[1]!;
  if (kind === "vertical") return point[0] - center[0]!;
  if (kind === "angle") return Math.hypot(point[0] - b[0], point[1] - b[1]);
  if (kind === "radius" || kind === "diameter") return point[0] - a[0];
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return ((point[0] - center[0]!) * (a[1] - b[1]) + (point[1] - center[1]!) * (b[0] - a[0])) / length;
}
