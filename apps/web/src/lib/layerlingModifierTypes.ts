import type { CadModifierMeshPart } from "@/lib/cadModifierTypes";

export const NEW_MODIFIERS = ["flexi", "cookie", "lid", "offset", "deleteFace", "face", "simplify", "texture"] as const;
export type NewModifier = typeof NEW_MODIFIERS[number];
export const MODIFIER_LABELS: Record<NewModifier, string> = {
  flexi: "Flexi joints", cookie: "Cookie cutter", lid: "Lid", offset: "Offset body",
  deleteFace: "Delete faces", face: "Push / pocket face", simplify: "Simplify mesh", texture: "Surface texture",
};
export type FlexiOptions = { axis: "auto" | "x" | "z"; joints: number; clearance: number; swing: number; size: number; start: number; end: number };
export type LidOptions = { type: "plug" | "cap" | "both" | "flat"; thickness: number; gap: number; depth: number; wall: number };
export type CookieOptions = { wall: number; height: number; rim: number; rimHeight: number; edge: number; mirror: boolean; inner: boolean; imprint: number; bridge: number; bridgeHeight: number; plate: number };
export const TEXTURE_PATTERNS = ["grooves", "knurl", "honeycomb", "bumps", "cells", "bricks", "knit", "rope", "weave", "bark", "wood", "carbon", "grain", "image", "cracks", "text"] as const;
export type TextureImage = { width: number; height: number; values: number[] };
export type TextureOptions = { pattern: typeof TEXTURE_PATTERNS[number]; spacing: number; depth: number; width: number; angle: number; direction: "inward" | "outward" | "both"; projection: "allRound" | "cylinder" | "flat"; top: boolean; bottom: boolean; text: string; image?: TextureImage };
export type ModifierOptions = {
  flexi: FlexiOptions;
  cookie: CookieOptions;
  lid: LidOptions;
  offset: { amount: number };
  deleteFace: { faceIds: number[] };
  face: { faceIds: number[]; direction: "out" | "in"; depth: number; inset: number; separate: boolean };
  simplify: { tolerance: number };
  texture: TextureOptions;
};
export const MODIFIER_DEFAULTS: ModifierOptions = {
  flexi: { axis: "auto", joints: 0, clearance: 0.4, swing: 30, size: 0, start: 0, end: 0 },
  cookie: { wall: 1.2, height: 15, rim: 4, rimHeight: 2, edge: 0.4, mirror: true, inner: true, imprint: 0, bridge: 4, bridgeHeight: 3, plate: 0 },
  lid: { type: "plug", thickness: 2, gap: 0.2, depth: 4, wall: 1.6 },
  offset: { amount: 1 }, deleteFace: { faceIds: [] },
  face: { faceIds: [], direction: "out", depth: 2, inset: 0, separate: false },
  simplify: { tolerance: 0.1 },
  texture: { pattern: "grooves", spacing: 4, depth: 0.4, width: 0.5, angle: 0, direction: "inward", projection: "allRound", top: false, bottom: false, text: "Cadverix" },
};
export type ModifierJob = { [K in NewModifier]: { kind: K; options: ModifierOptions[K] } }[NewModifier];
export type ModifierFace = { id: number; kind: string; area: number; center: { x: number; y: number; z: number }; normal?: { x: number; y: number; z: number } };
export type ModifierMesh = { positions: Float32Array; indices: Uint32Array; brep?: string; suffix?: string };
export type SolidModifierRequest = { parts: CadModifierMeshPart[]; job: ModifierJob; assetBase: string };
export type SolidModifierResponse = { meshes: ModifierMesh[]; keepSource: boolean; warning?: string } | { error: string };

export function validateModifierJob(job: ModifierJob) {
  if (!NEW_MODIFIERS.includes(job.kind)) throw new Error("Unknown modifier");
  for (const value of Object.values(job.options)) {
    if (typeof value === "number" && !Number.isFinite(value)) throw new Error("Enter finite modifier dimensions");
  }
  const range = (value: number, min: number, max: number, label: string) => {
    if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${label} must be between ${min} and ${max}`);
  };
  if (job.kind === "flexi") {
    const o = job.options;
    if (!["auto", "x", "z"].includes(o.axis)) throw new Error("Invalid joint axis");
    range(o.joints, 0, 30, "Joint count");
    if (!Number.isInteger(o.joints)) throw new Error("Joint count must be an integer");
    range(o.clearance, 0.1, 1, "Clearance"); range(o.swing, 5, 60, "Swing");
    range(o.size, 0, 30, "Joint diameter"); range(o.start, 0, 10000, "Start offset"); range(o.end, 0, 10000, "End offset");
  } else if (job.kind === "lid") {
    const o = job.options;
    if (!["plug", "cap", "both", "flat"].includes(o.type)) throw new Error("Invalid lid type");
    range(o.thickness, 0.4, 10, "Plate thickness"); range(o.gap, 0, 1, "Fit clearance"); range(o.depth, 1, 50, "Lip depth"); range(o.wall, 0.4, 10, "Lip wall");
  } else if (job.kind === "cookie") {
    const o = job.options;
    range(o.wall, 0.4, 10, "Wall thickness"); range(o.height, 2, 100, "Cutter height");
    range(o.rim, 0.5, 30, "Rim width"); range(o.rimHeight, 0.4, o.height, "Rim height");
    range(o.edge, 0, o.wall, "Cutting edge"); range(o.imprint, 0, o.height - 0.4, "Imprint offset");
    range(o.bridge, 0.8, 20, "Bridge width"); range(o.bridgeHeight, 0.4, o.height, "Bridge height"); range(o.plate, 0, o.height, "Backing plate");
  } else if (job.kind === "offset") {
    range(job.options.amount, -100, 100, "Offset");
    if (Math.abs(job.options.amount) < 0.001) throw new Error("Offset must not be zero");
  } else if (job.kind === "simplify") range(job.options.tolerance, 0.001, 10, "Simplification tolerance");
  else if (job.kind === "texture") {
    const o = job.options;
    if (!TEXTURE_PATTERNS.includes(o.pattern) || !["inward", "outward", "both"].includes(o.direction) || !["allRound", "cylinder", "flat"].includes(o.projection)) throw new Error("Invalid texture settings");
    range(o.spacing, 0.5, 100, "Texture spacing"); range(o.depth, 0.01, Math.min(5, o.spacing / 3), "Texture depth"); range(o.width, 0.1, 1, "Texture width"); range(o.angle, -180, 180, "Texture angle");
    if (typeof o.text !== "string" || o.text.length > 80) throw new Error("Texture text is limited to 80 characters");
    if (o.pattern === "image" || o.pattern === "text") {
      const image = o.image;
      if (!image || !Number.isInteger(image.width) || !Number.isInteger(image.height) || image.width < 1 || image.height < 1 || image.width > 256 || image.height > 256 || image.values.length !== image.width * image.height || image.values.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) throw new Error("Provide a valid texture height map (at most 256 × 256 pixels)");
    }
  } else {
    const ids = job.options.faceIds;
    if (!Array.isArray(ids) || !ids.length || ids.length > 64 || ids.some((id) => !Number.isInteger(id) || id < 0)) throw new Error("Select between 1 and 64 CAD faces");
    if (job.kind === "face") {
      if (ids.length !== 1) throw new Error("Push / pocket works on one face at a time");
      if (!["in", "out"].includes(job.options.direction)) throw new Error("Invalid face direction");
      range(job.options.depth, 0.2, 100, "Face depth"); range(job.options.inset, 0, 50, "Face inset");
    }
  }
}
