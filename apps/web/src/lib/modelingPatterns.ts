export type PatternOptions = { kind: "grid" | "circular"; counts: [number, number, number]; spacing: [number, number, number]; count: number; angle: number; axis: "x" | "y" | "z"; rotateCopies: boolean };
export type PatternStep = { offset: [number, number, number]; degrees: number };
export function modelingPatternSteps(options: PatternOptions, selectionCount: number): PatternStep[] {
  if (!Number.isInteger(selectionCount) || selectionCount < 1) throw new Error("Select at least one object");
  const count = options.kind === "grid" ? options.counts.reduce((a, b) => a * b, 1) : options.count;
  const counts = options.kind === "grid" ? options.counts : [options.count];
  if (counts.some((n) => !Number.isInteger(n) || n < 1 || n > 256) || count * selectionCount > 256) throw new Error("Patterns support up to 256 objects including originals");
  if (!options.spacing.every((n) => Number.isFinite(n) && Math.abs(n) <= 10000) || !Number.isFinite(options.angle) || Math.abs(options.angle) > 360) throw new Error("Invalid pattern spacing or angle");
  const steps: PatternStep[] = [];
  if (options.kind === "grid") {
    for (let x = 0; x < options.counts[0]; x++) for (let y = 0; y < options.counts[1]; y++) for (let z = 0; z < options.counts[2]; z++) {
      if (x || y || z) steps.push({ offset: [x * options.spacing[0], y * options.spacing[1], z * options.spacing[2]], degrees: 0 });
    }
  } else {
    const denominator = Math.abs(options.angle) === 360 ? count : Math.max(1, count - 1);
    for (let i = 1; i < count; i++) steps.push({ offset: [0, 0, 0], degrees: options.angle * i / denominator });
  }
  return steps;
}
