import { describe, expect, it } from "vitest";
import { editorHistoryEntry, hydrateEditorHistoryState, notesForHistoryIndex, projectSceneFingerprint } from "@/lib/editorHistory";
import { detachNotesFromMissingShapes, normalizeNotes, NOTE_COUNT_LIMIT, NOTE_TEXT_LIMIT } from "@/lib/workplaneNotes";
import type { WorkplaneNote, WorkplaneShape } from "@/types/sketchforge";

function box(overrides: Partial<WorkplaneShape> = {}): WorkplaneShape {
  return {
    id: "box-1", name: "Box", kind: "box", color: "#ffffff", x: 0, z: 0,
    elevation: 0, size: 20, width: 20, depth: 20, height: 20, rotation: 0, ...overrides,
  };
}

function note(overrides: Partial<WorkplaneNote> = {}): WorkplaneNote {
  return { id: "note-1", text: "Ream to 4.2 mm", x: 5, y: 0, z: 7, ...overrides };
}

describe("workplane notes", () => {
  it("normalizes valid notes and repairs accessory data", () => {
    const anchor = { shapeId: "box-1", normalized: [0.5, 0.25, -0.5] as [number, number, number] };
    expect(normalizeNotes([note({ anchor, collapsed: true })])).toEqual([
      { id: "note-1", text: "Ream to 4.2 mm", x: 5, y: 0, z: 7, anchor, collapsed: true },
    ]);
    const [repaired] = normalizeNotes([{ id: "note-2", text: "x".repeat(NOTE_TEXT_LIMIT + 10), x: Number.NaN, y: 2, z: 3 }]);
    expect(repaired.text).toHaveLength(NOTE_TEXT_LIMIT);
    expect(repaired.x).toBe(0);
    expect(normalizeNotes([note(), note()])).toHaveLength(1);
    expect(normalizeNotes(Array.from({ length: NOTE_COUNT_LIMIT + 10 }, (_, index) => note({ id: `note-${index}` })))).toHaveLength(NOTE_COUNT_LIMIT);
  });

  it("keeps a note but detaches it when its shape disappears", () => {
    const pinned = note({ anchor: { shapeId: "missing", normalized: [0, 0, 0] } });
    expect(detachNotesFromMissingShapes([pinned], [box()])).toEqual([{ id: "note-1", text: "Ream to 4.2 mm", x: 5, y: 0, z: 7 }]);
  });

  it("preserves the world position when a transformed anchor shape disappears", () => {
    const shape = box({ id: "moving", x: 10, z: 30, elevation: 4, width: 20, height: 10, depth: 40, rotation: 90 });
    const pinned = note({ anchor: { shapeId: "moving", normalized: [0.5, 0, 0] } });
    const [detached] = detachNotesFromMissingShapes([pinned], [], [shape]);
    expect(detached.anchor).toBeUndefined();
    expect(detached.x).toBeCloseTo(10);
    expect(detached.y).toBeCloseTo(9);
    expect(detached.z).toBeCloseTo(20);
  });

  it("includes notes in scene history and hydration", () => {
    const withoutNote = editorHistoryEntry([box()], []);
    const withNote = editorHistoryEntry([box()], [], [note()]);
    expect(withNote.fingerprint).not.toBe(withoutNote.fingerprint);
    expect(projectSceneFingerprint([box()], [note()])).not.toBe(projectSceneFingerprint([box()]));
    expect(notesForHistoryIndex([withoutNote, withNote], 1)).toEqual([note()]);

    const restored = hydrateEditorHistoryState([box()], [withNote], 0, "unlimited", [note()]);
    expect(restored.entries[0].notes).toEqual([note()]);
    expect(hydrateEditorHistoryState([box()], [withNote], 0).entries[0].notes).toBeUndefined();
  });
});
