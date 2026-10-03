"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { Download, Home, Minus, Plus, Printer, Redo2, Save, Undo2 } from "lucide-react";
import type { WorkplaneShape } from "@/types/sketchforge";
import { createLocalId } from "@/lib/localIds";
import { immutableResourceFingerprint, projectShapesFingerprint } from "@/lib/editorHistory";
import { createDrawingSheet, DRAWING_TEMPLATES, DRAWING_VIEWS, drawingEntityPoints, drawingPaper, parseDrawingSheet, reconfigureDrawingSheet, type DrawingAnchor, type DrawingDimension, type DrawingDimensionKind, type DrawingEntity, type DrawingPoint, type DrawingPoint3, type DrawingSheet, type DrawingTemplate, type DrawingView } from "@/lib/drawingSheet";
import { drawingDimensionGeometry, drawingDimensionIsStale, drawingDimensionOffset, resolveDrawingAnchor, type DrawingViewResults, type DrawingViewResult } from "@/lib/drawingDimensions";
import { MAX_DRAWING_TRIANGLES, projectDrawingMeshes, type DrawingMesh } from "@/lib/drawingProjection";
import { DrawingSheetSvg, serializeDrawingSvg, type DrawingSelection } from "@/components/DrawingSheetSvg";
import { useTouchNavigation } from "@/components/useTouchNavigation";

type Tool = "select" | DrawingEntity["kind"] | DrawingDimensionKind;
const DIMENSION_TOOLS: DrawingDimensionKind[] = ["horizontal", "vertical", "aligned", "angle", "radius", "diameter"];
const SCALES = [0.01, 0.02, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10];
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
type Drag = { pointerId: number; selection: NonNullable<DrawingSelection>; start: DrawingPoint; dx: number; dy: number; offset?: number; labelOffset?: DrawingPoint };

function DrawingNumber({ label, value, onChange, min = -1000000, max = 1000000, step = 1 }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number }) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);
  return <label className="drawing-field"><span>{label}</span><input type="number" aria-label={label} value={editing ? draft : String(Number(value.toFixed(4)))} min={min} max={max} step={step}
    onFocus={() => { setDraft(String(value)); setEditing(true); }} onChange={(event) => setDraft(event.currentTarget.value)}
    onBlur={(event) => { setEditing(false); const n = event.currentTarget.value === "" ? value : Number(event.currentTarget.value); const next = Number.isFinite(n) ? clamp(n, min, max) : value; setDraft(String(next)); onChange(next); }}
    onKeyDown={(event) => { if (event.key === "Escape") { event.currentTarget.value = String(value); setDraft(String(value)); event.currentTarget.blur(); } else if (event.key === "Enter") event.currentTarget.blur(); }} /></label>;
}

export function DrawingWorkspace({ active, value, projectName, shapes, selectedIds, getMesh, onChange, toolbarHost, onHome, onExportSvg, onSaveProject }: {
  active: boolean; value?: DrawingSheet; projectName: string; shapes: WorkplaneShape[]; selectedIds: string[];
  getMesh: (shape: WorkplaneShape) => DrawingMesh; onChange: (sheet: DrawingSheet) => void;
  toolbarHost: HTMLDivElement | null; onHome?: () => void; onExportSvg: (svg: string) => Promise<void>; onSaveProject: (sheet: DrawingSheet) => void;
}) {
  const empty = useRef<DrawingSheet | null>(null);
  if (!empty.current) empty.current = createDrawingSheet();
  const sheet = value ?? empty.current;
  const sheetRef = useRef(sheet); sheetRef.current = sheet;
  const solids = useMemo(() => shapes.filter((shape) => !shape.hidden && !shape.hole && shape.kind !== "constructionPlane"), [shapes]);
  const selectedSolids = solids.filter((shape) => selectedIds.includes(shape.id));
  const [tool, setTool] = useState<Tool>("select");
  const [selection, setSelection] = useState<DrawingSelection>(null);
  const [source, setSource] = useState(selectedSolids.length === 1 ? selectedSolids[0]!.id : selectedSolids.length ? "selection" : "all");
  const [preset, setPreset] = useState<keyof typeof DRAWING_VIEWS>("Front");
  const [pending, setPending] = useState<DrawingAnchor[]>([]);
  const [pendingFingerprint, setPendingFingerprint] = useState("");
  const [firstPoint, setFirstPoint] = useState<DrawingPoint | null>(null);
  const [pointer, setPointer] = useState<DrawingPoint | null>(null);
  const [hover, setHover] = useState<{ anchor: DrawingAnchor; paper: DrawingPoint } | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState(2);
  const [snap, setSnap] = useState(1);
  const [noteText, setNoteText] = useState("Note");
  const [notice, setNotice] = useState("Choose a paper template, then add model views or draw on the sheet.");
  const [controlsOpen, setControlsOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const history = useRef<{ past: DrawingSheet[]; future: DrawingSheet[] }>({ past: [], future: [] });
  const [, historyChanged] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const projectionCache = useRef(new Map<string, DrawingViewResult>());
  const meshCache = useRef(new Map<string, { meshes: DrawingMesh[]; fingerprint?: string }>());
  const paper = drawingPaper(sheet);
  const sourceIds = source === "all" ? solids.map((shape) => shape.id) : source === "selection" ? selectedSolids.map((shape) => shape.id) : solids.filter((shape) => shape.id === source).map((shape) => shape.id);
  const selectionKey = selectedSolids.map((shape) => shape.id).join("|");
  useEffect(() => { if (active) setSource(selectedSolids.length === 1 ? selectedSolids[0]!.id : selectedSolids.length ? "selection" : "all"); }, [active, selectionKey]);

  const projectionFor = (view: Pick<DrawingView, "shapeIds" | "rotation">): DrawingViewResult => {
    const parts = view.shapeIds.map((id) => shapes.find((shape) => shape.id === id)).filter((shape): shape is WorkplaneShape => Boolean(shape && !shape.hole && shape.kind !== "constructionPlane"));
    const sourceKey = projectShapesFingerprint(parts);
    if (!parts.length || parts.length !== view.shapeIds.length) return { fingerprint: sourceKey, error: "A source object was removed. Delete this view or restore its source." };
    const key = `${sourceKey}:${view.rotation.join(",")}`;
    const cached = projectionCache.current.get(key);
    if (cached) return cached;
    try {
      const importedTriangles = (shape: WorkplaneShape): number => shape.importedMesh?.triangleCount ?? shape.groupedShapes?.reduce((sum, child) => sum + importedTriangles(child), 0) ?? 0;
      if (parts.reduce((sum, part) => sum + importedTriangles(part), 0) > MAX_DRAWING_TRIANGLES) throw new Error("Drawing views support up to 100,000 triangles. Choose fewer or simpler objects.");
      let source = meshCache.current.get(sourceKey);
      if (!source) {
        source = { meshes: parts.map(getMesh) };
        meshCache.current.set(sourceKey, source);
        if (meshCache.current.size > 4) meshCache.current.delete(meshCache.current.keys().next().value!);
      }
      const projection = projectDrawingMeshes(source.meshes, view.rotation);
      // Annotation validity follows geometry, not transient resource IDs,
      // object colors, names, or other metadata that can change on reload.
      source.fingerprint ??= immutableResourceFingerprint({ meshes: source.meshes.map(({ vertices, faces }) => ({ vertices, faces })) });
      const result = { projection, fingerprint: source.fingerprint };
      projectionCache.current.set(key, result);
      if (projectionCache.current.size > 24) projectionCache.current.delete(projectionCache.current.keys().next().value!);
      return result;
    } catch (error) { return { fingerprint: sourceKey, error: error instanceof Error ? error.message : "Could not project this model" }; }
  };
  const results: DrawingViewResults = useMemo(() => new Map(active ? sheet.views.map((view) => [view.id, projectionFor(view)]) : []), [active, sheet.views, shapes, getMesh]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!active || !viewport) return;
    const resize = () => setFit(Math.max(0.05, Math.min((viewport.clientWidth - 48) / paper.width, (viewport.clientHeight - 48) / paper.height)));
    resize();
    const observer = new ResizeObserver(resize); observer.observe(viewport);
    return () => observer.disconnect();
  }, [active, paper.width, paper.height]);

  const cancelPending = () => { setPending([]); setFirstPoint(null); setHover(null); setPointer(null); setDrag(null); dragRef.current = null; };
  const chooseTool = (next: Tool) => { cancelPending(); setTool(next); setNotice(""); };
  const commit = (next: DrawingSheet) => {
    try {
      const clean = parseDrawingSheet(next);
      if (JSON.stringify(clean) === JSON.stringify(sheetRef.current)) return;
      history.current.past = [...history.current.past, sheetRef.current].slice(-50);
      history.current.future = [];
      sheetRef.current = clean; onChange(clean); historyChanged((value) => value + 1);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Invalid drawing change"); }
  };
  const undo = () => {
    const previous = history.current.past.pop();
    if (!previous) return;
    history.current.future.push(sheetRef.current); sheetRef.current = previous; onChange(previous); historyChanged((value) => value + 1); cancelPending(); setSelection(null);
  };
  const redo = () => {
    const next = history.current.future.pop();
    if (!next) return;
    history.current.past.push(sheetRef.current); sheetRef.current = next; onChange(next); historyChanged((value) => value + 1); cancelPending(); setSelection(null);
  };
  const removeSelected = () => {
    if (!selection) return;
    commit({ ...sheet, views: sheet.views.filter((view) => selection.kind !== "view" || view.id !== selection.id), entities: sheet.entities.filter((entity) => selection.kind !== "entity" || entity.id !== selection.id), dimensions: sheet.dimensions.filter((dimension) => !(selection.kind === "dimension" && dimension.id === selection.id) && !dimension.anchors.some((anchor) => anchor.type === "view" ? selection.kind === "view" && anchor.viewId === selection.id : selection.kind === "entity" && anchor.entityId === selection.id)) });
    setSelection(null); cancelPending();
  };
  useEffect(() => {
    if (!active) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && (event.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName))) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); }
      else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") { event.preventDefault(); redo(); }
      else if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); removeSelected(); }
      else if (event.key === "Escape") { cancelPending(); setTool("select"); }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [active, sheet, selection]);

  const addViews = (three = false) => {
    if (!sourceIds.length) { setNotice("Choose at least one visible solid to place on the drawing."); return; }
    if (sourceIds.length > 512) { setNotice("Choose up to 512 source objects, or group the model first."); return; }
    if (sheet.views.length + (three ? 3 : 1) > 24) { setNotice("A sheet supports up to 24 model views."); return; }
    const presets = three ? ["Front", "Top", "Right"] as const : [preset];
    const projections = presets.map((name) => projectionFor({ shapeIds: sourceIds, rotation: DRAWING_VIEWS[name] }));
    const error = projections.find((result) => result.error)?.error;
    if (error) { setNotice(error); return; }
    const areaWidth = paper.width - paper.left - paper.margin - 20;
    const areaHeight = paper.height - paper.margin * 2 - 60;
    const cellWidth = areaWidth / (three ? 2 : 1), cellHeight = areaHeight / (three ? 2 : 1);
    const fitted = Math.min(1, ...projections.map(({ projection: p }) => Math.min((cellWidth - 16) / Math.max(p!.width, 1), (cellHeight - 16) / Math.max(p!.height, 1))));
    const scale = [...SCALES].reverse().find((scale) => scale <= fitted) ?? Math.max(0.001, fitted);
    const origin: DrawingPoint = [paper.left + 10, paper.margin + 10];
    const cells: DrawingPoint[] = sheet.projection === "third" ? [[0.5, 1.5], [0.5, 0.5], [1.5, 1.5]] : [[1.5, 0.5], [1.5, 1.5], [0.5, 0.5]];
    const views = presets.map((name, i): DrawingView => ({ id: createLocalId("drawing-view"), name: `${sourceIds.length === 1 ? solids.find((shape) => shape.id === sourceIds[0])?.name ?? "Model" : "Assembly"} — ${name}`.slice(0, 120), shapeIds: [...sourceIds], rotation: [...DRAWING_VIEWS[name]], x: origin[0] + (three ? cells[i]![0] : 0.5) * cellWidth, y: origin[1] + (three ? cells[i]![1] : 0.5) * cellHeight, scale, showHidden: true }));
    commit({ ...sheet, views: [...sheet.views, ...views] });
    setSelection({ kind: "view", id: views[0]!.id }); chooseTool("select");
    setNotice(three ? `Added ${sheet.projection}-angle Front / Top / Right views.` : "View added. Drag it on the sheet or set its scale and angles.");
  };

  const withDrag = (current: Drag | null): DrawingSheet => !current ? sheet : ({
    ...sheet,
    views: sheet.views.map((view) => current.selection.kind === "view" && current.selection.id === view.id ? { ...view, x: view.x + current.dx, y: view.y + current.dy } : view),
    entities: sheet.entities.map((entity) => current.selection.kind === "entity" && current.selection.id === entity.id ? { ...entity, a: [entity.a[0] + current.dx, entity.a[1] + current.dy], b: [entity.b[0] + current.dx, entity.b[1] + current.dy] } : entity),
    dimensions: sheet.dimensions.map((dimension) => current.selection.kind === "dimension" && current.selection.id === dimension.id ? { ...dimension, offset: current.offset ?? dimension.offset, ...(current.labelOffset ? { labelOffset: current.labelOffset } : {}) } : dimension),
  });
  const displaySheet = withDrag(drag);

  const pointFromEvent = (event: { clientX: number; clientY: number }): DrawingPoint | null => {
    const matrix = svgRef.current?.getScreenCTM();
    if (!matrix) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return [point.x, point.y];
  };
  const snapPaper = (point: DrawingPoint): DrawingPoint => point.map((value) => snap ? Math.round(value / snap) * snap : value) as DrawingPoint;
  const nearestAnchor = (point: DrawingPoint) => {
    let best: { anchor: DrawingAnchor; paper: DrawingPoint; distance: number; depth: number } | null = null;
    const tolerance = 12 / Math.max(0.01, fit * zoom);
    const consider = (anchor: DrawingAnchor, paperPoint: DrawingPoint, depth = 0) => {
      if (paperPoint[0] < paper.left || paperPoint[0] > paper.width - paper.margin || paperPoint[1] < paper.margin || paperPoint[1] > paper.height - paper.margin - 36) return;
      const distance = Math.hypot(paperPoint[0] - point[0], paperPoint[1] - point[1]);
      if (distance <= tolerance && (!best || distance < best.distance - 0.0001 || (Math.abs(distance - best.distance) <= 0.0001 && depth > best.depth))) best = { anchor, paper: paperPoint, distance, depth };
    };
    for (const view of sheet.views) for (const anchor of results.get(view.id)?.projection?.anchors ?? []) {
      if (view.showHidden || !anchor.hidden) consider({ type: "view", viewId: view.id, point: anchor.point }, [view.x + anchor.projected[0] * view.scale, view.y + anchor.projected[1] * view.scale], anchor.depth);
    }
    for (const entity of sheet.entities) if (entity.kind !== "note") drawingEntityPoints(entity).forEach((point, index) => consider({ type: "entity", entityId: entity.id, index }, point));
    return best as { anchor: DrawingAnchor; paper: DrawingPoint } | null;
  };
  const anchorCount = () => tool === "angle" ? 3 : tool === "radius" || tool === "diameter"
    ? pending[0]?.type === "entity" && sheet.entities.find((entity) => entity.id === (pending[0] as Extract<DrawingAnchor, { type: "entity" }>).entityId)?.kind === "circle" ? 2 : 3 : 2;
  const dimensionAt = (point: DrawingPoint): DrawingDimension | null => {
    if (!DIMENSION_TOOLS.includes(tool as DrawingDimensionKind) || pending.length < anchorCount()) return null;
    const target = resolveDrawingAnchor(sheet, pending[pending.length === 2 ? 1 : 0]!, results)?.paper;
    return { id: "dimension-preview", kind: tool as DrawingDimensionKind, anchors: pending, offset: clamp(drawingDimensionOffset(sheet, tool as DrawingDimensionKind, pending, point, results), -2000, 2000), sourceFingerprint: pendingFingerprint, ...(target && (tool === "radius" || tool === "diameter") ? { labelOffset: [point[0] - target[0], point[1] - target[1]] as DrawingPoint } : {}) };
  };
  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    const point = pointFromEvent(event); if (!point) return;
    event.preventDefault();
    setNotice("");
    const target = (event.target as Element).closest("[data-drawing-id]");
    const id = target?.getAttribute("data-drawing-id");
    const kind = target?.getAttribute("data-drawing-kind") as NonNullable<DrawingSelection>["kind"] | undefined;
    if (tool === "select") {
      const selected = id && kind ? { id, kind } : null;
      setSelection(selected);
      if (selected) {
        event.currentTarget.setPointerCapture(event.pointerId);
        const next = { pointerId: event.pointerId, selection: selected, start: point, dx: 0, dy: 0 };
        dragRef.current = next; setDrag(next);
      }
      return;
    }
    if (point[0] < paper.left || point[0] > paper.width - paper.margin || point[1] < paper.margin || point[1] > paper.height - paper.margin - 36) {
      setNotice("Place geometry and dimensions inside the frame, above the title-block band."); return;
    }
    if (DIMENSION_TOOLS.includes(tool as DrawingDimensionKind)) {
      if (pending.length >= anchorCount()) {
        const dimension = dimensionAt(point)!;
        if (!drawingDimensionGeometry(sheet, dimension, results)) { setNotice("Choose distinct, non-collinear measurement points on the current model."); setPending([]); return; }
        if (sheet.dimensions.length >= 200) { setNotice("A sheet supports up to 200 dimensions."); return; }
        const next = { ...dimension, id: createLocalId("drawing-dimension") };
        commit({ ...sheet, dimensions: [...sheet.dimensions, next] }); setPending([]); setSelection({ kind: "dimension", id: next.id }); return;
      }
      const entity = kind === "entity" ? sheet.entities.find((entity) => entity.id === id) : undefined;
      if ((tool === "radius" || tool === "diameter") && !pending.length && entity?.kind === "circle") {
        setPending([{ type: "entity", entityId: entity.id, index: 0 }, { type: "entity", entityId: entity.id, index: 1 }]); setPendingFingerprint(""); return;
      }
      const nearest = nearestAnchor(point);
      if (!nearest) { setNotice("Click a highlighted model endpoint or drawing-shape corner."); return; }
      const first = pending[0], anchor = nearest.anchor;
      if (first && (first.type !== anchor.type || first.type === "view" && anchor.type === "view" && first.viewId !== anchor.viewId)) { setNotice("Pick points from the same model view, or from paper-drawn shapes."); return; }
      if (!pending.length) setPendingFingerprint(anchor.type === "view" ? results.get(anchor.viewId)!.fingerprint : "");
      setPending([...pending, anchor]); return;
    }
    if (sheet.entities.length >= 400) { setNotice("A sheet supports up to 400 drawing entities."); return; }
    const p = snapPaper(point);
    if (tool === "note") {
      const entity: DrawingEntity = { id: createLocalId("drawing-note"), kind: "note", a: p, b: p, angle: 0, text: noteText || "Note" };
      commit({ ...sheet, entities: [...sheet.entities, entity] }); setSelection({ kind: "entity", id: entity.id }); return;
    }
    if (!firstPoint) { setFirstPoint(p); return; }
    if (Math.hypot(p[0] - firstPoint[0], p[1] - firstPoint[1]) < 0.01) return;
    if (tool === "rectangle" && (Math.abs(p[0] - firstPoint[0]) < 0.01 || Math.abs(p[1] - firstPoint[1]) < 0.01)) return;
    const entity: DrawingEntity = { id: createLocalId("drawing-entity"), kind: tool as DrawingEntity["kind"], a: tool === "rectangle" ? [Math.min(firstPoint[0], p[0]), Math.min(firstPoint[1], p[1])] : firstPoint, b: tool === "rectangle" ? [Math.max(firstPoint[0], p[0]), Math.max(firstPoint[1], p[1])] : p, angle: 0, text: "" };
    commit({ ...sheet, entities: [...sheet.entities, entity] }); setFirstPoint(null); setSelection({ kind: "entity", id: entity.id });
  };
  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const point = pointFromEvent(event); if (!point) return;
    setPointer(point);
    setHover(DIMENSION_TOOLS.includes(tool as DrawingDimensionKind) ? nearestAnchor(point) : null);
    const current = dragRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const next: Drag = { ...current, dx: point[0] - current.start[0], dy: point[1] - current.start[1] };
    if (current.selection.kind === "dimension") {
      const dimension = sheet.dimensions.find((dimension) => dimension.id === current.selection.id);
      if (dimension) next.offset = dimension.offset + drawingDimensionOffset(sheet, dimension.kind, dimension.anchors, point, results) - drawingDimensionOffset(sheet, dimension.kind, dimension.anchors, current.start, results);
      if (dimension && (dimension.kind === "radius" || dimension.kind === "diameter")) {
        const offset = dimension.labelOffset ?? [dimension.offset, -Math.abs(dimension.offset)];
        next.labelOffset = [offset[0]! + next.dx, offset[1]! + next.dy];
      }
    }
    dragRef.current = next; setDrag(next);
  };
  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    const current = dragRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    commit(withDrag(current)); setDrag(null); dragRef.current = null;
  };
  useTouchNavigation(svgRef, {
    resetKey: `${active}:${tool}`, allowTap: true, singleAction: () => "edit",
    navigate: (gesture) => {
      const viewport = viewportRef.current;
      if (viewport) { viewport.scrollLeft -= gesture.dx; viewport.scrollTop -= gesture.dy; }
      if (gesture.scale !== 1) setZoom((zoom) => clamp(zoom * gesture.scale, 0.25, 4));
    },
  });

  const readyToExport = () => {
    const error = [...results.values()].find((result) => result.error)?.error;
    if (error) { setNotice(error); return false; }
    if (sheet.dimensions.some((dimension) => drawingDimensionIsStale(dimension, results))) { setNotice("Source models changed. Clear and recreate their stale dimensions before exporting or printing."); return false; }
    if (sheet.dimensions.some((dimension) => !drawingDimensionGeometry(sheet, dimension, results))) { setNotice("A dimension is collapsed or invalid in this orientation. Adjust the view or remove that dimension before exporting."); return false; }
    if (sheet.views.some((view) => {
      const p = results.get(view.id)?.projection;
      return p && (view.x - p.width * view.scale / 2 < paper.left || view.x + p.width * view.scale / 2 > paper.width - paper.margin || view.y - p.height * view.scale / 2 < paper.margin || view.y + p.height * view.scale / 2 > paper.height - paper.margin - 36);
    })) { setNotice("A model view exceeds the drawing area. Reduce its scale or reposition it before exporting."); return false; }
    const inside = ([x, y]: DrawingPoint) => x >= paper.left && x <= paper.width - paper.margin && y >= paper.margin && y <= paper.height - paper.margin - 36;
    if (sheet.entities.some((entity) => {
      const radius = Math.hypot(entity.b[0] - entity.a[0], entity.b[1] - entity.a[1]);
      const points: DrawingPoint[] = entity.kind === "circle" ? [[entity.a[0] - radius, entity.a[1] - radius], [entity.a[0] + radius, entity.a[1] + radius]] : drawingEntityPoints(entity);
      return points.some((point) => !inside(point));
    })
      || sheet.dimensions.some((dimension) => {
        const geometry = drawingDimensionGeometry(sheet, dimension, results)!;
        return !inside(geometry.text) || geometry.guides.some((guide) => guide.some((point) => !inside(point)));
      })) { setNotice("A drawing shape or dimension exceeds the drawing area or enters the title-block band. Reposition it before exporting."); return false; }
    const inverse = svgRef.current?.getScreenCTM()?.inverse();
    if (inverse && svgRef.current) {
      for (const node of svgRef.current.querySelectorAll<SVGGraphicsElement>('[data-dimension-label], [data-drawing-kind="entity"] text, [data-drawing-kind="view"] > text')) {
        if (node.closest("[data-drawing-ui]") || !node.textContent?.trim()) continue;
        const matrix = node.getScreenCTM(); if (!matrix) continue;
        const box = node.getBBox(), transform = inverse.multiply(matrix);
        const corners = [[box.x, box.y], [box.x + box.width, box.y], [box.x, box.y + box.height], [box.x + box.width, box.y + box.height]];
        if (corners.some(([x, y]) => { const p = new DOMPoint(x, y).matrixTransform(transform); return !inside([p.x, p.y]); })) {
          setNotice("A view label, note, or dimension label extends outside the frame. Shorten or reposition it before exporting."); return false;
        }
      }
    }
    return true;
  };
  const exportSvg = async () => {
    if (!svgRef.current || !readyToExport()) return;
    setExporting(true);
    try { await onExportSvg(serializeDrawingSvg(svgRef.current, sheet)); setNotice("Drawing SVG exported at the selected paper size."); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Could not export drawing"); }
    finally { setExporting(false); }
  };
  if (!active) return null;
  const selectedView = selection?.kind === "view" ? sheet.views.find((view) => view.id === selection.id) : undefined;
  const selectedEntity = selection?.kind === "entity" ? sheet.entities.find((entity) => entity.id === selection.id) : undefined;
  const selectedDimension = selection?.kind === "dimension" ? sheet.dimensions.find((dimension) => dimension.id === selection.id) : undefined;
  const editView = (patch: Partial<DrawingView>) => commit({ ...sheet, views: sheet.views.map((view) => view.id === selectedView?.id ? { ...view, ...patch } : view) });
  const viewPreset = (rotation: DrawingPoint3) => Object.entries(DRAWING_VIEWS).find(([, angles]) => angles.every((angle, i) => Math.abs(angle - rotation[i]!) < 0.0001))?.[0] ?? "Custom";
  const orientView = (rotation: DrawingPoint3) => editView({ rotation, name: selectedView!.name.replace(/ — (Front|Top|Right|Left|Back|Bottom|Isometric|Custom)$/, ` — ${viewPreset(rotation)}`) });
  const editEntity = (patch: Partial<DrawingEntity>) => commit({ ...sheet, entities: sheet.entities.map((entity) => entity.id === selectedEntity?.id ? { ...entity, ...patch } : entity) });
  let instruction = "Select and drag a view, paper shape, or dimension.";
  if (pending.length) {
    instruction = pending.length >= anchorCount() ? "Click to place the dimension label."
      : tool === "angle" ? pending.length === 1 ? "Pick the angle vertex." : "Pick a point on the second ray."
        : `Pick point ${pending.length + 1} of ${anchorCount()}.`;
  } else if (firstPoint) instruction = tool === "circle" ? "Choose a point on the circle." : "Choose the second point.";
  else if (tool === "note") instruction = "Click the sheet to place the note.";
  else if (tool === "angle") instruction = "Pick a point on the first ray, the vertex, then a point on the second ray.";
  else if (tool === "radius" || tool === "diameter") instruction = "Click a drawn circle, or pick three points on a circular model edge, then place the leader.";
  else if (DIMENSION_TOOLS.includes(tool as DrawingDimensionKind)) instruction = "Pick two endpoints or corners, then click to place the dimension.";
  else if (tool === "circle") instruction = "Click the circle center, then a radius point.";
  else if (tool !== "select") instruction = "Click two points on the sheet to draw.";
  const status = notice || instruction;
  const toolbar = <div className="drawing-toolbar" aria-label="Drawing toolbar">
    {onHome ? <div className="toolbar-section" data-tool-group="home"><div className="toolbar-section-label">Home</div><div className="toolbar-section-tools"><button type="button" aria-label="Home dashboard" onClick={onHome}><Home size={20} /></button></div></div> : null}
    <div className="toolbar-section" data-tool-group="shapes"><div className="toolbar-section-label">Sheet</div><div className="toolbar-section-tools">
      <select aria-label="Drawing template" value={sheet.template} onChange={(event) => {
        const template = event.currentTarget.value as DrawingTemplate, standard = DRAWING_TEMPLATES[template].standard;
        commit(reconfigureDrawingSheet(sheet, { template, units: standard === "ISO" ? "mm" : "in", projection: standard === "ISO" ? "first" : "third" }));
      }}>{Object.keys(DRAWING_TEMPLATES).map((name) => <option key={name}>{name}</option>)}</select>
      <select aria-label="Drawing orientation" value={sheet.orientation} onChange={(event) => commit(reconfigureDrawingSheet(sheet, { orientation: event.currentTarget.value as DrawingSheet["orientation"] }))}><option value="landscape">Landscape</option><option value="portrait">Portrait</option></select>
    </div></div>
    <div className="toolbar-section" data-tool-group="generators"><div className="toolbar-section-label">Model views</div><div className="toolbar-section-tools">
      <select aria-label="New drawing view" value={preset} onChange={(event) => setPreset(event.currentTarget.value as keyof typeof DRAWING_VIEWS)}>{Object.keys(DRAWING_VIEWS).map((name) => <option key={name}>{name}</option>)}</select>
      <button type="button" onClick={() => addViews()}>Add view</button><button type="button" onClick={() => addViews(true)}>3 views</button>
    </div></div>
    <div className="toolbar-section" data-tool-group="modify"><div className="toolbar-section-label">Draw / Measure</div><div className="toolbar-section-tools">
      <select aria-label="Drawing tool" value={tool} onChange={(event) => chooseTool(event.currentTarget.value as Tool)}>
        <option value="select">Select / Move</option><option value="line">Line</option><option value="rectangle">Rectangle</option><option value="circle">Circle</option><option value="note">Note</option>
        <option value="horizontal">Horizontal dimension</option><option value="vertical">Vertical dimension</option><option value="aligned">Aligned dimension</option><option value="angle">Angle dimension</option><option value="radius">Radius dimension</option><option value="diameter">Diameter dimension</option>
      </select>
    </div></div>
    <div className="toolbar-section" data-tool-group="history"><div className="toolbar-section-label">History</div><div className="toolbar-section-tools"><button type="button" aria-label="Drawing undo" disabled={!history.current.past.length} onClick={undo}><Undo2 size={20} /></button><button type="button" aria-label="Drawing redo" disabled={!history.current.future.length} onClick={redo}><Redo2 size={20} /></button></div></div>
    <div className="toolbar-section" data-tool-group="manage"><div className="toolbar-section-label">Output</div><div className="toolbar-section-tools"><button type="button" onClick={exportSvg} disabled={exporting}><Download size={18} />SVG</button><button type="button" onClick={() => { if (readyToExport()) window.print(); }}><Printer size={18} />Print / PDF</button><button type="button" onClick={() => onSaveProject(sheet)}><Save size={18} />Save SKF</button></div></div>
  </div>;
  return <main className="drawing-workspace" aria-label="2D CAD Drawing workspace">
    {toolbarHost ? createPortal(toolbar, toolbarHost) : null}
    <style media="print">{`@page { size: ${paper.width}mm ${paper.height}mm; margin: 0; } .drawing-paper-svg { width: ${paper.width}mm !important; height: ${paper.height}mm !important; }`}</style>
    <button type="button" className="drawing-properties-toggle" aria-expanded={controlsOpen} onClick={() => setControlsOpen(!controlsOpen)}>Drawing properties</button>
    <aside className={`drawing-properties ${controlsOpen ? "open" : ""}`} aria-label="Drawing properties">
      <h2>Drawing sheet</h2>
      <label className="drawing-field"><span>Source for new / replacement views</span><select aria-label="Drawing model source" value={source} onChange={(event) => setSource(event.currentTarget.value)}><option value="all">All visible solids</option><option value="selection" disabled={!selectedSolids.length}>Selected solids ({selectedSolids.length})</option>{solids.map((shape) => <option key={shape.id} value={shape.id}>{shape.name}</option>)}</select></label>
      {(["title", "number", "author", "revision", "date"] as const).map((field) => <label className="drawing-field" key={field}><span>{({ title: "Drawing title", number: "Drawing number", author: "Drawn by", revision: "Revision", date: "Date" })[field]}</span><input aria-label={`Drawing ${field}`} value={sheet[field]} maxLength={120} placeholder={field === "title" ? projectName : undefined} onChange={(event) => commit({ ...sheet, [field]: event.currentTarget.value })} /></label>)}
      <label className="drawing-field"><span>Dimension units</span><select aria-label="Drawing units" value={sheet.units} onChange={(event) => commit({ ...sheet, units: event.currentTarget.value as DrawingSheet["units"] })}><option value="mm">Millimeters</option><option value="in">Inches</option></select></label>
      <label className="drawing-field"><span>Projection convention</span><select aria-label="Drawing projection convention" value={sheet.projection} onChange={(event) => commit(reconfigureDrawingSheet(sheet, { projection: event.currentTarget.value as DrawingSheet["projection"] }))}><option value="first">First angle (ISO default)</option><option value="third">Third angle (ANSI default)</option></select></label>
      <label className="drawing-field"><span>Paper snap</span><select aria-label="Drawing paper snap" value={snap} onChange={(event) => setSnap(Number(event.currentTarget.value))}><option value="0">Off</option><option value="0.5">0.5 mm</option><option value="1">1 mm</option><option value="5">5 mm</option></select></label>
      {tool === "note" ? <label className="drawing-field"><span>New note</span><textarea aria-label="New drawing note" value={noteText} maxLength={500} onChange={(event) => setNoteText(event.currentTarget.value)} /></label> : null}
      <p className="drawing-help">Click corners to dimension, then place the label. Aligned lengths, angles and three-point radii use model-space measurements; horizontal/vertical lengths use the selected view axes. Paper-drawn geometry is 1:1.</p>
      <h3>Placed views</h3>
      <div className="drawing-view-list">{sheet.views.map((view) => <button type="button" key={view.id} aria-pressed={selection?.id === view.id} onClick={() => { setSelection({ kind: "view", id: view.id }); chooseTool("select"); }}>{view.name}</button>)}</div>
      {sheet.entities.length ? <><h3>Paper shapes and notes</h3><div className="drawing-view-list">{sheet.entities.map((entity, index) => <button type="button" key={entity.id} aria-pressed={selection?.id === entity.id} onClick={() => { setSelection({ kind: "entity", id: entity.id }); chooseTool("select"); }}>{entity.kind} {index + 1}{entity.kind === "note" ? `: ${entity.text.slice(0, 24)}` : ""}</button>)}</div></> : null}
      {sheet.dimensions.length ? <><h3>Dimensions</h3><div className="drawing-view-list">{sheet.dimensions.map((dimension, index) => <button type="button" key={dimension.id} aria-pressed={selection?.id === dimension.id} onClick={() => { setSelection({ kind: "dimension", id: dimension.id }); chooseTool("select"); }}>{dimension.kind} {index + 1}: {drawingDimensionGeometry(sheet, dimension, results)?.label ?? "needs review"}</button>)}</div></> : null}
      {selectedView ? <section aria-label="Selected drawing view">
        <h3>View properties</h3>
        <label className="drawing-field"><span>View label</span><input aria-label="Drawing view label" value={selectedView.name} maxLength={120} onChange={(event) => editView({ name: event.currentTarget.value })} /></label>
        <label className="drawing-field"><span>Orientation</span><select aria-label="Drawing view orientation" value={viewPreset(selectedView.rotation)} onChange={(event) => orientView([...DRAWING_VIEWS[event.currentTarget.value as keyof typeof DRAWING_VIEWS]])}>{Object.keys(DRAWING_VIEWS).map((name) => <option key={name}>{name}</option>)}<option value="Custom" disabled>Custom angles</option></select></label>
        <DrawingNumber label="View X (mm)" value={selectedView.x} onChange={(x) => editView({ x })} />
        <DrawingNumber label="View Y (mm)" value={selectedView.y} onChange={(y) => editView({ y })} />
        <DrawingNumber label="View scale" value={selectedView.scale} min={0.001} max={100} step={0.1} onChange={(scale) => editView({ scale })} />
        {(["X", "Y", "Z"] as const).map((axis, i) => <DrawingNumber key={axis} label={`View rotation ${axis} (deg)`} value={selectedView.rotation[i]!} min={-360} max={360} onChange={(angle) => orientView(selectedView.rotation.map((value, index) => index === i ? angle : value) as DrawingPoint3)} />)}
        <button type="button" className="drawing-delete" onClick={() => {
          const projection = results.get(selectedView.id)?.projection;
          if (!projection) return;
          const width = paper.width - paper.left - paper.margin - 20, height = paper.height - paper.margin * 2 - 60;
          const fit = Math.min(width / Math.max(projection.width, 1), height / Math.max(projection.height, 1));
          editView({ scale: [...SCALES].reverse().find((scale) => scale <= fit) ?? Math.max(0.001, fit), x: paper.left + 10 + width / 2, y: paper.margin + 10 + height / 2 });
        }}>Fit view to drawing area</button>
        <label className="drawing-checkbox"><input type="checkbox" checked={selectedView.showHidden} onChange={(event) => editView({ showHidden: event.currentTarget.checked })} />Hidden lines</label>
        <button type="button" className="drawing-delete" disabled={!sourceIds.length} onClick={() => { editView({ shapeIds: [...sourceIds] }); setNotice("View source updated. Review any dimensions flagged as stale."); }}>Use selected source for this view</button>
        {results.get(selectedView.id)?.error ? <p role="alert">{results.get(selectedView.id)?.error}</p> : null}
        {sheet.dimensions.some((dimension) => dimension.anchors[0]?.type === "view" && dimension.anchors[0].viewId === selectedView.id && drawingDimensionIsStale(dimension, results)) ? <div className="drawing-warning">Source model changed. Its old measurements are hidden.<button type="button" onClick={() => {
          commit({ ...sheet, dimensions: sheet.dimensions.filter((dimension) => !(drawingDimensionIsStale(dimension, results) && dimension.anchors.some((anchor) => anchor.type === "view" && anchor.viewId === selectedView.id))) });
          setNotice("Stale dimensions cleared. Add new measurements for the updated model.");
        }}>Clear stale dimensions</button></div> : null}
      </section> : null}
      {selectedEntity ? <section aria-label="Selected drawing entity"><h3>{selectedEntity.kind} properties</h3>
        <DrawingNumber label="Entity X (mm)" value={selectedEntity.a[0]} onChange={(x) => editEntity({ a: [x, selectedEntity.a[1]], b: [selectedEntity.b[0] + x - selectedEntity.a[0], selectedEntity.b[1]] })} />
        <DrawingNumber label="Entity Y (mm)" value={selectedEntity.a[1]} onChange={(y) => editEntity({ a: [selectedEntity.a[0], y], b: [selectedEntity.b[0], selectedEntity.b[1] + y - selectedEntity.a[1]] })} />
        <DrawingNumber label="Entity rotation (deg)" value={selectedEntity.angle} min={-360} max={360} onChange={(angle) => editEntity({ angle })} />
        {selectedEntity.kind === "circle" ? <DrawingNumber label="Circle radius (mm)" value={Math.hypot(selectedEntity.b[0] - selectedEntity.a[0], selectedEntity.b[1] - selectedEntity.a[1])} min={0.01} onChange={(radius) => editEntity({ b: [selectedEntity.a[0] + radius, selectedEntity.a[1]] })} />
          : selectedEntity.kind === "note" ? <label className="drawing-field"><span>Note text</span><textarea aria-label="Drawing note text" value={selectedEntity.text} maxLength={500} onChange={(event) => editEntity({ text: event.currentTarget.value })} /></label>
            : <><DrawingNumber label="Entity end X (mm)" value={selectedEntity.b[0]} onChange={(x) => editEntity({ b: [x, selectedEntity.b[1]] })} /><DrawingNumber label="Entity end Y (mm)" value={selectedEntity.b[1]} onChange={(y) => editEntity({ b: [selectedEntity.b[0], y] })} /></>}
      </section> : null}
      {selectedDimension ? <section><h3>Dimension</h3>{selectedDimension.labelOffset ? (["X", "Y"] as const).map((axis, i) => <DrawingNumber key={axis} label={`Leader offset ${axis} (mm)`} value={selectedDimension.labelOffset![i]!} min={-2000} max={2000} onChange={(value) => commit({ ...sheet, dimensions: sheet.dimensions.map((dimension) => dimension.id === selectedDimension.id ? { ...dimension, labelOffset: selectedDimension.labelOffset!.map((offset, index) => index === i ? value : offset) as DrawingPoint } : dimension) })} />)
        : <DrawingNumber label="Dimension offset (mm)" value={selectedDimension.offset} min={-2000} max={2000} onChange={(offset) => commit({ ...sheet, dimensions: sheet.dimensions.map((dimension) => dimension.id === selectedDimension.id ? { ...dimension, offset } : dimension) })} />}</section> : null}
      <button className="drawing-delete" type="button" disabled={!selection} onClick={removeSelected}>Delete selected drawing item</button>
    </aside>
    <div className="drawing-paper-area">
      <div className="drawing-zoom"><button type="button" aria-label="Zoom drawing out" onClick={() => setZoom((zoom) => clamp(zoom / 1.2, 0.25, 4))}><Minus size={18} /></button><button type="button" onClick={() => setZoom(1)}>Fit sheet</button><button type="button" aria-label="Zoom drawing in" onClick={() => setZoom((zoom) => clamp(zoom * 1.2, 0.25, 4))}><Plus size={18} /></button><span>{sheet.template} · {paper.width} × {paper.height} mm</span></div>
      <div className="drawing-paper-viewport" ref={viewportRef}><div className="drawing-paper-canvas">
        <DrawingSheetSvg sheet={displaySheet} projectName={projectName} results={results} selection={selection} pending={pending} hover={hover} dimensionPreview={pointer ? dimensionAt(pointer) : null}
          draft={firstPoint && pointer && ["line", "rectangle", "circle"].includes(tool) ? { id: "draft", kind: tool as DrawingEntity["kind"], a: firstPoint, b: snapPaper(pointer), angle: 0, text: "" } : null}
          svgRef={svgRef} pixelScale={fit * zoom} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => { setDrag(null); dragRef.current = null; }} />
      </div></div>
      <div className="drawing-status" role="status">{status}{pending.length || firstPoint ? <button type="button" onClick={cancelPending}>Cancel placement</button> : null}</div>
    </div>
  </main>;
}
