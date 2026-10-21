"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Box, FolderInput, Plus, Redo2, Save, Settings2, Undo2 } from "lucide-react";
import { zipSync } from "fflate";
import { createLocalId } from "@/lib/localIds";
import { createPcbDesign, parseCircuitScene, type ElectronicsDocument, type PcbDesign } from "./pcbDocument";
import { FunctionalCircuitEditor, type CircuitScene } from "./vendor/components/FunctionalCircuitEditor";
import { createPCBExport, parsePCBImport, type PCBExportFormat } from "./vendor/lib/pcbInterchange";
import type { WorkplaneShape } from "@/types/sketchforge";

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob), anchor = document.createElement("a");
  anchor.href = url; anchor.download = name; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}
function BoardEditor({ board, toolbarHost, projectId, reset, onScene, onUndo, onRedo, onHome, onSave, themeId, gridColor, backgroundColor, onThemeChange }: { board: PcbDesign; toolbarHost: HTMLDivElement | null; projectId?: string | null; reset: number; onScene: (scene: CircuitScene, transaction: string) => void; onUndo: () => void; onRedo: () => void; onHome: () => void; onSave: () => void; themeId: string; gridColor: string; backgroundColor: string; onThemeChange: (id: string) => void }) {
  const session = useRef(createLocalId("pcb-editor-session"));
  return <FunctionalCircuitEditor themeId={themeId} gridColor={gridColor} backgroundColor={backgroundColor} onThemeChange={onThemeChange} toolbarHost={toolbarHost} initialScene={board.scene} projectId={`${projectId}:${board.id}`} projectName={board.name} resetKey={reset} onProjectUndo={onUndo} onProjectRedo={onRedo} onProjectSave={onSave} onHome={onHome} onSceneChange={(scene, transaction) => onScene(scene, `${session.current}:${transaction}`)} />;
}

export function PcbWorkspace({ toolbarHost, document, shapes, projectId, reset, requestedBoard, onActiveBoard, onChange, onAddInstance, onLocate, onDetach, onSave, onUndo, onRedo, onHome, geometryStatus, onRetry, themeId, gridColor, backgroundColor, onThemeChange }: {
  themeId: string; gridColor: string; backgroundColor: string; onThemeChange: (id: string) => void;
  toolbarHost: HTMLDivElement | null;
  document: ElectronicsDocument; shapes: WorkplaneShape[]; projectId?: string | null; reset: number; requestedBoard?: string | null;
  onActiveBoard: (id: string) => void;
  onChange: (document: ElectronicsDocument, label: string, transaction?: string) => void;
  onAddInstance: (boardId: string) => void; onLocate: (instanceId: string) => void; onDetach: (instanceId: string) => void;
  onSave: () => void; onUndo: () => void; onRedo: () => void; onHome: () => void; geometryStatus: string; onRetry: () => void;
}) {
  const [activeId, setActiveId] = useState(requestedBoard ?? document.boards[0]?.id ?? "");
  const [notice, setNotice] = useState("");
  const [managerOpen, setManagerOpen] = useState(false);
  const [circuitToolbarHost, setCircuitToolbarHost] = useState<HTMLDivElement | null>(null);
  const [exportFormat, setExportFormat] = useState<PCBExportFormat>("sfpcb");
  const [exportBusy, setExportBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const current = document.boards.find((board) => board.id === activeId) ?? document.boards[0];
  const currentRef = useRef(current); currentRef.current = current;
  useEffect(() => { if (current) onActiveBoard(current.id); }, [current?.id, onActiveBoard]);
  const documentRef = useRef(document); documentRef.current = document;
  useEffect(() => { if (requestedBoard) setActiveId(requestedBoard); }, [requestedBoard]);
  const uniqueName = (stem: string) => { let name = stem, suffix = 2; while (document.boards.some((board) => board.name === name)) name = `${stem} ${suffix++}`; return name; };
  const add = () => {
    if (document.boards.length >= 32) { setNotice("A project supports up to 32 PCB designs"); return; }
    const board = createPcbDesign(uniqueName("Board"));
    onChange({ ...document, boards: [...document.boards, board] }, "Added PCB design"); setActiveId(board.id);
  };
  const importBoard = async (file: File) => {
    try {
      if (file.size > 16 * 1024 * 1024) throw new Error("PCB import is limited to 16 MB");
      if (documentRef.current.boards.length >= 32) throw new Error("A project supports up to 32 PCB designs");
      const scene = parseCircuitScene(parsePCBImport(file.name, await file.text()));
      const board = { id: createLocalId("pcb-board"), name: uniqueName(file.name.replace(/\.[^.]+$/, "").slice(0, 100) || "Imported board"), scene };
      onChange({ ...documentRef.current, boards: [...documentRef.current.boards, board] }, "Imported PCB design"); setActiveId(board.id);
    } catch (error) { setNotice(error instanceof Error ? error.message : "PCB import failed"); }
  };
  const exportBoards = async (all: boolean) => {
    if (!current) return;
    setExportBusy(true);
    try {
      if (!all) { const file = createPCBExport(current.scene, exportFormat, current.name); download(file.fileName, file.blob); }
      else {
        const files: Record<string, Uint8Array> = {};
        for (const [index, board] of document.boards.entries()) {
          const file = createPCBExport(board.scene, exportFormat, board.name);
          const folder = `${index + 1}-${board.name.replace(/[^a-z0-9_-]+/gi, "-")}`;
          files[`${folder}/${file.fileName}`] = new Uint8Array(await file.blob.arrayBuffer());
        }
        download("PCB-board-exports.zip", new Blob([new Uint8Array(zipSync(files))], { type: "application/zip" }));
      }
      setNotice(all ? "Exported separate board packages" : "Board exported");
    } catch (error) { setNotice(error instanceof Error ? error.message : "PCB export failed"); }
    finally { setExportBusy(false); }
  };
  return <section className="pcb-workspace" aria-label="Multi-board PCB workspace">
    {toolbarHost ? createPortal(<div className="pcb-workspace pcb-toolbar" aria-label="PCB toolbar">
      <div className="pcb-project-tools">
        <div className="toolbar-section" data-tool-group="home"><div className="toolbar-section-label">Home</div><div className="toolbar-section-tools"><button type="button" aria-label="Geometry" title="Return to Geometry" onClick={onHome}><Box size={20} /></button></div></div>
        <div className="toolbar-section" data-tool-group="history"><div className="toolbar-section-label">History</div><div className="toolbar-section-tools"><button type="button" aria-label="Project undo" title="Project undo" onClick={onUndo}><Undo2 size={20} /></button><button type="button" aria-label="Project redo" title="Project redo" onClick={onRedo}><Redo2 size={20} /></button></div></div>
        <div className="toolbar-section" data-tool-group="shapes"><div className="toolbar-section-label">Boards</div><div className="toolbar-section-tools">
          <select aria-label="Active PCB board" value={current?.id ?? ""} onChange={(event) => setActiveId(event.target.value)}>{!current ? <option value="">No boards</option> : document.boards.map((board) => <option key={board.id} value={board.id}>{board.name}</option>)}</select>
          <button type="button" aria-label="Add board" title="Add board" onClick={add}><Plus size={20} /></button><button type="button" aria-label="Import PCB" title="Import PCB" onClick={() => inputRef.current?.click()}><FolderInput size={20} /></button>
          <button type="button" aria-label="Manage boards / exports" title="Manage boards / exports" aria-expanded={managerOpen} aria-controls="pcb-board-manager" disabled={!current} onClick={() => setManagerOpen(!managerOpen)}><Settings2 size={20} /></button>
        </div></div>
        <div className="toolbar-section" data-tool-group="manage"><div className="toolbar-section-label">Project</div><div className="toolbar-section-tools"><button type="button" aria-label="Save combined SKF" title="Save combined SKF" onClick={onSave}><Save size={20} /></button></div></div>
      </div>
      <div className="pcb-circuit-tools-host" ref={setCircuitToolbarHost} />
    </div>, toolbarHost) : null}
    <input ref={inputRef} type="file" hidden accept=".sfpcb,.kicad_pcb,.json" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void importBoard(file); }} />
    {managerOpen && current ? <aside className="pcb-project-manager" id="pcb-board-manager" aria-label="PCB board management">
      <button type="button" onClick={() => setManagerOpen(false)}>Close board manager</button>
      <label>Board name<input key={current.id + reset} aria-label="PCB board name" defaultValue={current.name} maxLength={120} onBlur={(event) => { const name = event.target.value.trim(); if (name && name !== current.name) onChange({ ...document, boards: document.boards.map((board) => board.id === current.id ? { ...board, name } : board) }, "Renamed PCB design"); }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /></label>
      <button type="button" onClick={() => { if (document.boards.length >= 32) { setNotice("A project supports up to 32 boards"); return; } const copy = { ...current, id: createLocalId("pcb-board"), name: uniqueName(`${current.name} copy`), scene: structuredClone(current.scene) }; onChange({ ...document, boards: [...document.boards, copy] }, "Duplicated independent PCB design"); setActiveId(copy.id); }}>Duplicate independent board</button>
      <button type="button" onClick={() => onAddInstance(current.id)}>Add linked instance</button>
      <button type="button" onClick={() => { onChange({ ...document, boards: document.boards.filter((board) => board.id !== current.id) }, "Deleted PCB design and its instances"); setManagerOpen(false); }}>Delete board and instances</button>
      <h3>Assembly instances</h3>{shapes.filter((shape) => shape.pcbInstance?.boardId === current.id).map((shape) => <div key={shape.id}><span>{shape.name}{shape.pcbInstance?.unmodeledComponents ? ` · ${shape.pcbInstance.unmodeledComponents} component bodies unavailable (pads/holes retained)` : ""}</span><button type="button" onClick={() => onLocate(shape.id)}>Select in Geometry</button><button type="button" onClick={() => onDetach(shape.id)}>Make independent CAD copy</button></div>)}
      <label>Board export<select aria-label="PCB export format" value={exportFormat} onChange={(event) => setExportFormat(event.target.value as PCBExportFormat)}><option value="sfpcb">SFPCB</option><option value="kicad_pcb">KiCad PCB</option><option value="gerber">Gerber ZIP</option><option value="svg">SVG</option><option value="bom">BOM CSV</option></select></label>
      <button type="button" disabled={exportBusy} onClick={() => void exportBoards(false)}>Export selected board</button><button type="button" disabled={exportBusy} onClick={() => void exportBoards(true)}>Export all boards</button>
    </aside> : null}
    <div className="pcb-editor-host">{current ? <BoardEditor key={current.id} themeId={themeId} gridColor={gridColor} backgroundColor={backgroundColor} onThemeChange={onThemeChange} toolbarHost={circuitToolbarHost} board={current} reset={reset} projectId={projectId} onUndo={onUndo} onRedo={onRedo} onHome={onHome} onSave={onSave} onScene={(scene, transaction) => {
      try {
        const clean = parseCircuitScene(scene);
        if (JSON.stringify(clean) === JSON.stringify(currentRef.current?.scene)) return;
        onChange({ ...documentRef.current, boards: documentRef.current.boards.map((board) => board.id === current.id ? { ...board, scene: clean } : board) }, `Edited ${current.name}`, `${current.id}:${transaction}`);
      } catch (error) { setNotice(error instanceof Error ? error.message : "Invalid PCB edit"); }
    }} /> : <div className="pcb-empty"><h2>Add a PCB design to this project</h2><p>Each board has its own independent circuit and layout. Linked instances appear with your mechanical design.</p><button type="button" onClick={add}>Create first PCB board</button></div>}</div>
    <footer className="pcb-project-status" role="status">{[geometryStatus, notice].filter(Boolean).join(" · ") || "PCB designs and mechanical geometry save together in the combined SKF project."}{geometryStatus.includes("failed") ? <button type="button" onClick={onRetry}>Retry PCB geometry</button> : null}</footer>
  </section>;
}
