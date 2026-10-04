// Import data, not executable upstream TypeScript. The pinned snapshot makes
// catalog updates deliberate and reproducible; normal builds never fetch it.
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
const revision = process.argv[2] ?? "aef0efb9db4948f522890f76c856ebe92a5a052a";
if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error("Supply a full Layerling commit SHA");
const file = "apps/web/src/lib/printerPresets.generated.ts";
const url = `https://raw.githubusercontent.com/henmedia/layerling/${revision}/${file}`;
const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error(`Printer catalog download failed: ${response.status}`);
const source = await response.text();
if (source.length > 512000) throw new Error("Unexpected printer catalog size");
const literal = /export const PRINTER_PRESETS: readonly PrinterPreset\[\] = (\[[\s\S]*?\n\]);/.exec(source)?.[1];
if (!literal) throw new Error("Upstream catalog structure changed; review before importing");
const raw = JSON.parse(literal.replace(/,(\s*\])$/, "$1"));
if (!Array.isArray(raw) || !raw.length || raw.length > 2000) throw new Error("Invalid printer catalog");
const ids = new Set();
const printers = raw.map((printer) => {
  if (!printer || typeof printer !== "object" || typeof printer.id !== "string" || !/^[a-z0-9-]+$/.test(printer.id) || ids.has(printer.id)) throw new Error("Invalid or duplicate printer ID");
  if ([printer.vendor, printer.model].some((value) => typeof value !== "string" || !value.trim() || value.length > 150)) throw new Error("Invalid printer name");
  if ([printer.width, printer.depth, printer.height].some((value) => typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 2000)) throw new Error(`Unsupported build volume: ${printer.id}`);
  ids.add(printer.id);
  const { id, vendor, model, width, depth, height } = printer;
  return { id, vendor, model, width, depth, height };
});
const profileRevision = /Source: OrcaSlicer.*commit ([a-f0-9]{40})\./.exec(source)?.[1];
if (!profileRevision) throw new Error("Upstream profile attribution is missing");
const output = {
  source: { repository: "https://github.com/henmedia/layerling", revision, file, sha256: createHash("sha256").update(source).digest("hex"), profiles: "https://github.com/SoftFever/OrcaSlicer", profileRevision, license: "AGPL-3.0", description: "Layerling's bundled rectangular build-volume catalog, derived from OrcaSlicer standard 0.4 mm nozzle profiles. Dimensions in millimeters." },
  printers,
};
await writeFile(new URL("../apps/web/src/lib/printerPresets.layerling.json", import.meta.url), `${JSON.stringify(output, null, 2)}\n`);
console.log(`Imported ${printers.length} printer presets from Layerling ${revision.slice(0, 7)} (OrcaSlicer ${profileRevision.slice(0, 7)}).`);
