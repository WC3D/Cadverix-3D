// Adapted from henmedia/layerling objectSnap.ts (AGPL-3.0), f3092321.
export type SnapBox = { minX: number; maxX: number; minZ: number; maxZ: number };
export type ObjectSnapGuide = { axis: "x" | "z"; value: number; from: number; to: number };
export function objectSnapOffset(moving: SnapBox, targets: SnapBox[], threshold: number) {
  const lines = (min: number, max: number) => [min, (min + max) / 2, max];
  const offsets: { x: number | null; z: number | null } = { x: null, z: null };
  const guides: ObjectSnapGuide[] = [];
  if (!Number.isFinite(threshold) || threshold <= 0) return { ...offsets, guides };
  for (const axis of ["x", "z"] as const) {
    const own = axis === "x" ? lines(moving.minX, moving.maxX) : lines(moving.minZ, moving.maxZ);
    for (const target of targets) {
      const other = axis === "x" ? lines(target.minX, target.maxX) : lines(target.minZ, target.maxZ);
      for (const value of other) for (const start of own) {
        const delta = value - start;
        if (Math.abs(delta) <= threshold && (offsets[axis] === null || Math.abs(delta) < Math.abs(offsets[axis]!))) offsets[axis] = delta;
      }
    }
    if (offsets[axis] === null) continue;
    for (const target of targets) {
      const other = axis === "x" ? lines(target.minX, target.maxX) : lines(target.minZ, target.maxZ);
      for (const value of other) if (own.some((start) => Math.abs(start + offsets[axis]! - value) < 1e-6)) {
        const from = axis === "x" ? Math.min(moving.minZ, target.minZ) : Math.min(moving.minX, target.minX);
        const to = axis === "x" ? Math.max(moving.maxZ, target.maxZ) : Math.max(moving.maxX, target.maxX);
        const existing = guides.find((guide) => guide.axis === axis && Math.abs(guide.value - value) < 1e-6);
        if (existing) { existing.from = Math.min(existing.from, from); existing.to = Math.max(existing.to, to); }
        else guides.push({ axis, value, from, to });
      }
    }
  }
  return { ...offsets, guides };
}
