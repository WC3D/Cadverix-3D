"use client";
import { useEffect, useState } from "react";
import { deleteCustomShape, listCustomShapes, loadCustomShape, saveCustomShape, type CustomShapeInfo } from "@/lib/customShapeLibrary";

export function CustomShapes({ disabled, createPackage, onInsert }: { disabled: boolean; createPackage: (name: string) => Promise<Uint8Array>; onInsert: (bytes: Uint8Array) => Promise<void> }) {
  const [shapes, setShapes] = useState<CustomShapeInfo[]>([]), [name, setName] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => { void listCustomShapes().then(setShapes).catch((error) => setNotice(String(error))); }, []);
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setNotice("");
    try { await action(); setShapes(await listCustomShapes()); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Library operation failed"); }
    finally { setBusy(false); }
  };
  return <fieldset disabled={busy}><legend>Reusable shapes</legend>
    <label>Shape name<input aria-label="Reusable shape name" maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></label>
    <button type="button" disabled={disabled || !name.trim()} onClick={() => void run(async () => { await saveCustomShape(name, await createPackage(name)); setNotice("Selection saved in this browser's library"); })}>Save selection to library</button>
    <p>Stored in this browser. 16 MB per shape, 128 MB total. Inserted copies are independent. Export an SKF to keep a separate backup.</p>
    {shapes.map((shape) => <div className="custom-shape-row" key={shape.id}><span>{shape.name}</span><button type="button" aria-label={`Insert ${shape.name}`} onClick={() => void run(async () => onInsert(await loadCustomShape(shape.id)))}>Insert</button><button type="button" aria-label={`Delete reusable ${shape.name}`} onClick={() => { if (window.confirm(`Delete ${shape.name} from the reusable-shape library? Existing inserted copies will stay.`)) void run(() => deleteCustomShape(shape.id)); }}>Delete</button></div>)}
    {notice ? <p role="status">{notice}</p> : null}
  </fieldset>;
}
