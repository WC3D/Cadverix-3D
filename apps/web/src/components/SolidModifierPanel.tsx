"use client";
import { useEffect, useRef, useState } from "react";
import { MODIFIER_DEFAULTS, MODIFIER_LABELS, TEXTURE_PATTERNS, type ModifierFace, type ModifierJob, type ModifierOptions, type NewModifier, type TextureImage } from "@/lib/layerlingModifierTypes";

export function SolidModifierPanel({ kind, faces, busy, canApply, error, previewInfo, onChange, onPreview, onApply, onClose }: {
  kind: NewModifier; faces: ModifierFace[]; busy: boolean; canApply: boolean; error: string | null;
  previewInfo?: string;
  onChange: () => void; onPreview: (job: ModifierJob) => void; onApply: () => void; onClose: () => void;
}) {
  const [options, setOptions] = useState<ModifierOptions>(() => structuredClone(MODIFIER_DEFAULTS));
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const imageRun = useRef(0);
  useEffect(() => () => { imageRun.current++; }, []);
  const current = options[kind] as unknown as Record<string, unknown>;
  const update = (key: string, value: unknown) => {
    setOptions((old) => ({ ...old, [kind]: { ...old[kind], [key]: value } }));
    onChange();
  };
  const number = (key: string, label: string, min: number, max: number, step = 0.1) => <label key={key}>{label}<input aria-label={label} type="number" min={min} max={max} step={step} value={Number.isFinite(current[key]) ? current[key] as number : ""} onChange={(event) => update(key, event.target.valueAsNumber)} /></label>;
  const select = (key: string, label: string, choices: readonly string[]) => <label key={key}>{label}<select aria-label={label} value={current[key] as string} onChange={(event) => update(key, event.target.value)}>{choices.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>;
  const check = (key: string, label: string) => <label key={key}><input type="checkbox" checked={current[key] as boolean} onChange={(event) => update(key, event.target.checked)} />{label}</label>;
  const imageFromCanvas = (canvas: HTMLCanvasElement): TextureImage => {
    const context = canvas.getContext("2d")!;
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    return { width: canvas.width, height: canvas.height, values: Array.from({ length: canvas.width * canvas.height }, (_, i) => (data[i * 4] * 0.2126 + data[i * 4 + 1] * 0.7152 + data[i * 4 + 2] * 0.0722) / 255 * data[i * 4 + 3] / 255) };
  };
  const loadImage = async (file: File | undefined) => {
    const run = ++imageRun.current;
    setImageError(null); update("image", undefined);
    if (!file) return;
    setImageLoading(true);
    try {
      if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 4 * 1024 * 1024) throw new Error("Use a PNG, JPEG or WebP smaller than 4 MB");
      const bitmap = await createImageBitmap(file, { resizeWidth: 256, resizeHeight: 256, resizeQuality: "high" });
      try {
        const canvas = document.createElement("canvas"); canvas.width = canvas.height = 256;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Image processing is unavailable");
        context.drawImage(bitmap, 0, 0, 256, 256);
        if (run === imageRun.current) update("image", imageFromCanvas(canvas));
      } finally { bitmap.close(); }
    } catch (error) { if (run === imageRun.current) setImageError(error instanceof Error ? error.message : "Image could not be read"); }
    finally { if (run === imageRun.current) setImageLoading(false); }
  };
  const preview = () => {
    let selected = options[kind];
    if (kind === "texture" && options.texture.pattern === "text") {
      const canvas = document.createElement("canvas"); canvas.width = canvas.height = 256;
      const context = canvas.getContext("2d");
      if (!context) { setImageError("Text rasterization is unavailable"); return; }
      context.fillStyle = "black"; context.fillRect(0, 0, 256, 256);
      context.fillStyle = "white"; context.font = "bold 64px sans-serif"; context.textAlign = "center"; context.textBaseline = "middle";
      context.fillText(options.texture.text, 128, 128, 232);
      selected = { ...options.texture, image: imageFromCanvas(canvas) };
    }
    onPreview({ kind, options: selected } as ModifierJob);
  };
  const faceSelection = () => <fieldset className="modifier-face-list"><legend>CAD faces</legend>
    {!faces.length ? <p>No faces loaded. Select one connected solid.</p> : faces.map((face) => {
      const ids = current.faceIds as number[], checked = ids.includes(face.id);
      const normal = face.normal;
      const axis = normal ? Math.abs(normal.y) > 0.99 ? normal.y > 0 ? "Top" : "Bottom" : Math.abs(normal.x) > 0.99 ? normal.x > 0 ? "Right" : "Left" : Math.abs(normal.z) > 0.99 ? normal.z > 0 ? "Front" : "Back" : "Angled" : face.kind;
      return <label key={face.id}><input type="checkbox" aria-label={`Face ${face.id}: ${axis}`} checked={checked} disabled={kind === "face" && face.kind !== "plane"} onChange={() => update("faceIds", kind === "face" ? checked ? [] : [face.id] : checked ? ids.filter((id) => id !== face.id) : [...ids, face.id])} /><span>#{face.id} {axis} · {face.area.toFixed(1)} mm² <small>X {face.center.x.toFixed(1)}, Y {face.center.z.toFixed(1)}, Z {face.center.y.toFixed(1)}</small></span></label>;
    })}
  </fieldset>;
  return <aside className="modeling-tools solid-modifier-panel" role="region" aria-label={MODIFIER_LABELS[kind]} onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Escape") onClose(); }}>
    <header><strong>{MODIFIER_LABELS[kind]}</strong><button type="button" onClick={onClose}>Cancel</button></header>
    <fieldset disabled={busy || imageLoading}><legend>Settings</legend>
      {kind === "flexi" ? <>
        {select("axis", "Joint axis (z is scene depth / CAD Y)", ["auto", "x", "z"])}
        {number("joints", "Joint count (0 = automatic)", 0, 30, 1)}
        {number("clearance", "Joint clearance (mm)", 0.1, 1)}
        {number("swing", "Swing per side (degrees)", 5, 60, 1)}
        {number("size", "Joint diameter (0 = automatic)", 0, 30)}
        {number("start", "First joint from start (0 = automatic)", 0, 10000)}
        {number("end", "Last joint from end (0 = automatic)", 0, 10000)}
        <p>Print-in-place retained knuckles. Clearance needs a test print on your printer; not a load-rated hinge.</p>
      </> : kind === "cookie" ? <>
        {number("wall", "Cutter wall (mm)", 0.4, 10)}{number("height", "Cutter height (mm)", 2, 100)}
        {number("rim", "Rim width (mm)", 0.5, 30)}{number("rimHeight", "Rim height (mm)", 0.4, 20)}
        {number("edge", "Cutting edge (0 = flat top)", 0, 10)}
        {check("mirror", "Mirror the outline for cutting")}{check("inner", "Include inner imprint walls")}
        {number("imprint", "Lower inner walls by (mm)", 0, 99)}
        {number("bridge", "Bridge width (mm)", 0.8, 20)}{number("bridgeHeight", "Bridge height (mm)", 0.4, 20)}
        {number("plate", "Backing plate (0 = bridges)", 0, 20)}
        <p>Uses the body's silhouette from above. A new cutter is placed beside the original. Use a backing plate for disconnected islands. No food-safety certification.</p>
      </> : kind === "lid" ? <>
        {select("type", "Lid type", ["plug", "cap", "both", "flat"])}
        {number("thickness", "Lid plate thickness (mm)", 0.4, 10)}{number("gap", "Fit clearance per side (mm)", 0, 1)}
        {number("depth", "Lip depth (mm)", 1, 50)}{number("wall", "Lip wall thickness (mm)", 0.4, 10)}
        <p>For a body open at the top. The lid is added beside it, turned over for printing. Calibrate fit clearance with a test print.</p>
      </> : kind === "offset" ? <>
        {number("amount", "Body offset (mm)", -100, 100)}<p>Positive grows all faces; negative shrinks the solid. Invalid offsets leave the original intact.</p>
      </> : kind === "deleteFace" ? <>
        {faceSelection()}<p>Remove complete features such as holes or fillets. Adjacent faces must heal into a valid closed solid; arbitrary faces cannot always be removed.</p>
      </> : kind === "face" ? <>
        {faceSelection()}{select("direction", "Face direction", ["out", "in"])}
        {number("depth", "Push / pocket depth (mm)", 0.2, 100)}{number("inset", "Face inset (mm)", 0, 50)}
        {check("separate", "Keep extrusion / hole as a separate editable body")}
        <p>Choose one planar face. Faces with holes support zero inset.</p>
      </> : kind === "simplify" ? <>
        {number("tolerance", "Maximum surface deviation (mm)", 0.001, 10, 0.01)}
        <p>Reduces mesh detail within this distance. Triangle count is a result, not a guarantee. Exact CAD data is replaced by the simplified mesh.</p>
      </> : <>
        {select("pattern", "Texture pattern", TEXTURE_PATTERNS)}{select("projection", "Texture projection", ["allRound", "cylinder", "flat"])}
        {options.texture.pattern === "image" ? <label>Texture height map<input aria-label="Texture height map" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { void loadImage(event.target.files?.[0]); }} /></label> : null}
        {options.texture.pattern === "image" && options.texture.image ? <p role="status">Height map loaded locally</p> : null}
        {options.texture.pattern === "text" ? <label>Texture text<input aria-label="Texture text" value={options.texture.text} maxLength={80} onChange={(event) => update("text", event.target.value)} /></label> : null}
        {select("direction", "Texture direction", ["inward", "outward", "both"])}
        {number("spacing", "Texture spacing (mm)", 0.5, 100)}{number("depth", "Texture depth (mm)", 0.01, 5)}
        {number("width", "Texture width fraction", 0.1, 1)}{number("angle", "Texture angle (degrees)", -180, 180, 1)}
        {check("top", "Texture top faces")}{check("bottom", "Texture bottom faces")}
        <p>Mesh relief; at most 250,000 output triangles. Text and local images repeat as a square height-map tile. Crack patterns are engraved relief, not separate inlay bodies. Increase spacing for image/text detail; preview thin walls carefully.</p>
      </>}
    </fieldset>
    {error ? <p role="alert">{error}</p> : null}
    {previewInfo ? <p role="status">{previewInfo}</p> : null}
    {imageError ? <p role="alert">{imageError}</p> : null}
    <footer><button type="button" disabled={busy || imageLoading} onClick={preview}>{busy || imageLoading ? "Calculating…" : "Preview modifier"}</button><button type="button" disabled={busy || imageLoading || !canApply} onClick={onApply}>Apply modifier</button></footer>
    <p>Preview does not save geometry. Apply creates one undo step. Cancel retains the original.</p>
  </aside>;
}
