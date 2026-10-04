import { describe, expect, it } from "vitest";
import { modelingPatternSteps, type PatternOptions } from "@/lib/modelingPatterns";
import { copySketchSelection, pasteSketchSelection } from "@/lib/sketchClipboard";
import { treatSketchCorner } from "@/lib/sketchCorners";
import { storageCapabilities } from "@/lib/storageCapabilities";
import { formatLengthForWorkspace, displayToMillimeters, parseMeasurementInput } from "@/lib/measurementUnits";
import { DEFAULT_WORKPLANE_WORKSPACE, normalizeWorkspaceSettings } from "@/lib/workplaneSettings";
import type { SketchProfile } from "@/types/sketchforge";

const corner: SketchProfile = { points: [{ id: "a", x: 10, z: 0 }, { id: "b", x: 0, z: 0 }, { id: "c", x: 0, z: 10 }], segments: [{ id: "ab", startId: "a", endId: "b", kind: "line" }, { id: "bc", startId: "b", endId: "c", kind: "line" }] };
describe("portable modeling improvements", () => {
  it("builds XYZ grids and full circles without duplicating the original at 360 degrees", () => {
    const options: PatternOptions = { kind: "grid", counts: [2, 2, 2], spacing: [10, 20, -30], count: 4, angle: 360, axis: "y", rotateCopies: true };
    expect(modelingPatternSteps(options, 1)).toHaveLength(7);
    expect(modelingPatternSteps(options, 1).at(-1)?.offset).toEqual([10, 20, -30]);
    expect(modelingPatternSteps({ ...options, kind: "circular" }, 1).map((step) => step.degrees)).toEqual([90, 180, 270]);
    expect(() => modelingPatternSteps({ ...options, counts: [256, 2, 1] }, 1)).toThrow("256");
  });
  it("copies connected geometry and constraints with fresh IDs, then pastes clear of existing points", () => {
    const source = { ...corner, constraints: [{ id: "fixed", kind: "fixed" as const, pointId: "b", x: 0, z: 0 }] };
    const clipboard = copySketchSelection(source, { pointIds: [], segmentIds: ["ab", "bc"], imageIds: [], textIds: [] });
    const pasted = pasteSketchSelection(source, clipboard);
    expect(pasted.profile.points).toHaveLength(6);
    expect(new Set(pasted.profile.points.map((p) => p.id)).size).toBe(6);
    expect(pasted.profile.constraints).toHaveLength(2);
    expect(pasted.profile.points.slice(3).every((p) => p.x > 10)).toBe(true);
    const copiedFixed = pasted.profile.constraints![1];
    expect(copiedFixed.kind === "fixed" && pasted.selection.pointIds.includes(copiedFixed.pointId)).toBe(true);
  });
  it("trims a right-angle fillet to its tangent points and preserves connectivity", () => {
    const rounded = treatSketchCorner(corner, "b", "fillet", 2);
    expect(rounded.points).toHaveLength(4);
    expect(rounded.points.slice(2).map(({ x, z }) => [x, z])).toEqual([[2.0000000000000004, 0], [0, 2.0000000000000004]]);
    expect(rounded.segments.at(-1)?.kind).toBe("bezier");
    for (const edge of rounded.segments) expect(rounded.points.some((p) => p.id === edge.startId) && rounded.points.some((p) => p.id === edge.endId)).toBe(true);
    expect(treatSketchCorner(corner, "b", "chamfer", 2).segments.at(-1)?.kind).toBe("line");
    expect(() => treatSketchCorner(corner, "b", "fillet", 20)).toThrow("too large");
    expect(corner.points).toHaveLength(3);
  });
  it("keeps inch parsing exact and persists decimal display and printer settings", () => {
    const workspace = normalizeWorkspaceSettings({ ...DEFAULT_WORKPLANE_WORKSPACE, units: "Imperial", scale: "1:1 (inches)", inchDisplay: "decimal", printerId: "bambu-a1", buildHeight: 256 });
    expect(workspace.inchDisplay).toBe("decimal");
    expect(workspace.buildHeight).toBe(256);
    expect(formatLengthForWorkspace(25.4, workspace)).toBe("1.00");
    expect(formatLengthForWorkspace(41.275, { ...workspace, inchDisplay: "fractions" })).toBe("1 5/8");
    expect(displayToMillimeters(parseMeasurementInput("1 5/8"), workspace)).toBeCloseTo(41.275);
  });
  it("enables storage UI only for advertised capabilities", () => {
    expect(storageCapabilities(null)).toMatchObject({ sharedProjects: false, backupDownload: true, localSnapshots: true });
    expect(storageCapabilities({ enabled: true })).toMatchObject({ sharedProjects: true, folders: false });
    expect(storageCapabilities({ enabled: true, capabilities: { folders: true, versions: true } })).toMatchObject({ folders: true, versions: true });
  });
});
