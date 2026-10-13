import { describe, expect, it } from "vitest";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import * as THREE from "three";
import { createPcbDesign, parseElectronics, parseCircuitScene } from "@/pcb/pcbDocument";
import { PART_BY_KIND } from "@/pcb/vendor/lib/circuitPartsExact";
import { createPCBExport, parsePCBImport } from "@/pcb/vendor/lib/pcbInterchange";
import { buildPcbGeometry, refreshPcbInstance } from "@/pcb/pcbGeometry";
import { editorHistoryEntry, hydrateEditorHistoryState } from "@/lib/editorHistory";
import { exportSkfProject, exportLylProject, importSkfProject } from "@/lib/skfProject";
import { DEFAULT_WORKPLANE_WORKSPACE } from "@/lib/workplaneSettings";
import type { WorkplaneShape } from "@/types/sketchforge";

const mechanical: WorkplaneShape = { id: "enclosure", name: "Enclosure", kind: "box", color: "#112233", x: 0, z: 0, elevation: 0, width: 100, depth: 80, size: 100, height: 20, rotation: 0, hidden: false, locked: false };
function boards() {
  const a = createPcbDesign("Controller"), b = createPcbDesign("Display");
  const footprint = PART_BY_KIND.get("resistor")!.defaultFootprint;
  a.scene.parts = [1, 2].map((index) => ({ id: `r-${index}`, kind: "resistor" as const, reference: `R${index}`, value: "1k", footprint, x: index * 200, y: 200, hidden: false, mirrored: false, rotation: 0 }));
  a.scene.wires = [{ id: "wire", from: { partId: "r-1", pinId: "1" }, to: { partId: "r-2", pinId: "1" }, points: [] }];
  b.scene = structuredClone(a.scene);
  return parseElectronics({ version: 1, boards: [a, b] });
}
const input = (history: ReturnType<typeof editorHistoryEntry>[], historyIndex = history.length - 1) => ({ projectName: "Combined", createdAt: 1, modifiedAt: 2, shapes: history[historyIndex].shapes, history, historyIndex, assets: [], workspace: DEFAULT_WORKPLANE_WORKSPACE, snapGrid: "1.0 mm" as const, placementElevation: 0 });

describe("combined electronics and mechanical projects", () => {
  it("saves all independent circuits and their history under reader version 4", async () => {
    const document = boards();
    const edited = structuredClone(document); edited.boards[0].scene.parts[0].value = "10k";
    const history = [editorHistoryEntry([mechanical], []), editorHistoryEntry([mechanical], [], [], document), editorHistoryEntry([mechanical], [], [], edited)];
    const bytes = await exportSkfProject(input(history));
    const manifest = JSON.parse(strFromU8(unzipSync(bytes)["project.json"]));
    expect(manifest.formatVersion).toBe(4); expect(manifest.minimumReaderVersion).toBe(4);
    const restored = await importSkfProject(bytes);
    expect(restored.history).toHaveLength(3);
    expect(restored.history[2].electronics?.boards[0].scene.parts[0].value).toBe("10k");
    expect(restored.history[2].electronics?.boards[1].scene.parts[0].value).toBe("1k");
    expect(restored.history[1].electronics?.boards[0].scene.parts[0].value).toBe("1k");
    expect(restored.history[0].electronics).toBeUndefined();
    expect(restored.shapes[0].id).toBe("enclosure");
    await expect(exportLylProject(input(history))).rejects.toThrow("PCB projects require SKF");
    expect(hydrateEditorHistoryState([mechanical], history, 2).entries).toHaveLength(3);
  });
  it("rejects downgraded files and dangling instance references", async () => {
    const doc = boards();
    const instance = { ...mechanical, id: "pcb-instance", pcbInstance: { boardId: doc.boards[0].id, revision: "pending", originOffset: [0, 0, 0] as [number, number, number] } };
    const bytes = await exportSkfProject(input([editorHistoryEntry([mechanical, instance], [], [], doc)]));
    const files = unzipSync(bytes), manifest = JSON.parse(strFromU8(files["project.json"]));
    manifest.minimumReaderVersion = 3; files["project.json"] = strToU8(JSON.stringify(manifest));
    await expect(importSkfProject(zipSync(files))).rejects.toThrow("reader version 4");
    manifest.minimumReaderVersion = 4; manifest.states[0].electronics.boards = [];
    files["project.json"] = strToU8(JSON.stringify(manifest));
    await expect(importSkfProject(zipSync(files))).rejects.toThrow("missing board");
  });
  it("validates circuits per board, rejecting corrupt geometry and pin references", () => {
    const doc = boards(); expect(doc.boards[0].scene.parts[0].reference).toBe(doc.boards[1].scene.parts[0].reference);
    const scene = structuredClone(doc.boards[0].scene); scene.wires[0].from.pinId = "nonexistent";
    expect(() => parseCircuitScene(scene)).toThrow("missing component or pin");
    scene.wires = []; scene.parts[0].x = Infinity;
    expect(() => parseCircuitScene(scene)).toThrow("coordinate");
    expect(() => parsePCBImport("future.sfpcb", JSON.stringify({ format: "sketchforge-pcb", version: 99, scene: doc.boards[0].scene }))).toThrow("newer reader");
  });
  it("preserves native circuit data and uses its saved trace width in manufacturing exports", async () => {
    const scene = { ...boards().boards[0].scene, traceWidthMm: 0.8 };
    const file = createPCBExport(scene, "sfpcb", "Controller");
    expect(parsePCBImport(file.fileName, await file.blob.text())).toEqual(scene);
    expect(await createPCBExport(scene, "kicad_pcb", "Controller").blob.text()).toContain("(width 0.8)");
    const gerbers = unzipSync(new Uint8Array(await createPCBExport(scene, "gerber", "Controller").blob.arrayBuffer()));
    expect(Object.values(gerbers).some((bytes) => strFromU8(bytes).includes("%ADD10C,0.800*%"))).toBe(true);
  });
  it("regenerates a resized board without moving the instance's document origin", async () => {
    const board = createPcbDesign("Board"); const first = await buildPcbGeometry(board);
    const original = { ...first.shape, id: "instance", x: 120, z: 70, elevation: 50, rotation: 35, rotationX: 20, pcbInstance: { boardId: board.id, revision: "old", originOffset: [-first.shape.x, -(first.shape.elevation ?? 0) - first.shape.height / 2, -first.shape.z] as [number, number, number] } };
    const nextBoard = structuredClone(board); nextBoard.scene.board!.shapes[0].points[1].xMm = 90; nextBoard.scene.board!.shapes[0].points[2].xMm = 90;
    const second = await buildPcbGeometry(nextBoard); const refreshed = refreshPcbInstance(original, second.shape, "new");
    const origin = (shape: WorkplaneShape) => new THREE.Vector3(shape.x, (shape.elevation ?? 0) + shape.height / 2, shape.z).add(new THREE.Vector3(...shape.pcbInstance!.originOffset).applyEuler(new THREE.Euler((shape.rotationX ?? 0) * Math.PI / 180, shape.rotation * Math.PI / 180, (shape.rotationZ ?? 0) * Math.PI / 180, "XYZ")));
    expect(origin(refreshed).distanceTo(origin(original))).toBeLessThan(1e-8);
    expect(refreshed.width).toBeCloseTo(90); expect(refreshed.id).toBe(original.id); expect(refreshed.rotation).toBe(35);
  });
});
