import type { RefObject, PointerEvent as ReactPointerEvent } from "react";
import { drawingEntityPoints, drawingPaper, type DrawingAnchor, type DrawingDimension, type DrawingEntity, type DrawingPoint, type DrawingSheet } from "@/lib/drawingSheet";
import { drawingDimensionGeometry, drawingDimensionIsStale, resolveDrawingAnchor, type DrawingViewResults } from "@/lib/drawingDimensions";

export type DrawingSelection = { kind: "view" | "entity" | "dimension"; id: string } | null;
export const drawingScaleLabel = (scale: number) => scale >= 1 ? `${Number(scale.toFixed(3))}:1` : `1:${Number((1 / scale).toFixed(3))}`;

function EntityGeometry({ entity }: { entity: DrawingEntity }) {
  const points = drawingEntityPoints(entity);
  if (entity.kind === "note") return <text x={entity.a[0]} y={entity.a[1]} fontSize="3.5" stroke="none" fill="#172333" transform={`rotate(${entity.angle} ${entity.a.join(" ")})`}>{entity.text.split("\n").map((line, index) => <tspan key={index} x={entity.a[0]} dy={index ? 4.5 : 0}>{line}</tspan>)}</text>;
  if (entity.kind === "circle") return <circle cx={entity.a[0]} cy={entity.a[1]} r={Math.hypot(entity.b[0] - entity.a[0], entity.b[1] - entity.a[1])} />;
  return <path d={points.map((p, i) => `${i ? "L" : "M"} ${p.join(" ")}`).join(" ") + (entity.kind === "rectangle" ? " Z" : "")} />;
}

export function DrawingDimensionSvg({ sheet, dimension, results }: { sheet: DrawingSheet; dimension: DrawingDimension; results: DrawingViewResults }) {
  const geometry = drawingDimensionGeometry(sheet, dimension, results);
  if (!geometry) return null;
  return <g data-drawing-kind="dimension" data-drawing-id={dimension.id} data-measurement={geometry.value} stroke="#172333" strokeWidth="0.18" fill="none">
    {geometry.guides.map(([a, b], index) => <path key={index} d={`M ${a.join(" ")} L ${b.join(" ")}`} />)}
    {geometry.line ? <path d={`M ${geometry.line[0].join(" ")} L ${geometry.line[1].join(" ")}`} markerStart={dimension.kind === "radius" || dimension.kind === "diameter" ? undefined : "url(#drawing-arrow)"} markerEnd="url(#drawing-arrow)" /> : null}
    {geometry.arc ? <path d={geometry.arc} markerStart="url(#drawing-arrow)" markerEnd="url(#drawing-arrow)" /> : null}
    <text x={geometry.text[0]} y={geometry.text[1]} fontSize={sheet.units === "in" ? 3.175 : 3.5} textAnchor="middle" fill="#172333" stroke="#ffffff" strokeWidth="1.2" paintOrder="stroke" data-dimension-label="true">{geometry.label}</text>
  </g>;
}

export function DrawingSheetSvg({ sheet, projectName, results, selection, pending, hover, draft, dimensionPreview, svgRef, pixelScale, onPointerDown, onPointerMove, onPointerUp, onPointerCancel }: {
  sheet: DrawingSheet; projectName: string; results: DrawingViewResults; selection: DrawingSelection;
  pending: DrawingAnchor[]; hover: { paper: DrawingPoint } | null; draft: DrawingEntity | null; dimensionPreview: DrawingDimension | null;
  svgRef: RefObject<SVGSVGElement | null>; pixelScale: number;
  onPointerDown: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerMove: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerUp: (event: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerCancel: () => void;
}) {
  const paper = drawingPaper(sheet);
  const titleWidth = Math.min(180, paper.width - paper.left - paper.margin);
  const titleX = paper.width - paper.margin - titleWidth, titleY = paper.height - paper.margin - 36;
  const hasPaperGeometry = sheet.entities.some((entity) => entity.kind !== "note");
  const scales = [...new Set([...sheet.views.map((view) => drawingScaleLabel(view.scale)), ...(hasPaperGeometry ? ["1:1"] : [])])];
  const field = (label: string, value: string, x: number, y: number, width: number) => <g>
    <text x={x + 2} y={y + 3} fontSize="1.8" fill="#53606c">{label}</text>
    <text x={x + 2} y={y + 7.5} fontSize="2.6" textLength={value.length > width / 1.6 ? width - 4 : undefined} lengthAdjust="spacingAndGlyphs">{value}</text>
  </g>;
  return <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" className="drawing-paper-svg" role="img" aria-label="CAD drawing sheet" viewBox={`0 0 ${paper.width} ${paper.height}`} width={paper.width * pixelScale} height={paper.height * pixelScale}
    style={{ touchAction: "none" }} fontFamily="Arial, Helvetica, sans-serif" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}>
    <title>{sheet.title || projectName} — {sheet.template}</title>
    <desc>Cadverix 3D technical drawing. Dimensions in {sheet.units}. {sheet.projection === "first" ? "First" : "Third"}-angle view arrangement.</desc>
    <defs>
      <marker id="drawing-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="3" markerHeight="1" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="#172333" /></marker>
      <clipPath id="drawing-content-clip"><rect x={paper.left} y={paper.margin} width={paper.width - paper.left - paper.margin} height={paper.height - paper.margin * 2 - 36} /></clipPath>
    </defs>
    <rect width={paper.width} height={paper.height} fill="#ffffff" />
    <rect x={paper.left} y={paper.margin} width={paper.width - paper.left - paper.margin} height={paper.height - paper.margin * 2} fill="none" stroke="#172333" strokeWidth="0.5" />
    <path data-drawing-ui="true" d={`M ${paper.left} ${titleY} H ${titleX}`} stroke="#b8c4cd" strokeWidth="0.15" strokeDasharray="2 2" />
    {[1, 2, 3, 4].map((zone) => <text key={zone} x={paper.left + (paper.width - paper.left - paper.margin) * (zone - 0.5) / 4} y={paper.margin - 3} textAnchor="middle" fontSize="2.5" fill="#53606c">{zone}</text>)}
    <g clipPath="url(#drawing-content-clip)">
      {sheet.views.map((view) => {
        const result = results.get(view.id), projection = result?.projection;
        if (!projection) return <g key={view.id} data-drawing-kind="view" data-drawing-id={view.id}>
          <rect x={view.x - 25} y={view.y - 10} width="50" height="20" fill="#fff4f2" stroke="#c33727" strokeWidth="0.3" />
          <text x={view.x} y={view.y} textAnchor="middle" fontSize="3" fill="#a8221c">Source unavailable</text>
        </g>;
        const selected = selection?.kind === "view" && selection.id === view.id;
        const stale = sheet.dimensions.some((d) => d.anchors[0]?.type === "view" && d.anchors[0].viewId === view.id && drawingDimensionIsStale(d, results));
        return <g key={view.id} data-drawing-kind="view" data-drawing-id={view.id}>
          <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
            <rect data-drawing-ui="true" x={-projection.width / 2 - 2 / view.scale} y={-projection.height / 2 - 2 / view.scale} width={projection.width + 4 / view.scale} height={projection.height + 4 / view.scale} fill="transparent" stroke={selected ? "#1684ca" : "none"} strokeWidth={0.3 / view.scale} strokeDasharray={`${2 / view.scale} ${1 / view.scale}`} />
            {view.showHidden ? <path d={projection.hiddenPath} fill="none" stroke="#73808d" strokeWidth={0.18 / view.scale} strokeDasharray={`${2 / view.scale} ${1 / view.scale}`} pointerEvents="none" /> : null}
            <path d={projection.visiblePath} fill="none" stroke="#172333" strokeWidth={0.35 / view.scale} pointerEvents="none" />
          </g>
          <text x={view.x} y={view.y + projection.height * view.scale / 2 + 5} fontSize="3" textAnchor="middle" fill="#172333">{view.name} · {drawingScaleLabel(view.scale)}</text>
          {stale ? <text x={view.x} y={view.y + projection.height * view.scale / 2 + 9} fontSize="2.6" fill="#b73625" textAnchor="middle">Dimensions need review</text> : null}
        </g>;
      })}
      {sheet.entities.map((entity) => <g key={entity.id} data-drawing-kind="entity" data-drawing-id={entity.id} stroke="#172333" strokeWidth="0.35" fill="none">
        <EntityGeometry entity={entity} />
        {selection?.kind === "entity" && selection.id === entity.id ? <g data-drawing-ui="true" stroke="#1684ca" fill="#ffffff">{drawingEntityPoints(entity).map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1" strokeWidth="0.3" />)}</g> : null}
      </g>)}
      {sheet.dimensions.map((dimension) => <g key={dimension.id}>
        <DrawingDimensionSvg sheet={sheet} dimension={dimension} results={results} />
        {selection?.kind === "dimension" && selection.id === dimension.id ? (() => {
          const geometry = drawingDimensionGeometry(sheet, dimension, results);
          return geometry ? <rect data-drawing-ui="true" x={geometry.text[0] - 12} y={geometry.text[1] - 4} width="24" height="6" fill="none" stroke="#1684ca" strokeWidth="0.25" /> : null;
        })() : null}
      </g>)}
      <g data-drawing-ui="true" pointerEvents="none" fill="none" stroke="#1684ca" strokeWidth="0.3">
        {draft ? <EntityGeometry entity={draft} /> : null}
        {dimensionPreview ? <DrawingDimensionSvg sheet={sheet} dimension={dimensionPreview} results={results} /> : null}
        {pending.map((anchor, i) => { const p = resolveDrawingAnchor(sheet, anchor, results)?.paper; return p ? <circle key={i} cx={p[0]} cy={p[1]} r="1.2" fill="#1684ca" /> : null; })}
        {hover ? <circle cx={hover.paper[0]} cy={hover.paper[1]} r="1.5" /> : null}
      </g>
    </g>
    <g fill="#172333" pointerEvents="none">
      {hasPaperGeometry && sheet.views.length && titleX - paper.left > 50 ? <text x={paper.left + 3} y={paper.height - paper.margin - 5} fontSize="2.5">Paper geometry: 1:1</text> : null}
      <rect x={titleX} y={titleY} width={titleWidth} height="36" fill="#ffffff" stroke="#172333" strokeWidth="0.4" />
      <path d={`M ${titleX} ${titleY + 14} h ${titleWidth} M ${titleX} ${titleY + 25} h ${titleWidth} M ${titleX + titleWidth / 2} ${titleY + 14} v 11 M ${titleX + titleWidth / 3} ${titleY + 25} v 11 M ${titleX + titleWidth * 2 / 3} ${titleY + 25} v 11`} fill="none" stroke="#172333" strokeWidth="0.25" />
      <text x={titleX + 3} y={titleY + 4} fontSize="2" fill="#53606c">CADVERIX 3D · {sheet.template} · {sheet.projection === "first" ? "FIRST" : "THIRD"} ANGLE</text>
      <text x={titleX + 3} y={titleY + 10} fontSize="4" textLength={(sheet.title || projectName).length > titleWidth / 2.5 ? titleWidth - 6 : undefined} lengthAdjust="spacingAndGlyphs">{sheet.title || projectName}</text>
      {field("DRAWING / REVISION", `${sheet.number || "—"} / ${sheet.revision}`, titleX, titleY + 14, titleWidth / 2)}
      {field("DRAWN BY / DATE", `${sheet.author || "—"} / ${sheet.date}`, titleX + titleWidth / 2, titleY + 14, titleWidth / 2)}
      {field("SCALE", scales.length === 1 ? scales[0]! : scales.length ? hasPaperGeometry ? "VIEWS AS SHOWN; DRAFT 1:1" : "AS SHOWN" : "1:1", titleX, titleY + 25, titleWidth / 3)}
      {field("DIMENSIONS IN", sheet.units, titleX + titleWidth / 3, titleY + 25, titleWidth / 3)}
      {field("SHEET", "1 / 1", titleX + titleWidth * 2 / 3, titleY + 25, titleWidth / 3)}
    </g>
  </svg>;
}

export function serializeDrawingSvg(svg: SVGSVGElement, sheet: DrawingSheet) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll("[data-drawing-ui]").forEach((node) => node.remove());
  clone.removeAttribute("class"); clone.removeAttribute("style");
  const paper = drawingPaper(sheet);
  clone.setAttribute("width", `${paper.width}mm`); clone.setAttribute("height", `${paper.height}mm`);
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
}
