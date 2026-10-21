import type { CircuitScene, CircuitPart, CircuitWire } from "./vendor/components/FunctionalCircuitEditor";
import { PART_BY_KIND, getPartPins, getPartFootprint, type PartKind } from "./vendor/lib/circuitPartsExact";
import { createLocalId } from "@/lib/localIds";
export type PcbDesign = { id: string; name: string; scene: CircuitScene };
export type ElectronicsDocument = { version: 1; boards: PcbDesign[] };
export type PcbInstanceLink = { boardId: string; revision: string; originOffset: [number, number, number]; unmodeledComponents?: number; clipboardProjectId?: string };
export const EMPTY_ELECTRONICS: ElectronicsDocument = { version: 1, boards: [] };
// Like editor mesh resources, canonical project documents are immutable.
const canonicalDocuments = new WeakSet<object>();
const record = (v: unknown): Record<string, any> => { if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("Invalid PCB record"); return v as Record<string, any>; };
const text = (v: unknown, max = 200) => { if (typeof v !== "string" || v.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v)) throw new Error("Invalid PCB text"); return v; };
const number = (v: unknown) => { if (typeof v !== "number" || !Number.isFinite(v) || Math.abs(v) > 1000000) throw new Error("Invalid PCB coordinate"); return v; };
const array = (v: unknown, max: number): any[] => { if (!Array.isArray(v) || v.length > max) throw new Error("PCB element limit exceeded or invalid collection"); return v; };
export function parseCircuitScene(value: unknown): CircuitScene {
  const data = record(value), ids = new Set<string>();
  const id = (value: unknown) => { const result = text(value); if (!result || ids.has(result)) throw new Error("Missing or duplicate PCB entity ID"); ids.add(result); return result; };
  const parts = array(data.parts, 2000).map((raw): CircuitPart => {
    const p = record(raw), kind = text(p.kind) as PartKind;
    if (!PART_BY_KIND.has(kind)) throw new Error(`Unsupported PCB component: ${kind}`);
    const footprint = kind === "potentiometer" && p.footprint === "Rotary THT" ? "Bourns 3296W THT" : text(p.footprint);
    if (getPartFootprint(kind, footprint).name !== footprint) throw new Error(`Unsupported PCB footprint: ${footprint}`);
    // Catalog helper accepts supported configurable connector variants too.
    const pins = getPartPins(kind, footprint);
    if (!pins.length) throw new Error("PCB footprint has no pins");
    return { id: id(p.id), kind, footprint, reference: text(p.reference), value: text(p.value, 500), x: number(p.x), y: number(p.y), rotation: number(p.rotation ?? 0), mirrored: Boolean(p.mirrored), hidden: Boolean(p.hidden) };
  });
  const endpoint = (raw: unknown) => {
    const p = record(raw), partId = text(p.partId), pinId = text(p.pinId ?? (p.side === "right" ? "2" : "1"));
    const part = parts.find((part) => part.id === partId);
    if (!part || !getPartPins(part.kind, part.footprint).some((pin) => pin.id === pinId || pin.electricalPin === pinId)) throw new Error("PCB wire references a missing component or pin");
    return { partId, pinId };
  };
  let pointCount = 0;
  const wires = array(data.wires, 10000).map((raw): CircuitWire => {
    const w = record(raw), points = array(w.points ?? [], 5000).map((p) => ({ x: number(record(p).x), y: number(p.y) }));
    pointCount += points.length; if (pointCount > 50000) throw new Error("PCB routing is too complex");
    const color = w.color === undefined ? undefined : text(w.color, 32);
    if (color && !/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color)) throw new Error("Invalid PCB wire color");
    return { id: id(w.id), from: endpoint(w.from), to: endpoint(w.to), points, color, layer: w.layer === "bottom" ? "bottom" : "top" };
  });
  const junctions = array(data.junctions, 5000).map((raw) => { const p = record(raw); return { id: id(p.id), x: number(p.x), y: number(p.y) }; });
  const board = data.board === undefined ? undefined : (() => {
    const b = record(data.board), thicknessMm = number(b.thicknessMm);
    if (thicknessMm < 0.01 || thicknessMm > 100) throw new Error("PCB thickness must be between 0.01 and 100 mm");
    const shapes = array(b.shapes, 200).map((raw) => { const s = record(raw); const points = array(s.points, 10000).map((p) => ({ xMm: number(record(p).xMm), yMm: number(p.yMm) })); pointCount += points.length; return { id: id(s.id), points, closed: s.closed !== false }; });
    if (pointCount > 50000) throw new Error("PCB geometry is too complex");
    return { thicknessMm, shapes };
  })();
  const traceWidthMm = number(data.traceWidthMm ?? 0.25);
  if (traceWidthMm <= 0 || traceWidthMm > 10) throw new Error("Invalid PCB trace width");
  return { parts, wires, junctions, ...(board ? { board } : {}), traceWidthMm };
}
export function parseElectronics(value: unknown): ElectronicsDocument {
  if (value && typeof value === "object" && canonicalDocuments.has(value)) return value as ElectronicsDocument;
  const data = record(value); if (data.version !== 1) throw new Error("Unsupported PCB document version");
  const ids = new Set<string>();
  const result: ElectronicsDocument = { version: 1, boards: array(data.boards, 32).map((raw) => {
    const b = record(raw), id = text(b.id), name = text(b.name, 120);
    if (!id || ids.has(id) || !name.trim()) throw new Error("Invalid or duplicate PCB design ID/name"); ids.add(id);
    return { id, name, scene: parseCircuitScene(b.scene) };
  }) };
  canonicalDocuments.add(result);
  return result;
}
export function createPcbDesign(name: string): PcbDesign {
  return { id: createLocalId("pcb-board"), name, scene: { parts: [], wires: [], junctions: [], traceWidthMm: 0.25, board: { thicknessMm: 1.6, shapes: [{ id: createLocalId("pcb-outline"), closed: true, points: [{ xMm: 0, yMm: 0 }, { xMm: 60, yMm: 0 }, { xMm: 60, yMm: 40 }, { xMm: 0, yMm: 40 }] }] } } };
}
