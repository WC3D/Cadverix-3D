/*
 * Wie rund ist rund? Die Zahlen dazu stehen nur hier. Das Programm rechnet
 * mit ihnen, und die Anleitung liest sie beim Bauen mit {{value:NAME}} aus
 * dieser Datei (scripts/build-guide.mjs) - so koennen Text und Code nicht
 * auseinanderlaufen. Deshalb importiert diese Datei nichts: der Anleitungsbau
 * laedt sie ohne den Rest des Programms.
 */

/** Wie weit ein Vieleck vom echten Kreis abweichen darf, bevor man es sieht. */
export const ROUND_DEVIATION_TOLERANCE = 0.005;

/** Unter vierundzwanzig Seiten sieht auch ein kleiner Stift eckig aus. */
export const MIN_AUTOMATIC_SIDES = 24;

/** Toleranz, unter der ein Vieleck als exakter Kreis behandelt werden kann. */
export const EXACT_ROUND_TOLERANCE = 0.05;

export const ROUND_FROM_SIDES = 96;
export const ROUND_FROM_SPHERE_STEPS = 24;
export const ROUND_FROM_HALF_SPHERE_STEPS = 32;
export const ROUND_FROM_ROOF_SIDES = 64;

export function drawnRound(set: number | null | undefined, roundFrom: number, corners: number, width: number, depth: number) {
  if (set === undefined || set === null || !Number.isFinite(set)) return true;
  if (Math.round(set) >= roundFrom) return true;
  const radius = Math.max(width, depth) / 2;
  return radius * (1 - Math.cos(Math.PI / Math.max(3, corners))) <= EXACT_ROUND_TOLERANCE;
}
