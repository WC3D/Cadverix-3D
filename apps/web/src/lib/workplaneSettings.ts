import type { GridSize, HistoryRetentionLimit, MeasurementAccuracy, ShapeCustomization, ShapeCustomizationMap, ShapeKind, WorkplaneWorkspaceSettings } from "@/types/sketchforge";
import { normalizeScaleForUnits } from "@/lib/measurementUnits";
import { defaultThemes, type AppTheme } from "@/lib/themes";
import { DEFAULT_WORKPLANE_GRID_COLOR } from "@/lib/workplaneGrid";
import { normalizeDrawingSheet } from "@/lib/drawingSheet";

export const DEFAULT_SNAP_GRID: GridSize = "1.0 mm";
export const BRICK_SNAP_STEP = 8;
// Used only when the snap grid is off, so arrow keys keep their old feel.
export const KEYBOARD_NUDGE_FALLBACK_STEP = 1;
// Shift has always moved five times as far as a plain arrow press.
export const KEYBOARD_NUDGE_COARSE_FACTOR = 5;
export const MIN_CUSTOM_SHAPE_DIMENSION = 0.01;
export const MAX_CUSTOM_SHAPE_DIMENSION = 2000;
export const MAX_HIGH_RESOLUTION_SIDES = 512;

export const DEFAULT_WORKPLANE_WORKSPACE: WorkplaneWorkspaceSettings = {
  width: 200,
  depth: 200,
  sizePreset: "200 x 200 mm",
  gridBlockSize: 5,
  gridBlockPreset: "5 mm",
  gridColor: DEFAULT_WORKPLANE_GRID_COLOR,
  background: "#f8fbfc",
  themeId: "light",
  showShadows: true,
  showGrid: true,
  cruiseShapes: true,
  selectBeforeMove: false,
  zoomSpeed: 5,
  units: "Metric (Default)",
  scale: "1:1 (millimeters)",
  accuracy: 2,
  historyLimit: 100,
  shapeCustomizations: {},
};

export const METRIC_SNAP_GRIDS: GridSize[] = ["Off", "0.1 mm", "0.25 mm", "0.5 mm", "1.0 mm", "2.0 mm", "5.0 mm"];
export const IMPERIAL_SNAP_GRIDS: GridSize[] = ["Off", "1/64 in", "1/32 in", "1/16 in", "1/8 in", "1/4 in", "1/2 in", "1 in"];
const snapGridOptions: GridSize[] = [...METRIC_SNAP_GRIDS, ...IMPERIAL_SNAP_GRIDS.slice(1), "Brick"];
const customizableShapeKinds: ShapeKind[] = [
  "box", "cylinder", "sphere", "sketch", "scribble", "cone", "pyramid", "roof", "text", "roundRoof",
  "halfSphere", "torus", "tube", "gear", "screw", "washer", "nut", "ring", "wedge", "polygon", "icosahedron", "mesh",
  "roundedBox", "ellipse", "slot", "star", "heart", "crescent", "teardrop", "counterbore", "countersink", "dovetail", "spring", "honeycomb",
  "bentTube",
];

function numberOrDefault(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringOrDefault(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function colorOrDefault(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim()) ? value : fallback;
}

function booleanOrDefault(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function accuracyOrDefault(value: unknown, fallback: MeasurementAccuracy) {
  return value === 1 || value === 2 || value === 3 ? value : fallback;
}

function historyLimitOrDefault(value: unknown, fallback: HistoryRetentionLimit): HistoryRetentionLimit {
  if (value === "unlimited") return value;
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(5000, Math.max(1, Math.round(value)));
}

function optionalShapeDimension(value: unknown, fallback: number | undefined) {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(MAX_CUSTOM_SHAPE_DIMENSION, Math.max(MIN_CUSTOM_SHAPE_DIMENSION, value));
}

function optionalShapeNumber(value: unknown, fallback: number | undefined, min: number, max: number, integer = false) {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const normalized = Math.min(max, Math.max(min, value));
  return integer ? Math.round(normalized) : normalized;
}

function optionalShapeText(value: unknown, fallback: string | undefined, maxLength: number) {
  if (value === undefined) return fallback;
  if (typeof value !== "string") return fallback;
  return value.slice(0, maxLength) || " ";
}

export function normalizeShapeCustomizations(value: unknown, fallback: ShapeCustomizationMap = {}): ShapeCustomizationMap {
  const candidate = value && typeof value === "object" ? value as Partial<Record<ShapeKind, unknown>> : {};
  const normalized: ShapeCustomizationMap = {};
  customizableShapeKinds.forEach((kind) => {
    const raw = candidate[kind];
    const source = raw && typeof raw === "object" ? raw as Partial<ShapeCustomization> : {};
    const fallbackEntry = fallback[kind];
    const entry: ShapeCustomization = {
      width: optionalShapeDimension(source.width, fallbackEntry?.width),
      depth: optionalShapeDimension(source.depth, fallbackEntry?.depth),
      height: optionalShapeDimension(source.height, fallbackEntry?.height),
      maxDimension: optionalShapeDimension(source.maxDimension, fallbackEntry?.maxDimension),
    };
    if (kind === "sphere" || kind === "halfSphere") {
      entry.steps = optionalShapeNumber(source.steps, fallbackEntry?.steps, 6, 64, true);
    }
    if (["cylinder", "cone", "ellipse", "slot", "teardrop", "counterbore", "countersink"].includes(kind)) {
      entry.sides = optionalShapeNumber(source.sides, fallbackEntry?.sides, 3, MAX_HIGH_RESOLUTION_SIDES, true);
    } else if (kind === "pyramid") {
      entry.sides = optionalShapeNumber(source.sides, fallbackEntry?.sides, 3, 24, true);
    } else if (kind === "roundRoof") {
      entry.sides = optionalShapeNumber(source.sides, fallbackEntry?.sides, 4, MAX_HIGH_RESOLUTION_SIDES, true);
    }
    if (kind === "cone") {
      entry.topRadius = optionalShapeNumber(source.topRadius, fallbackEntry?.topRadius, 0, MAX_CUSTOM_SHAPE_DIMENSION / 2);
      entry.baseRadius = optionalShapeNumber(source.baseRadius, fallbackEntry?.baseRadius, MIN_CUSTOM_SHAPE_DIMENSION, MAX_CUSTOM_SHAPE_DIMENSION / 2);
    }
    if (kind === "tube" || kind === "ring") {
      entry.bevel = optionalShapeNumber(source.bevel, fallbackEntry?.bevel, 0.5, 20);
    }
    if (kind === "text") {
      entry.text = optionalShapeText(source.text, fallbackEntry?.text, 24);
      entry.font = source.font === undefined
        ? fallbackEntry?.font
        : ["Multilanguage", "Sans", "Serif", "Script", "Monospace", "Rounded", "Stencil"].includes(source.font)
          ? source.font
          : fallbackEntry?.font;
      entry.bevel = optionalShapeNumber(source.bevel, fallbackEntry?.bevel, 0, 8);
      entry.segments = optionalShapeNumber(source.segments, fallbackEntry?.segments, 0, 24, true);
    }
    if (kind === "gear") {
      entry.teeth = optionalShapeNumber(source.teeth, fallbackEntry?.teeth, 6, 64, true);
      entry.toothSize = optionalShapeNumber(source.toothSize, fallbackEntry?.toothSize, 0.2, MAX_CUSTOM_SHAPE_DIMENSION / 2);
      entry.toothWidth = optionalShapeNumber(source.toothWidth, fallbackEntry?.toothWidth, MIN_CUSTOM_SHAPE_DIMENSION, MAX_CUSTOM_SHAPE_DIMENSION);
      entry.centerHoleSize = optionalShapeNumber(source.centerHoleSize, fallbackEntry?.centerHoleSize, 0, MAX_CUSTOM_SHAPE_DIMENSION);
      entry.gearType = source.gearType === undefined
        ? fallbackEntry?.gearType
        : source.gearType === "spur" || source.gearType === "helical" || source.gearType === "bevel"
          ? source.gearType
          : fallbackEntry?.gearType;
      entry.helixAngle = optionalShapeNumber(source.helixAngle, fallbackEntry?.helixAngle, -45, 45);
      entry.helixQuality = optionalShapeNumber(source.helixQuality, fallbackEntry?.helixQuality, 4, 32, true);
    }
    if (kind === "roundedBox") {
      entry.cornerFillet = optionalShapeNumber(source.cornerFillet, fallbackEntry?.cornerFillet, 0, MAX_CUSTOM_SHAPE_DIMENSION / 2);
      entry.topBottomFillet = optionalShapeNumber(source.topBottomFillet, fallbackEntry?.topBottomFillet, 0, MAX_CUSTOM_SHAPE_DIMENSION / 2);
      entry.roundedBoxQuality = optionalShapeNumber(source.roundedBoxQuality, fallbackEntry?.roundedBoxQuality, 2, 32, true);
    }
    if (kind === "star") {
      entry.starPoints = optionalShapeNumber(source.starPoints, fallbackEntry?.starPoints, 3, 32, true);
      entry.starInnerSize = optionalShapeNumber(source.starInnerSize, fallbackEntry?.starInnerSize, 0.01, MAX_CUSTOM_SHAPE_DIMENSION);
      entry.starOuterFillet = optionalShapeNumber(source.starOuterFillet, fallbackEntry?.starOuterFillet, 0, 80);
      entry.starInnerFillet = optionalShapeNumber(source.starInnerFillet, fallbackEntry?.starInnerFillet, 0, 80);
      entry.starQuality = optionalShapeNumber(source.starQuality, fallbackEntry?.starQuality, 4, 48, true);
    }
    if (kind === "heart") {
      entry.heartTipFillet = optionalShapeNumber(source.heartTipFillet, fallbackEntry?.heartTipFillet, 0, 80);
      entry.heartQuality = optionalShapeNumber(source.heartQuality, fallbackEntry?.heartQuality, 8, 96, true);
    }
    if (kind === "crescent") {
      entry.crescentThickness = optionalShapeNumber(source.crescentThickness, fallbackEntry?.crescentThickness, 0.01, MAX_CUSTOM_SHAPE_DIMENSION);
      entry.crescentTipFillet = optionalShapeNumber(source.crescentTipFillet, fallbackEntry?.crescentTipFillet, 0, 80);
      entry.crescentQuality = optionalShapeNumber(source.crescentQuality, fallbackEntry?.crescentQuality, 8, 96, true);
    }
    if (kind === "counterbore" || kind === "countersink") {
      entry.screwHoleShaft = optionalShapeNumber(source.screwHoleShaft, fallbackEntry?.screwHoleShaft, 0.01, MAX_CUSTOM_SHAPE_DIMENSION);
      entry.screwHoleHeadDepth = optionalShapeNumber(source.screwHoleHeadDepth, fallbackEntry?.screwHoleHeadDepth, 0.01, MAX_CUSTOM_SHAPE_DIMENSION);
      entry.screwHoleAngle = optionalShapeNumber(source.screwHoleAngle, fallbackEntry?.screwHoleAngle, 30, 150);
    }
    if (kind === "dovetail") {
      entry.dovetailNeckWidth = optionalShapeNumber(source.dovetailNeckWidth, fallbackEntry?.dovetailNeckWidth, 0.01, MAX_CUSTOM_SHAPE_DIMENSION);
      entry.dovetailClearance = optionalShapeNumber(source.dovetailClearance, fallbackEntry?.dovetailClearance, 0, 5);
    }
    if (kind === "spring") {
      entry.springTurns = optionalShapeNumber(source.springTurns, fallbackEntry?.springTurns, 1, 60, true);
      entry.springWire = optionalShapeNumber(source.springWire, fallbackEntry?.springWire, 0.3, MAX_CUSTOM_SHAPE_DIMENSION);
      entry.springQuality = optionalShapeNumber(source.springQuality, fallbackEntry?.springQuality, 12, 96, true);
    }
    if (kind === "honeycomb") {
      entry.honeycombCellSize = optionalShapeNumber(source.honeycombCellSize, fallbackEntry?.honeycombCellSize, 2, 100);
      entry.honeycombWallThickness = optionalShapeNumber(source.honeycombWallThickness, fallbackEntry?.honeycombWallThickness, 0.4, 50);
      entry.honeycombFrameWidth = optionalShapeNumber(source.honeycombFrameWidth, fallbackEntry?.honeycombFrameWidth, 0, 100);
    }
    if (kind === "bentTube") {
      entry.bentTubeSize = optionalShapeNumber(source.bentTubeSize, fallbackEntry?.bentTubeSize, 1, 500);
      entry.bentTubeWall = optionalShapeNumber(source.bentTubeWall, fallbackEntry?.bentTubeWall, 0.2, 250);
      entry.bentTubeQuality = optionalShapeNumber(source.bentTubeQuality, fallbackEntry?.bentTubeQuality, 12, 96, true);
      entry.bentTubeSegments = Array.isArray(source.bentTubeSegments)
        ? source.bentTubeSegments.slice(0, 12).map((segment) => ({ ...segment }))
        : fallbackEntry?.bentTubeSegments?.map((segment) => ({ ...segment }));
    }
    const compact = Object.fromEntries(Object.entries(entry).filter(([, entryValue]) => entryValue !== undefined)) as ShapeCustomization;
    if (Object.keys(compact).length > 0) normalized[kind] = compact;
  });
  return normalized;
}

export function shapeDimensionLimit(workspace: WorkplaneWorkspaceSettings, kind: ShapeKind, appDefault: number) {
  return workspace.shapeCustomizations[kind]?.maxDimension ?? appDefault;
}

export function normalizeSnapGrid(value: unknown, fallback: GridSize = DEFAULT_SNAP_GRID): GridSize {
  return snapGridOptions.includes(value as GridSize) ? (value as GridSize) : fallback;
}

export function snapGridOptionsForUnits(units: string): GridSize[] {
  if (units === "Imperial") return IMPERIAL_SNAP_GRIDS;
  if (units === "Bricks") return ["Off", "Brick"];
  return METRIC_SNAP_GRIDS;
}

export function snapGridForUnits(units: string, current: GridSize): GridSize {
  const options = snapGridOptionsForUnits(units);
  if (options.includes(current)) return current;
  return units === "Imperial" ? "1/8 in" : units === "Bricks" ? "Brick" : DEFAULT_SNAP_GRID;
}

function themeOrDefault(value: unknown, fallback: AppTheme | undefined): AppTheme | undefined {
  if (!value || typeof value !== "object") return fallback;
  const t = value as Record<string, unknown>;
  if (typeof t.id !== "string" || typeof t.name !== "string" || !t.ui || typeof t.ui !== "object" || !t.viewport || typeof t.viewport !== "object") {
    return fallback;
  }
  return value as AppTheme;
}

const VALID_THEME_IDS = new Set([...Object.keys(defaultThemes), "custom"]);
/** Step the snap grid setting represents, in millimetres. "Off" yields 0. */
export function snapGridStep(size: GridSize) {
  if (size === "Off") {
    return 0;
  }
  if (size === "Brick") {
    return BRICK_SNAP_STEP;
  }
  if (size.endsWith(" in")) {
    const fraction = size.slice(0, -3);
    const [numerator, denominator = "1"] = fraction.split("/");
    return Number(numerator) / Number(denominator) * 25.4;
  }
  return Number.parseFloat(size) || 1;
}

/**
 * Distance one arrow-key press moves the selection.
 *
 * Pointer dragging has always snapped to the snap grid, while the keyboard
 * moved a hard-coded millimetre. With the grid at 5mm a drag landed on the
 * 5mm lattice and the very next arrow press pushed the shape off it again.
 * Following the grid keeps an aligned shape aligned; Shift keeps its former
 * meaning of a coarser step. With the grid off, the old 1mm and 5mm stand.
 */
export function keyboardNudgeStep(size: GridSize, coarse: boolean) {
  const grid = snapGridStep(size);
  const base = grid > 0 ? grid : KEYBOARD_NUDGE_FALLBACK_STEP;
  return coarse ? base * KEYBOARD_NUDGE_COARSE_FACTOR : base;
}

export function normalizeWorkspaceSettings(value: unknown, fallback: WorkplaneWorkspaceSettings = DEFAULT_WORKPLANE_WORKSPACE): WorkplaneWorkspaceSettings {
  const candidate = value && typeof value === "object" ? (value as Partial<WorkplaneWorkspaceSettings>) : {};
  const units = stringOrDefault(candidate.units, fallback.units);
  const fallbackThemeId = VALID_THEME_IDS.has(fallback.themeId ?? "") ? fallback.themeId : "light";
  const themeId = VALID_THEME_IDS.has(candidate.themeId ?? "") ? candidate.themeId : fallbackThemeId;
  const customTheme = themeOrDefault(candidate.customTheme, fallback.customTheme);
  const drawing = normalizeDrawingSheet(candidate.drawing ?? fallback.drawing);
  return {
    width: numberOrDefault(candidate.width, fallback.width),
    depth: numberOrDefault(candidate.depth, fallback.depth),
    sizePreset: stringOrDefault(candidate.sizePreset, fallback.sizePreset),
    gridBlockSize: numberOrDefault(candidate.gridBlockSize, fallback.gridBlockSize),
    gridBlockPreset: stringOrDefault(candidate.gridBlockPreset, fallback.gridBlockPreset),
    gridColor: colorOrDefault(candidate.gridColor, fallback.gridColor),
    background: stringOrDefault(candidate.background, fallback.background),
    themeId,
    ...(customTheme ? { customTheme } : {}),
    showShadows: booleanOrDefault(candidate.showShadows, fallback.showShadows),
    showGrid: booleanOrDefault(candidate.showGrid, fallback.showGrid),
    cruiseShapes: booleanOrDefault(candidate.cruiseShapes, fallback.cruiseShapes),
    selectBeforeMove: booleanOrDefault(candidate.selectBeforeMove, fallback.selectBeforeMove),
    zoomSpeed: numberOrDefault(candidate.zoomSpeed, fallback.zoomSpeed),
    units,
    scale: normalizeScaleForUnits(units, stringOrDefault(candidate.scale, fallback.scale)),
    accuracy: accuracyOrDefault(candidate.accuracy, fallback.accuracy),
    historyLimit: historyLimitOrDefault(candidate.historyLimit, fallback.historyLimit),
    shapeCustomizations: normalizeShapeCustomizations(candidate.shapeCustomizations, fallback.shapeCustomizations),
    ...(drawing ? { drawing } : {}),
  };
}

export function canBeginShapeDrag(selectBeforeMove: boolean, alreadySelected: boolean) {
  return !selectBeforeMove || alreadySelected;
}

export function workplaneSettingsFingerprint(workspace: WorkplaneWorkspaceSettings, snapGrid: GridSize) {
  return JSON.stringify({ workspace, snapGrid });
}

export function workspaceHydrationSyncDecision(pendingFingerprint: string | null, currentFingerprint: string) {
  if (pendingFingerprint === null) {
    return { shouldSync: true, pendingFingerprint: null };
  }
  return {
    shouldSync: false,
    pendingFingerprint: currentFingerprint === pendingFingerprint ? null : pendingFingerprint,
  };
}

export function workspaceHydrationRequired(
  keyChanged: boolean,
  lastSyncedFingerprint: string,
  currentFingerprint: string,
  nextFingerprint: string,
) {
  return keyChanged || lastSyncedFingerprint !== nextFingerprint || currentFingerprint !== nextFingerprint;
}
