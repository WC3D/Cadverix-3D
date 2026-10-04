"use client";
import { useState } from "react";
import type { PatternOptions } from "@/lib/modelingPatterns";

export function ModelingTools({ onClose, onPattern, onFace, onRotate, onShell, hasPivot, onClearPivot, disabled, patternCenter, pickingCenter, onPickCenter, onClearCenter, onCancelCenter }: {
  onClose: () => void; onPattern: (options: PatternOptions, preview: boolean) => void;
  onFace: (action: "flat" | "pivot") => void; onRotate: (degrees: number) => void;
  onShell: (thickness: number, opening: "top" | "bottom" | "both" | "closed") => void;
  hasPivot: boolean; onClearPivot: () => void; disabled: boolean;
  patternCenter: { x: number; y: number; z: number } | null;
  pickingCenter: boolean; onPickCenter: () => void; onClearCenter: () => void; onCancelCenter: () => void;
}) {
  const [options, setOptions] = useState<PatternOptions>({ kind: "grid", counts: [2, 1, 1], spacing: [30, 30, 30], count: 6, angle: 360, axis: "z", rotateCopies: true });
  const [angle, setAngle] = useState(45);
  const [thickness, setThickness] = useState(2);
  const [opening, setOpening] = useState<"top" | "bottom" | "both" | "closed">("top");
  if (pickingCenter) return <aside className="pattern-pick-prompt" aria-label="Pick pattern center"><span>Click or tap the active workplane to set the circular center.</span><button type="button" onClick={onCancelCenter}>Cancel picking</button></aside>;
  return <aside className="modeling-tools" aria-label="Modeling tools">
    <header><strong>Modeling tools</strong><button type="button" onClick={onClose}>Close</button></header>
    <fieldset disabled={disabled}><legend>3D pattern</legend>
      <label>Pattern type<select aria-label="3D pattern type" value={options.kind} onChange={(e) => setOptions({ ...options, kind: e.target.value as PatternOptions["kind"] })}><option value="grid">XYZ grid</option><option value="circular">Circular</option></select></label>
      {options.kind === "grid" ? ["X", "Y", "Z (height)"].map((axis, index) => <div key={axis} className="modeling-row"><label>{axis} count<input aria-label={`Pattern ${axis} count`} type="number" min="1" max="256" value={options.counts[index]} onChange={(e) => setOptions({ ...options, counts: options.counts.map((n, i) => i === index ? Number(e.target.value) : n) as [number, number, number] })} /></label><label>Spacing (mm)<input aria-label={`Pattern ${axis} spacing`} type="number" value={options.spacing[index]} onChange={(e) => setOptions({ ...options, spacing: options.spacing.map((n, i) => i === index ? Number(e.target.value) : n) as [number, number, number] })} /></label></div>) : <>
        <label>Count<input aria-label="Circular pattern count" type="number" min="1" max="256" value={options.count} onChange={(e) => setOptions({ ...options, count: Number(e.target.value) })} /></label>
        <label>Total angle (degrees)<input type="number" value={options.angle} onChange={(e) => setOptions({ ...options, angle: Number(e.target.value) })} /></label>
        <label>Axis<select value={options.axis} onChange={(e) => setOptions({ ...options, axis: e.target.value as PatternOptions["axis"] })}><option value="x">X</option><option value="y">Y</option><option value="z">Z (height)</option></select></label>
        <label><input type="checkbox" checked={options.rotateCopies} onChange={(e) => setOptions({ ...options, rotateCopies: e.target.checked })} />Rotate copies</label>
        <button type="button" onClick={onPickCenter}>Pick center on workplane</button>
        {patternCenter ? <button type="button" onClick={onClearCenter}>Clear workplane center</button> : null}
        <p aria-label="Circular pattern center">Center: {patternCenter ? `workplane point — X ${Number(patternCenter.x.toFixed(3))}, Y ${Number(patternCenter.z.toFixed(3))}, Z ${Number(patternCenter.y.toFixed(3))} mm` : hasPivot ? "picked face pivot" : "world origin"}.</p>
        <p>Count includes the originals. Picking uses the current snap step.</p>
      </>}
      <button type="button" onClick={() => onPattern(options, true)}>Preview pattern</button><button type="button" onClick={() => onPattern(options, false)}>Create pattern</button>
    </fieldset>
    <fieldset disabled={disabled}><legend>Face tools</legend>
      <button type="button" onClick={() => onFace("flat")}>Lay flat on face</button><button type="button" onClick={() => onFace("pivot")}>Pick face pivot</button>
      <p>{hasPivot ? "Face pivot set" : "No face pivot"}</p>
      <label>Rotation (degrees)<input type="number" aria-label="Pivot rotation angle" value={angle} onChange={(e) => setAngle(Number(e.target.value))} /></label>
      <button type="button" onClick={() => onRotate(angle)}>Rotate selection</button><button type="button" onClick={onClearPivot}>Clear pivot</button>
    </fieldset>
    <fieldset disabled={disabled}><legend>Shell / hollow</legend>
      <label>Wall thickness (mm)<input aria-label="Shell thickness" type="number" min="0.01" step="0.1" value={thickness} onChange={(e) => setThickness(Number(e.target.value))} /></label>
      <label>Opening<select aria-label="Shell opening" value={opening} onChange={(e) => setOpening(e.target.value as typeof opening)}><option value="top">Top</option><option value="bottom">Bottom</option><option value="both">Top and bottom</option><option value="closed">Closed cavity</option></select></label>
      <button type="button" onClick={() => onShell(thickness, opening)}>Apply shell</button><p>One solid at a time. Invalid wall thicknesses leave the original intact. Openings follow the vertical Z axis.</p>
    </fieldset>
  </aside>;
}
