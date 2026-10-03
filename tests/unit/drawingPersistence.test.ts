import { describe, expect, it } from "vitest";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { exportSkfProject, importSkfProject, SKF_DRAWING_FORMAT_VERSION } from "@/lib/skfProject";
import { createDrawingSheet } from "@/lib/drawingSheet";
import { DEFAULT_WORKPLANE_WORKSPACE } from "@/lib/workplaneSettings";
import { editorHistoryEntry } from "@/lib/editorHistory";

describe("drawing project persistence", () => {
  const input = () => ({ projectName: "Drawing", createdAt: 1, modifiedAt: 2, shapes: [], history: [editorHistoryEntry([], [])], historyIndex: 0, assets: [], workspace: DEFAULT_WORKPLANE_WORKSPACE, snapGrid: "1.0 mm" as const, placementElevation: 0 });
  it("saves drawings in reader version 3 while plain models remain version 2", async () => {
    const drawing = createDrawingSheet();
    drawing.template = "ANSI B"; drawing.units = "in"; drawing.projection = "third";
    drawing.entities = [{ id: "rect", kind: "rectangle", a: [30, 30], b: [80, 60], angle: 30, text: "" }];
    drawing.dimensions = [{ id: "dim", kind: "aligned", anchors: [{ type: "entity", entityId: "rect", index: 0 }, { type: "entity", entityId: "rect", index: 1 }], offset: -10, sourceFingerprint: "" }];
    const bytes = await exportSkfProject({ ...input(), workspace: { ...DEFAULT_WORKPLANE_WORKSPACE, drawing } });
    const document = JSON.parse(strFromU8(unzipSync(bytes)["project.json"]!));
    expect(document.formatVersion).toBe(SKF_DRAWING_FORMAT_VERSION);
    expect(document.minimumReaderVersion).toBe(3);
    expect((await importSkfProject(bytes)).workspace.drawing).toEqual(drawing);
    const plain = JSON.parse(strFromU8(unzipSync(await exportSkfProject(input()))["project.json"]!));
    expect(plain.formatVersion).toBe(2);
  });

  it("rejects corrupt drawing references and drawing packages claiming legacy reader compatibility", async () => {
    const bytes = await exportSkfProject({ ...input(), workspace: { ...DEFAULT_WORKPLANE_WORKSPACE, drawing: createDrawingSheet() } });
    const files = unzipSync(bytes), document = JSON.parse(strFromU8(files["project.json"]!));
    document.minimumReaderVersion = 2;
    files["project.json"] = strToU8(JSON.stringify(document));
    await expect(importSkfProject(zipSync(files))).rejects.toThrow("reader version 3");
    document.minimumReaderVersion = 3;
    document.editor.workspace.drawing.dimensions = [{ id: "broken", kind: "horizontal", anchors: [{ type: "view", viewId: "missing", point: [0, 0, 0] }, { type: "view", viewId: "missing", point: [1, 0, 0] }], offset: 5, sourceFingerprint: "" }];
    files["project.json"] = strToU8(JSON.stringify(document));
    await expect(importSkfProject(zipSync(files))).rejects.toThrow("no view");
  });
});
