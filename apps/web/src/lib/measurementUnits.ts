import type { MeasurementAccuracy, WorkplaneWorkspaceSettings } from "@/types/sketchforge";

const MILLIMETERS_PER_INCH = 25.4;
const MILLIMETERS_PER_FOOT = 304.8;
const MILLIMETERS_PER_STUD = 8;
const VULGAR_FRACTIONS: Record<string, string> = {
  "¼": "1/4", "½": "1/2", "¾": "3/4", "⅐": "1/7", "⅑": "1/9", "⅒": "1/10",
  "⅓": "1/3", "⅔": "2/3", "⅕": "1/5", "⅖": "2/5", "⅗": "3/5", "⅘": "4/5",
  "⅙": "1/6", "⅚": "5/6", "⅛": "1/8", "⅜": "3/8", "⅝": "5/8", "⅞": "7/8",
};

type WorkspaceScaleOption = {
  label: string;
  displayLabel: string;
  millimetersPerDisplayUnit: number;
};

const METRIC_SCALE_OPTIONS: WorkspaceScaleOption[] = [
  { label: "1:1 (millimeters)", displayLabel: "mm", millimetersPerDisplayUnit: 1 },
  { label: "1:10 (centimeters)", displayLabel: "cm", millimetersPerDisplayUnit: 10 },
  { label: "1:1000 (meters)", displayLabel: "m", millimetersPerDisplayUnit: 1000 },
];

const IMPERIAL_SCALE_OPTIONS: WorkspaceScaleOption[] = [
  { label: "1:1 (inches)", displayLabel: "in", millimetersPerDisplayUnit: MILLIMETERS_PER_INCH },
  { label: "1:1 (feet)", displayLabel: "ft", millimetersPerDisplayUnit: MILLIMETERS_PER_FOOT },
];

const BRICK_SCALE_OPTIONS: WorkspaceScaleOption[] = [
  { label: "1:1 (studs)", displayLabel: "stud", millimetersPerDisplayUnit: MILLIMETERS_PER_STUD },
];

export const WORKSPACE_UNIT_OPTIONS = ["Metric (Default)", "Imperial", "Bricks"] as const;

export type LengthDisplayUnit = {
  label: string;
  millimetersPerUnit: number;
};

function scaleEntriesForUnits(units: string) {
  if (units === "Imperial") return IMPERIAL_SCALE_OPTIONS;
  if (units === "Bricks") return BRICK_SCALE_OPTIONS;
  return METRIC_SCALE_OPTIONS;
}

export function scaleOptionsForUnits(units: string) {
  return scaleEntriesForUnits(units).map((option) => option.label);
}

export function defaultScaleForUnits(units: string) {
  return scaleEntriesForUnits(units)[0].label;
}

export function normalizeScaleForUnits(units: string, scale: string) {
  const options = scaleEntriesForUnits(units);
  const normalizedScale = units !== "Imperial" && units !== "Bricks" && scale === "1:100 (meters)" ? "1:1000 (meters)" : scale;
  return options.some((option) => option.label === normalizedScale) ? normalizedScale : options[0].label;
}

function scaleEntryForWorkspace(workspace: Pick<WorkplaneWorkspaceSettings, "units" | "scale">) {
  const options = scaleEntriesForUnits(workspace.units);
  const normalizedScale = normalizeScaleForUnits(workspace.units, workspace.scale);
  return options.find((option) => option.label === normalizedScale) ?? options[0];
}

export function lengthDisplayUnit(workspace: Pick<WorkplaneWorkspaceSettings, "units" | "scale">): LengthDisplayUnit {
  const scale = scaleEntryForWorkspace(workspace);
  return { label: scale.displayLabel, millimetersPerUnit: scale.millimetersPerDisplayUnit };
}

export function millimetersToDisplay(value: number, workspace: Pick<WorkplaneWorkspaceSettings, "units" | "scale">) {
  return value / lengthDisplayUnit(workspace).millimetersPerUnit;
}

export function displayToMillimeters(value: number, workspace: Pick<WorkplaneWorkspaceSettings, "units" | "scale">) {
  return value * lengthDisplayUnit(workspace).millimetersPerUnit;
}

export function displayStepFromMillimeters(step: number, workspace: Pick<WorkplaneWorkspaceSettings, "units" | "scale">) {
  return step / lengthDisplayUnit(workspace).millimetersPerUnit;
}

export function parseMeasurementInput(value: string | number) {
  if (typeof value === "number") return Number.isFinite(value) ? value : Number.NaN;
  const expanded = value.trim().replace(/[¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g, (fraction, offset, input) => (
    `${offset > 0 && /\d/.test(input[offset - 1]) ? " " : ""}${VULGAR_FRACTIONS[fraction]}`
  ));
  const mixed = /^([+-]?\d+)(?:\s+|-)(\d+)\/(\d+)$/.exec(expanded);
  if (mixed) {
    const whole = Number(mixed[1]);
    const numerator = Number(mixed[2]);
    const denominator = Number(mixed[3]);
    if (!denominator) return Number.NaN;
    return (whole < 0 ? -1 : 1) * (Math.abs(whole) + numerator / denominator);
  }
  const fraction = /^([+-]?)(\d+)\/(\d+)$/.exec(expanded);
  if (fraction) {
    const denominator = Number(fraction[3]);
    if (!denominator) return Number.NaN;
    return (fraction[1] === "-" ? -1 : 1) * Number(fraction[2]) / denominator;
  }
  const compact = expanded.replace(/[\s\u00a0]/g, "");
  if (!compact) return Number.NaN;

  const commaIndex = compact.lastIndexOf(",");
  const dotIndex = compact.lastIndexOf(".");
  let normalized = compact;
  if (commaIndex >= 0 && dotIndex >= 0) {
    normalized = commaIndex > dotIndex
      ? compact.replace(/\./g, "").replace(",", ".")
      : compact.replace(/,/g, "");
  } else if (commaIndex >= 0) {
    normalized = compact.replace(",", ".");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function greatestCommonDivisor(a: number, b: number): number {
  return b ? greatestCommonDivisor(b, a % b) : Math.abs(a);
}

export function formatFractionalInches(value: number, denominator = 64) {
  if (!Number.isFinite(value) || !Number.isInteger(denominator) || denominator <= 0) return "";
  const rounded = Math.round(Math.abs(value) * denominator);
  const whole = Math.floor(rounded / denominator);
  const numerator = rounded % denominator;
  const sign = value < 0 && rounded ? "-" : "";
  if (!numerator) return `${sign}${whole}`;
  const divisor = greatestCommonDivisor(numerator, denominator);
  const fraction = `${numerator / divisor}/${denominator / divisor}`;
  return whole ? `${sign}${whole} ${fraction}` : `${sign}${fraction}`;
}

export function formatLengthForWorkspace(
  valueMm: number,
  workspace: Pick<WorkplaneWorkspaceSettings, "units" | "scale" | "accuracy" | "inchDisplay">,
) {
  const value = millimetersToDisplay(valueMm, workspace);
  return lengthDisplayUnit(workspace).label === "in" && workspace.inchDisplay !== "decimal"
    ? formatFractionalInches(value)
    : formatMeasurementNumber(value, workspace.accuracy);
}

export function formatMeasurementNumber(value: number, accuracy: MeasurementAccuracy, _step?: number) {
  let decimals = accuracy;
  while (decimals < 6 && value !== 0 && Math.abs(value) < 0.5 * 10 ** -decimals) {
    decimals += 1;
  }
  const zeroThreshold = 0.5 * 10 ** -decimals;
  return (Math.abs(value) < zeroThreshold ? 0 : value).toFixed(decimals);
}
