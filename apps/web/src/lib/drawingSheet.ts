export type DrawingPoint = [number, number];
export type DrawingPoint3 = [number, number, number];
export const DRAWING_TEMPLATES = {
  "ISO A4": { width: 297, height: 210, standard: "ISO" },
  "ISO A3": { width: 420, height: 297, standard: "ISO" },
  "ISO A2": { width: 594, height: 420, standard: "ISO" },
  "ISO A1": { width: 841, height: 594, standard: "ISO" },
  "ISO A0": { width: 1189, height: 841, standard: "ISO" },
  "ANSI A": { width: 279.4, height: 215.9, standard: "ANSI" },
  "ANSI B": { width: 431.8, height: 279.4, standard: "ANSI" },
  "ANSI C": { width: 558.8, height: 431.8, standard: "ANSI" },
  "ANSI D": { width: 863.6, height: 558.8, standard: "ANSI" },
  "ANSI E": { width: 1117.6, height: 863.6, standard: "ANSI" },
} as const;
export type DrawingTemplate = keyof typeof DRAWING_TEMPLATES;
export const DRAWING_VIEWS = {
  Front: [0, 0, 0], Top: [90, 0, 0], Right: [0, -90, 0],
  Left: [0, 90, 0], Back: [0, 180, 0], Bottom: [-90, 0, 0],
  Isometric: [35.26438968, -45, 0],
} satisfies Record<string, DrawingPoint3>;
export type DrawingView = {
  id: string; name: string; shapeIds: string[]; rotation: DrawingPoint3;
  x: number; y: number; scale: number; showHidden: boolean;
};
export type DrawingEntity = {
  id: string; kind: "line" | "rectangle" | "circle" | "note";
  a: DrawingPoint; b: DrawingPoint; angle: number; text: string;
};
export type DrawingAnchor =
  | { type: "view"; viewId: string; point: DrawingPoint3 }
  | { type: "entity"; entityId: string; index: number };
export type DrawingDimensionKind = "horizontal" | "vertical" | "aligned" | "angle" | "radius" | "diameter";
export type DrawingDimension = {
  id: string; kind: DrawingDimensionKind; anchors: DrawingAnchor[];
  offset: number; sourceFingerprint: string;
  labelOffset?: DrawingPoint;
};
export type DrawingSheet = {
  version: 1; template: DrawingTemplate; orientation: "landscape" | "portrait";
  units: "mm" | "in"; projection: "first" | "third";
  title: string; number: string; author: string; revision: string; date: string;
  views: DrawingView[]; entities: DrawingEntity[]; dimensions: DrawingDimension[];
};

export function createDrawingSheet(): DrawingSheet {
  return { version: 1, template: "ISO A4", orientation: "landscape", units: "mm", projection: "first", title: "", number: "", author: "", revision: "A", date: new Date().toISOString().slice(0, 10), views: [], entities: [], dimensions: [] };
}

export function drawingPaper(sheet: DrawingSheet) {
  const template = DRAWING_TEMPLATES[sheet.template];
  const [width, height] = sheet.orientation === "landscape" ? [template.width, template.height] : [template.height, template.width];
  const margin = template.standard === "ISO" ? 10 : sheet.template === "ANSI A" ? 6.35 : 12.7;
  return { width, height, margin, left: template.standard === "ISO" ? 20 : margin, standard: template.standard };
}

export function reconfigureDrawingSheet(sheet: DrawingSheet, patch: Partial<Pick<DrawingSheet, "template" | "orientation" | "projection" | "units">>): DrawingSheet {
  const next = { ...sheet, ...patch };
  const before = drawingPaper(sheet), after = drawingPaper(next);
  next.views = sheet.views.map((view) => ({ ...view, x: view.x * after.width / before.width, y: view.y * after.height / before.height }));
  if (sheet.projection !== next.projection) {
    const groups = new Map<string, DrawingView[]>();
    for (const view of next.views) {
      const key = [...view.shapeIds].sort().join("\0");
      groups.set(key, [...(groups.get(key) ?? []), view]);
    }
    for (const views of groups.values()) {
      if (views.length !== 3 || ![DRAWING_VIEWS.Front, DRAWING_VIEWS.Top, DRAWING_VIEWS.Right].every((angles) => views.some((view) => angles.every((angle, i) => Math.abs(angle - view.rotation[i]!) < 1e-5)))) continue;
      const centerX = (Math.min(...views.map((view) => view.x)) + Math.max(...views.map((view) => view.x))) / 2;
      const centerY = (Math.min(...views.map((view) => view.y)) + Math.max(...views.map((view) => view.y))) / 2;
      for (const view of views) { view.x = 2 * centerX - view.x; view.y = 2 * centerY - view.y; }
    }
  }
  return next;
}

export function drawingEntityPoints(entity: DrawingEntity): DrawingPoint[] {
  const [x, y] = entity.a, [bx, by] = entity.b;
  const radius = Math.hypot(bx - x, by - y);
  const points: DrawingPoint[] = entity.kind === "rectangle" ? [[x, y], [bx, y], [bx, by], [x, by]]
    : entity.kind === "circle" ? [[x, y], [x + radius, y], [x, y + radius], [x - radius, y], [x, y - radius]]
      : entity.kind === "line" ? [entity.a, entity.b] : [entity.a];
  const center: DrawingPoint = entity.kind === "circle" || entity.kind === "note" ? entity.a : [(x + bx) / 2, (y + by) / 2];
  const angle = entity.angle * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  return points.map(([px, py]) => [center[0] + (px - center[0]) * c - (py - center[1]) * s, center[1] + (px - center[0]) * s + (py - center[1]) * c]);
}

export function drawingMeasurement(kind: DrawingDimensionKind, points: DrawingPoint3[]) {
  const length = (a: DrawingPoint3, b: DrawingPoint3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  if (points.length < 2) return null;
  const [a, b, c] = points as [DrawingPoint3, DrawingPoint3, DrawingPoint3 | undefined];
  if (kind === "horizontal") return Math.abs(b[0] - a[0]);
  if (kind === "vertical") return Math.abs(b[1] - a[1]);
  if (kind === "aligned") return length(a, b);
  if (kind === "angle") {
    if (!c || length(a, b) < 1e-8 || length(c, b) < 1e-8) return null;
    const dot = a.reduce((sum, value, i) => sum + (value - b[i]!) * (c[i]! - b[i]!), 0);
    return Math.acos(Math.max(-1, Math.min(1, dot / (length(a, b) * length(c, b))))) * 180 / Math.PI;
  }
  let radius = length(a, b);
  if (c) {
    const u = b.map((v, i) => v - a[i]!), v = c.map((value, i) => value - a[i]!);
    const cross = Math.hypot(u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!);
    if (cross < 1e-8) return null;
    radius = length(a, b) * length(b, c) * length(c, a) / (2 * cross);
  }
  return kind === "diameter" ? radius * 2 : radius;
}

export function drawingValue(value: number, kind: DrawingDimensionKind, units: DrawingSheet["units"]) {
  if (kind === "angle") return `${value.toFixed(1)}°`;
  const prefix = kind === "radius" ? "R" : kind === "diameter" ? "Ø" : "";
  return prefix + (units === "in" ? value / 25.4 : value).toFixed(units === "in" ? 3 : 2);
}

/** Strict import validation; bounded data contains references, never SVG/HTML. */
export function parseDrawingSheet(value: unknown): DrawingSheet {
  const object = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid drawing object");
    return value as Record<string, unknown>;
  };
  const text = (value: unknown, max = 120) => {
    if (typeof value !== "string" || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new Error("Invalid drawing text");
    return value;
  };
  const number = (value: unknown, min = -1000000, max = 1000000) => {
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw new Error("Invalid drawing number");
    return value;
  };
  const choice = <T extends string>(value: unknown, choices: readonly T[]): T => {
    if (!choices.includes(value as T)) throw new Error("Unknown drawing option");
    return value as T;
  };
  const array = (value: unknown, max: number): unknown[] => {
    if (!Array.isArray(value) || value.length > max) throw new Error("Drawing contains too many elements");
    return value;
  };
  const point = (value: unknown, count: number) => {
    const values = array(value, count);
    if (values.length !== count) throw new Error("Invalid drawing point");
    return values.map((v) => number(v));
  };
  const data = object(value);
  if (data.version !== 1) throw new Error("Unsupported drawing sheet version");
  const ids = new Set<string>();
  const id = (value: unknown) => {
    const result = text(value, 256);
    if (!result || ids.has(result)) throw new Error("Duplicate or empty drawing ID");
    ids.add(result); return result;
  };
  const views: DrawingView[] = array(data.views, 24).map((value) => {
    const v = object(value);
    if (typeof v.showHidden !== "boolean") throw new Error("Invalid drawing visibility");
    const shapeIds = array(v.shapeIds, 512).map((v) => text(v, 1024));
    if (!shapeIds.length || shapeIds.some((id) => !id) || new Set(shapeIds).size !== shapeIds.length) throw new Error("Invalid drawing source references");
    return { id: id(v.id), name: text(v.name), shapeIds, rotation: point(v.rotation, 3) as DrawingPoint3, x: number(v.x), y: number(v.y), scale: number(v.scale, 0.001, 100), showHidden: v.showHidden };
  });
  const entities: DrawingEntity[] = array(data.entities, 400).map((value) => {
    const v = object(value);
    return { id: id(v.id), kind: choice(v.kind, ["line", "rectangle", "circle", "note"]), a: point(v.a, 2) as DrawingPoint, b: point(v.b, 2) as DrawingPoint, angle: number(v.angle, -360, 360), text: text(v.text, 500) };
  });
  const dimensions: DrawingDimension[] = array(data.dimensions, 200).map((value) => {
    const v = object(value);
    const kind = choice(v.kind, ["horizontal", "vertical", "aligned", "angle", "radius", "diameter"]);
    const anchors: DrawingAnchor[] = array(v.anchors, 3).map((value) => {
      const a = object(value);
      if (a.type === "view") {
        const viewId = text(a.viewId, 256);
        if (!views.some((v) => v.id === viewId)) throw new Error("Drawing dimension has no view");
        return { type: "view", viewId, point: point(a.point, 3) as DrawingPoint3 };
      }
      if (a.type !== "entity") throw new Error("Unknown drawing anchor");
      const entityId = text(a.entityId, 256), index = number(a.index, 0, 4);
      const entity = entities.find((v) => v.id === entityId);
      if (!entity || !Number.isInteger(index) || index >= drawingEntityPoints(entity).length) throw new Error("Drawing dimension has an invalid anchor");
      return { type: "entity", entityId, index };
    });
    if (anchors.length < 2 || (kind === "angle" && anchors.length !== 3) || (["horizontal", "vertical", "aligned"].includes(kind) && anchors.length !== 2)) throw new Error("Invalid dimension point count");
    const first = anchors[0]!;
    if (!anchors.every((a) => first.type === "view" ? a.type === "view" && a.viewId === first.viewId : a.type === "entity")) throw new Error("Dimension anchors must share a drawing view");
    return { id: id(v.id), kind, anchors, offset: number(v.offset, -2000, 2000), sourceFingerprint: text(v.sourceFingerprint, 256), ...(v.labelOffset !== undefined ? { labelOffset: point(v.labelOffset, 2) as DrawingPoint } : {}) };
  });
  return { version: 1, template: choice(data.template, Object.keys(DRAWING_TEMPLATES) as DrawingTemplate[]), orientation: choice(data.orientation, ["landscape", "portrait"]), units: choice(data.units, ["mm", "in"]), projection: choice(data.projection, ["first", "third"]), title: text(data.title), number: text(data.number), author: text(data.author), revision: text(data.revision), date: text(data.date), views, entities, dimensions };
}

export function normalizeDrawingSheet(value: unknown): DrawingSheet | undefined {
  if (value === undefined) return undefined;
  try { return parseDrawingSheet(value); } catch { return undefined; }
}
