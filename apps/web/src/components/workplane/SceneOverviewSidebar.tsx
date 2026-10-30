"use client";

import { Boxes, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Eye, EyeOff, Group, Lock, Search, SlidersHorizontal, Trash2, Ungroup, Unlock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { shapeFeatureEnabled, shapeFeatureKinds } from "@/lib/shapeFeatureToggles";
import { isReferenceShape } from "@/lib/workplaneShapes";
import type { ShapeFeatureKind, WorkplaneShape } from "@/types/sketchforge";

function shapeTypeLabel(shape: WorkplaneShape) {
  if (shape.kind === "sketchProfile") return "Independent sketch";
  if (shape.groupedShapes?.length) return shape.groupOperation === "intersection" ? "Intersection" : "Group";
  if (shape.sketchProfile) return shape.sketchOperation === "revolve" ? "Revolved sketch" : "Extruded sketch";
  if (shape.kind === "mesh" && shape.importedMesh) return `${shape.importedMesh.sourceFormat.toUpperCase()} mesh`;
  if (shape.kind === "constructionPlane") return "Construction plane";
  return shape.kind.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function matchesQuery(shape: WorkplaneShape, query: string): boolean {
  if (!query) return true;
  return `${shape.name} ${shapeTypeLabel(shape)}`.toLowerCase().includes(query)
    || Boolean(shape.groupedShapes?.some((child) => matchesQuery(child, query)));
}

function ShapeBadges({ shape }: { shape: WorkplaneShape }) {
  const featureCount = Math.max(shape.edgeTreatments?.length ?? 0, shape.edgeTreatmentHistory?.length ?? 0);
  return (
    <span className="scene-shape-badges" aria-label="Shape features">
      {shape.hole ? <span>Hole</span> : null}
      {shape.locked ? <span>Locked</span> : null}
      {shape.sculpted ? <span>Sculpted</span> : null}
      {featureCount > 0 ? <span>{featureCount} feature{featureCount === 1 ? "" : "s"}</span> : null}
    </span>
  );
}

function GroupedShapeRows({ shapes, parentId, query, onSelect }: { shapes: WorkplaneShape[]; parentId: string; query: string; onSelect: (id: string) => void }) {
  return (
    <div className="scene-group-children" role="group">
      {shapes.filter((child) => matchesQuery(child, query)).map((child) => (
        <div key={child.id}>
          <button className="scene-group-child" type="button" role="treeitem" onClick={() => onSelect(parentId)}>
            <span className="scene-shape-color" style={{ background: child.color }} aria-hidden="true" />
            <span><strong>{child.name}</strong><small>{shapeTypeLabel(child)}</small></span>
          </button>
          {child.groupedShapes?.length ? <GroupedShapeRows shapes={child.groupedShapes} parentId={parentId} query={query} onSelect={onSelect} /> : null}
        </div>
      ))}
    </div>
  );
}

export function SceneOverviewSidebar({
  shapes,
  selectedIds,
  actionsDisabled = false,
  onSelect,
  onSetHidden,
  onSetState,
  onSetFeatureEnabled,
  onDeleteFeature,
  onDelete,
  onGroup,
  onUngroup,
  shapeInspectorCollapsed = false,
  shapeInspectorName,
  onShapeInspectorExpand,
  onEditSketch,
  onExtrudeSketch,
  onRename,
  onOpenPlanes,
}: {
  shapes: WorkplaneShape[];
  selectedIds: string[];
  actionsDisabled?: boolean;
  onSelect: (id: string, mode?: "replace" | "toggle") => void;
  onSetHidden: (id: string, hidden: boolean) => void;
  onSetState: (id: string, state: "locked" | "hole", enabled: boolean) => void;
  onSetFeatureEnabled: (id: string, kind: ShapeFeatureKind, enabled: boolean) => void;
  onDeleteFeature: (id: string, kind: ShapeFeatureKind) => void;
  onDelete: (ids: string[]) => void;
  onGroup: () => void;
  onUngroup: () => void;
  shapeInspectorCollapsed?: boolean;
  shapeInspectorName?: string | null;
  onShapeInspectorExpand?: () => void;
  onEditSketch?: () => void;
  onExtrudeSketch?: () => void;
  onRename?: (id: string, name: string) => void;
  onOpenPlanes?: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(max-width: 760px)").matches) setCollapsed(true);
  }, []);
  const [query, setQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const normalizedQuery = query.trim().toLowerCase();
  const visibleShapes = useMemo(() => shapes.filter((shape) => matchesQuery(shape, normalizedQuery)), [normalizedQuery, shapes]);
  const selectedShapes = shapes.filter((shape) => selectedIds.includes(shape.id));
  const canGroup = selectedShapes.length > 1 && selectedShapes.every((shape) => !shape.locked && !isReferenceShape(shape));
  const canUngroup = selectedShapes.some((shape) => Boolean(shape.groupedShapes?.length));
  const hiddenCount = shapes.filter((shape) => shape.hidden).length;

  const toggleExpanded = (id: string) => setExpandedIds((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  if (collapsed) {
    return (
      <aside className="scene-overview-sidebar collapsed" aria-label="Scene overview">
        <button className="scene-sidebar-expand" type="button" title="Open scene overview" aria-label="Open scene overview" onClick={() => setCollapsed(false)}>
          <Boxes size={18} /><strong>Scene Inspect</strong><ChevronRight size={17} />
        </button>
        {shapeInspectorCollapsed ? (
          <button className="shape-inspector-rail-expand" type="button" title={`Open ${shapeInspectorName ?? "shape"} properties`} aria-label={`Open ${shapeInspectorName ?? "shape"} properties`} onClick={onShapeInspectorExpand}>
            <SlidersHorizontal size={18} /><strong>Shape Inspect</strong><ChevronRight size={17} />
          </button>
        ) : null}
      </aside>
    );
  }

  return (
    <aside className={`scene-overview-sidebar ${shapeInspectorCollapsed ? "shape-inspector-collapsed" : ""}`} aria-label="Scene overview">
      <header className="scene-sidebar-header">
        <div><Boxes size={18} /><strong>Scene</strong><span>{shapes.length}</span></div>
        <button type="button" title="Collapse scene overview" aria-label="Collapse scene overview" onClick={() => setCollapsed(true)}><ChevronLeft size={19} /></button>
      </header>
      <div className="scene-sidebar-summary">
        <span>{selectedIds.length} selected</span>
        <span>{hiddenCount} hidden</span>
      </div>
      {shapeInspectorCollapsed ? (
        <button className="shape-inspector-rail-expand scene-expanded" type="button" title={`Open ${shapeInspectorName ?? "shape"} properties`} aria-label={`Open ${shapeInspectorName ?? "shape"} properties`} onClick={onShapeInspectorExpand}>
          <SlidersHorizontal size={18} /><strong>Shape Inspect</strong><ChevronRight size={17} />
        </button>
      ) : null}
      <label className="scene-sidebar-search">
        <Search size={15} aria-hidden="true" />
        <input value={query} placeholder="Find shapes or features" aria-label="Find shapes or features" onChange={(event) => setQuery(event.currentTarget.value)} />
      </label>
      <div className="scene-sidebar-actions" aria-label="Scene actions">
        {onOpenPlanes ? <button type="button" disabled={actionsDisabled} onClick={onOpenPlanes}>Reference planes</button> : null}
        <button type="button" title="Group selected" disabled={actionsDisabled || !canGroup} onClick={onGroup}><Group size={17} /><span>Group</span></button>
        <button type="button" title="Ungroup selected" disabled={actionsDisabled || !canUngroup} onClick={onUngroup}><Ungroup size={17} /><span>Ungroup</span></button>
        <button className="danger" type="button" title="Delete selected" disabled={actionsDisabled || selectedIds.length === 0} onClick={() => onDelete(selectedIds)}><Trash2 size={17} /><span>Delete</span></button>
      </div>
      <div className="scene-shape-list" role="tree" aria-label="Scene shapes">
        {visibleShapes.map((shape) => {
          const selected = selectedIds.includes(shape.id);
          const hasChildren = Boolean(shape.groupedShapes?.length);
          const expanded = hasChildren && (expandedIds.has(shape.id) || Boolean(normalizedQuery));
          const features = shapeFeatureKinds(shape);
          return (
            <div className="scene-shape-tree-item" key={shape.id}>
              <div
                className={`scene-shape-row ${selected ? "selected" : ""} ${shape.hidden ? "hidden" : ""}`}
                role="treeitem"
                aria-selected={selected}
                aria-expanded={hasChildren ? expanded : undefined}
                tabIndex={0}
                onClick={(event) => onSelect(shape.id, event.shiftKey ? "toggle" : "replace")}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(shape.id, event.shiftKey ? "toggle" : "replace");
                  }
                }}
              >
                <button className="scene-shape-expand" type="button" disabled={!hasChildren} aria-label={expanded ? "Collapse group" : "Expand group"} onClick={(event) => { event.stopPropagation(); if (hasChildren) toggleExpanded(shape.id); }}>
                  {hasChildren ? expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} /> : <span />}
                </button>
                <span className="scene-shape-color" style={{ background: shape.color }} aria-hidden="true" />
                <span className="scene-shape-copy"><strong>{shape.name}</strong><small>{shapeTypeLabel(shape)}</small><ShapeBadges shape={shape} /></span>
                <button className="scene-shape-visibility" type="button" title={shape.hidden ? "Show shape" : "Hide shape"} aria-label={`${shape.hidden ? "Show" : "Hide"} ${shape.name}`} disabled={actionsDisabled} onClick={(event) => { event.stopPropagation(); onSetHidden(shape.id, !shape.hidden); }}>
                  {shape.hidden ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button className="scene-shape-delete" type="button" title="Delete shape" aria-label={`Delete ${shape.name}`} disabled={actionsDisabled || shape.locked && shape.kind !== "constructionPlane"} onClick={(event) => { event.stopPropagation(); onDelete([shape.id]); }}><Trash2 size={15} /></button>
              </div>
              {selected ? (
                <div className="scene-shape-properties" aria-label={`${shape.name} states and features`}>
                  {isReferenceShape(shape) && onRename ? <label>Name<input key={`${shape.id}:${shape.name}`} aria-label={`Rename ${shape.name}`} defaultValue={shape.name} maxLength={80} disabled={actionsDisabled} onBlur={(event) => { const name = event.currentTarget.value.trim(); if (name && name !== shape.name) onRename(shape.id, name); }} /></label> : null}
                  {shape.kind === "sketchProfile" ? <>
                    <button type="button" disabled={actionsDisabled || shape.locked} onClick={onEditSketch}>Edit saved sketch</button>
                    <button type="button" disabled={actionsDisabled || shape.locked} onClick={onExtrudeSketch}>Extrude saved sketch</button>
                    <small>Local 2D geometry · no solid volume</small>
                  </> : null}
                  {shape.sketchFeature?.kind === "extrusion" && shape.sketchFeature.sketchId ? <button type="button" onClick={() => onSelect(shape.sketchFeature?.kind === "extrusion" ? shape.sketchFeature.sketchId! : "")}>Select source sketch</button> : null}
                  <div className="scene-feature-section-label">States</div>
                  <button type="button" role="switch" aria-checked={!shape.hidden} disabled={actionsDisabled} onClick={() => onSetHidden(shape.id, !shape.hidden)}>
                    {!shape.hidden ? <Eye size={14} /> : <EyeOff size={14} />}<span>Visible</span><strong>{!shape.hidden ? "On" : "Off"}</strong>
                  </button>
                  <button type="button" role="switch" aria-checked={Boolean(shape.locked)} disabled={actionsDisabled} onClick={() => onSetState(shape.id, "locked", !shape.locked)}>
                    {shape.locked ? <Lock size={14} /> : <Unlock size={14} />}<span>Locked</span><strong>{shape.locked ? "On" : "Off"}</strong>
                  </button>
                  {!isReferenceShape(shape) ? <button type="button" role="switch" aria-checked={Boolean(shape.hole)} disabled={actionsDisabled} onClick={() => onSetState(shape.id, "hole", !shape.hole)}>
                    <Boxes size={14} /><span>Hole mode</span><strong>{shape.hole ? "On" : "Off"}</strong>
                  </button> : null}
                  {features.length ? <div className="scene-feature-section-label">Features</div> : null}
                  {features.map((kind) => {
                    const enabled = shapeFeatureEnabled(shape, kind);
                    const labels: Record<ShapeFeatureKind, string> = { edge: "Fillet / chamfer", sculpt: "Sculpt changes", sketch: "Sketch output", group: shape.groupOperation === "intersection" ? "Intersection" : "Group result" };
                    const deleteTitle = kind === "edge" && (shape.edgeTreatmentHistory?.length ?? 0) > 1
                      ? "Delete all fillet / chamfer features"
                      : kind === "sketch"
                        ? "Delete sketch output and model"
                        : kind === "group"
                          ? `Delete ${labels[kind].toLowerCase()} and restore operands`
                          : `Delete ${labels[kind]}`;
                    return (
                      <div className="scene-feature-row" key={kind}>
                        <button className="scene-feature-toggle" type="button" role="switch" aria-checked={enabled} disabled={actionsDisabled} onClick={() => onSetFeatureEnabled(shape.id, kind, !enabled)}>
                          {enabled ? <Eye size={14} /> : <EyeOff size={14} />}<span>{labels[kind]}</span><strong>{enabled ? "On" : "Off"}</strong>
                        </button>
                        <button className="scene-feature-delete" type="button" title={deleteTitle} aria-label={`${deleteTitle} from ${shape.name}`} disabled={actionsDisabled || shape.locked} onClick={() => onDeleteFeature(shape.id, kind)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : null}
              {expanded && shape.groupedShapes ? <GroupedShapeRows shapes={shape.groupedShapes} parentId={shape.id} query={normalizedQuery} onSelect={onSelect} /> : null}
            </div>
          );
        })}
        {visibleShapes.length === 0 ? <div className="scene-sidebar-empty">{shapes.length ? "No matching shapes" : "The scene is empty"}</div> : null}
      </div>
    </aside>
  );
}
