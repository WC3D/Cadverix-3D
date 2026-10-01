import { MAX_HIGH_RESOLUTION_SIDES } from "@/lib/workplaneSettings";
import { MIN_AUTOMATIC_SIDES, ROUND_DEVIATION_TOLERANCE } from "@/lib/roundness";

export { MIN_AUTOMATIC_SIDES, ROUND_DEVIATION_TOLERANCE };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function automaticSideCount(width: number, depth: number, tolerance = ROUND_DEVIATION_TOLERANCE) {
  const radius = Math.max(0.01, Math.max(width, depth) / 2);
  const cosine = clamp(1 - Math.max(1e-9, tolerance) / radius, -1, 1);
  const needed = Math.PI / Math.max(1e-9, Math.acos(cosine));
  const rounded = Math.ceil(needed / 4) * 4;
  return clamp(rounded, MIN_AUTOMATIC_SIDES, MAX_HIGH_RESOLUTION_SIDES);
}

export function roundSideCount(sides: number | undefined, width: number, depth: number) {
  return sides ?? automaticSideCount(width, depth);
}
