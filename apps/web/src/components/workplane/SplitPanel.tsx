"use client";

import { Check, LoaderCircle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { displayStepFromMillimeters, displayToMillimeters, formatMeasurementNumber, lengthDisplayUnit, millimetersToDisplay, parseMeasurementInput } from "@/lib/measurementUnits";
import { splitRotationAxes, type SplitRotation } from "@/lib/modelSplit";
import type { AlignAxis, WorkplaneWorkspaceSettings } from "@/types/sketchforge";

export function SplitPanel({
  axis,
  rotation,
  position,
  min,
  max,
  targetCount,
  workspace,
  busy,
  error,
  onAxisChange,
  onRotationChange,
  onPositionChange,
  onApply,
  onCancel,
}: {
  axis: AlignAxis;
  rotation: SplitRotation;
  position: number;
  min: number;
  max: number;
  targetCount: number;
  workspace: WorkplaneWorkspaceSettings;
  busy: boolean;
  error: string | null;
  onAxisChange: (axis: AlignAxis) => void;
  onRotationChange: (index: 0 | 1, rotation: number) => void;
  onPositionChange: (position: number) => void;
  onApply: () => void;
  onCancel: () => void;
}) {
  const panelRef = useRef<HTMLElement | null>(null);
  const displayPosition = millimetersToDisplay(position, workspace);
  const displayMin = millimetersToDisplay(min, workspace);
  const displayMax = millimetersToDisplay(max, workspace);
  const displayStep = displayStepFromMillimeters(0.1, workspace);
  const unit = lengthDisplayUnit(workspace).label;
  const formattedPosition = formatMeasurementNumber(displayPosition, workspace.accuracy, displayStep);
  const rotationAxes = splitRotationAxes(axis);
  const [positionEditing, setPositionEditing] = useState(false);
  const [positionDraft, setPositionDraft] = useState(formattedPosition);
  const applyDisplayPosition = (value: number) => {
    if (Number.isFinite(value)) onPositionChange(displayToMillimeters(value, workspace));
  };
  useEffect(() => {
    if (!positionEditing) setPositionDraft(formattedPosition);
  }, [formattedPosition, positionEditing]);
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);
  const commitPositionDraft = () => {
    const value = parseMeasurementInput(positionDraft);
    if (Number.isFinite(value)) applyDisplayPosition(value);
    setPositionEditing(false);
  };
  return (
    <aside className="split-panel" ref={panelRef} tabIndex={-1} aria-labelledby="split-panel-title">
      <div className="split-panel-header">
        <div>
          <strong id="split-panel-title">Split by plane</strong>
          <span>Position the plane, then create two bodies</span>
        </div>
        <button type="button" aria-label="Cancel split" onClick={onCancel}><X size={20} /></button>
      </div>

      <div className="split-panel-target">
        <strong>{targetCount} selected object{targetCount === 1 ? "" : "s"}</strong>
        <span>Each intersected object will become two closed meshes.</span>
      </div>

      <fieldset className="split-axis-control" disabled={busy}>
        <legend>Plane orientation</legend>
        <div>
          {(["x", "y", "z"] as AlignAxis[]).map((candidate) => (
            <button
              type="button"
              className={axis === candidate ? "active" : ""}
              aria-pressed={axis === candidate}
              key={candidate}
              onClick={() => onAxisChange(candidate)}
            >
              {candidate.toUpperCase()}
            </button>
          ))}
        </div>
      </fieldset>

      {rotationAxes.map((rotationAxis, index) => (
        <SplitRotationControl
          key={rotationAxis}
          axisLabel={rotationAxis.toUpperCase() as "X" | "Y" | "Z"}
          rotation={rotation[index]}
          busy={busy}
          onChange={(value) => onRotationChange(index as 0 | 1, value)}
        />
      ))}

      <div className="split-position-control">
        <span>
          <strong>Plane position</strong>
          <span className="split-position-value">
            <input
              type="text"
              inputMode="decimal"
              value={positionEditing ? positionDraft : formattedPosition}
              aria-label="Split plane position"
              aria-describedby="split-position-unit"
              disabled={busy}
              onFocus={() => {
                setPositionDraft(formattedPosition);
                setPositionEditing(true);
              }}
              onChange={(event) => setPositionDraft(event.currentTarget.value)}
              onBlur={commitPositionDraft}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.stopPropagation();
                  event.currentTarget.blur();
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  setPositionDraft(formattedPosition);
                }
              }}
            />
            <small id="split-position-unit">{unit}</small>
          </span>
        </span>
        <input
          type="range"
          min={displayMin}
          max={displayMax}
          step={displayStep}
          value={displayPosition}
          aria-label="Split plane position slider"
          aria-valuetext={`${formattedPosition} ${unit}`}
          disabled={busy}
          onChange={(event) => applyDisplayPosition(event.currentTarget.valueAsNumber)}
        />
      </div>

      <p className="split-panel-help">The translucent plane previews the exact cut. Set Rotation to 45 deg for an angled cut.</p>
      {error ? <div className="split-panel-error" role="alert">{error}</div> : null}

      <div className="split-panel-footer">
        <button type="button" className="secondary" disabled={busy} onClick={onCancel}>Cancel</button>
        <button type="button" className="primary" disabled={busy || max - min <= 0.0001} onClick={onApply}>
          {busy ? <LoaderCircle className="split-panel-spinner" size={17} /> : <Check size={17} />}
          {busy ? "Splitting" : "Split model"}
        </button>
      </div>
    </aside>
  );
}

function SplitRotationControl({
  axisLabel,
  rotation,
  busy,
  onChange,
}: {
  axisLabel: "X" | "Y" | "Z";
  rotation: number;
  busy: boolean;
  onChange: (rotation: number) => void;
}) {
  const formatted = String(Number(rotation.toFixed(2)));
  const unitId = `split-rotation-${axisLabel.toLowerCase()}-unit`;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(formatted);
  useEffect(() => {
    if (!editing) setDraft(formatted);
  }, [formatted, editing]);
  const commitDraft = () => {
    const value = parseMeasurementInput(draft);
    if (Number.isFinite(value)) onChange(value);
    setEditing(false);
  };

  return (
    <div className="split-position-control split-rotation-control">
      <span>
        <strong>Rotation around {axisLabel}</strong>
        <span className="split-position-value">
          <input
            type="text"
            inputMode="decimal"
            value={editing ? draft : formatted}
            aria-label={`Split plane rotation around ${axisLabel} axis`}
            aria-describedby={unitId}
            disabled={busy}
            onFocus={() => {
              setDraft(formatted);
              setEditing(true);
            }}
            onChange={(event) => setDraft(event.currentTarget.value)}
            onBlur={commitDraft}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.stopPropagation();
                event.currentTarget.blur();
              } else if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                setDraft(formatted);
                setEditing(false);
              }
            }}
          />
          <small id={unitId}>deg</small>
        </span>
      </span>
      <input
        type="range"
        min={-180}
        max={180}
        step={1}
        value={rotation}
        aria-label={`Split plane rotation around ${axisLabel} axis slider`}
        aria-valuetext={`${formatted} degrees around ${axisLabel} axis`}
        disabled={busy}
        onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
      />
    </div>
  );
}
