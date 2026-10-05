import { createLocalId } from "@/lib/localIds";
import { shapeDepth, shapeWidth } from "@/lib/workplaneShapes";
import type { WorkplaneNote, WorkplaneNoteAnchor, WorkplaneShape } from "@/types/sketchforge";
import * as THREE from "three";

export const NOTE_TEXT_LIMIT = 2000;
export const NOTE_COUNT_LIMIT = 200;

export function createNoteId() {
  return createLocalId("note");
}

function finiteNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeAnchor(value: unknown): WorkplaneNoteAnchor | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Partial<WorkplaneNoteAnchor>;
  if (typeof raw.shapeId !== "string" || !raw.shapeId) return undefined;
  if (!Array.isArray(raw.normalized) || raw.normalized.length !== 3) return undefined;
  const normalized = raw.normalized.map((entry) => finiteNumber(entry));
  return { shapeId: raw.shapeId, normalized: [normalized[0], normalized[1], normalized[2]] };
}

export function normalizeNote(value: unknown): WorkplaneNote | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<WorkplaneNote>;
  const note: WorkplaneNote = {
    id: typeof raw.id === "string" && raw.id ? raw.id : createNoteId(),
    text: typeof raw.text === "string" ? raw.text.slice(0, NOTE_TEXT_LIMIT) : "",
    x: finiteNumber(raw.x),
    y: finiteNumber(raw.y),
    z: finiteNumber(raw.z),
  };
  const anchor = normalizeAnchor(raw.anchor);
  if (anchor) note.anchor = anchor;
  if (raw.collapsed) note.collapsed = true;
  return note;
}

export function normalizeNotes(value: unknown): WorkplaneNote[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const notes: WorkplaneNote[] = [];
  for (const entry of value) {
    const note = normalizeNote(entry);
    if (!note || seen.has(note.id)) continue;
    seen.add(note.id);
    notes.push(note);
    if (notes.length >= NOTE_COUNT_LIMIT) break;
  }
  return notes;
}

function anchoredNoteWorldPosition(note: WorkplaneNote, shape: WorkplaneShape) {
  if (!note.anchor) return { x: note.x, y: note.y, z: note.z };
  const local = new THREE.Vector3(
    note.anchor.normalized[0] * shapeWidth(shape) * (shape.mirrorX ? -1 : 1),
    note.anchor.normalized[1] * shape.height * (shape.mirrorY ? -1 : 1),
    note.anchor.normalized[2] * shapeDepth(shape) * (shape.mirrorZ ? -1 : 1),
  ).applyEuler(new THREE.Euler(
    THREE.MathUtils.degToRad(shape.rotationX ?? 0),
    THREE.MathUtils.degToRad(shape.rotation),
    THREE.MathUtils.degToRad(shape.rotationZ ?? 0),
    "XYZ",
  ));
  return {
    x: shape.x + local.x,
    y: (shape.elevation ?? 0) + shape.height / 2 + local.y,
    z: shape.z + local.z,
  };
}

export function detachNotesFromMissingShapes(notes: WorkplaneNote[], shapes: WorkplaneShape[], previousShapes: WorkplaneShape[] = shapes): WorkplaneNote[] {
  if (notes.every((note) => !note.anchor)) return notes;
  const shapeIds = new Set(shapes.map((shape) => shape.id));
  const previousShapesById = new Map(previousShapes.map((shape) => [shape.id, shape]));
  let changed = false;
  const next = notes.map((note) => {
    if (!note.anchor || shapeIds.has(note.anchor.shapeId)) return note;
    changed = true;
    const previousShape = previousShapesById.get(note.anchor.shapeId);
    const position = previousShape ? anchoredNoteWorldPosition(note, previousShape) : note;
    const { anchor: _anchor, ...detached } = note;
    return { ...detached, x: position.x, y: position.y, z: position.z };
  });
  return changed ? next : notes;
}

export function notesSignature(notes: WorkplaneNote[]) {
  if (notes.length === 0) return "";
  return notes
    .map((note) => [
      note.id,
      note.text,
      note.anchor ? `${note.anchor.shapeId}@${note.anchor.normalized.map((value) => value.toFixed(4)).join(",")}` : "free",
      `${note.x.toFixed(3)},${note.y.toFixed(3)},${note.z.toFixed(3)}`,
      note.collapsed ? "c" : "",
    ].join("|"))
    .join("\n");
}
