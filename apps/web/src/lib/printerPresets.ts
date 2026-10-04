import catalog from "@/lib/printerPresets.layerling.json";

export type PrinterPreset = { id: string; vendor: string; name: string; width: number; depth: number; height: number };
export const PRINTER_PRESETS_SOURCE = catalog.source;

// Retain published IDs and their dimensions. In particular, the original
// Neptune 4 and combined Bambu preset differ from the slicer-profile envelopes.
const LOCAL_PRESETS: readonly PrinterPreset[] = [
  { id: "bambu-a1-mini", vendor: "Bambu Lab", name: "Bambu Lab A1 mini (legacy preset)", width: 180, depth: 180, height: 180 },
  { id: "bambu-a1", vendor: "Bambu Lab", name: "Bambu Lab A1 (legacy preset)", width: 256, depth: 256, height: 256 },
  { id: "bambu-p1-x1", vendor: "Bambu Lab", name: "Bambu Lab P1 / X1 (legacy preset)", width: 256, depth: 256, height: 256 },
  { id: "ender3", vendor: "Creality", name: "Creality Ender-3 / V2 (legacy preset)", width: 220, depth: 220, height: 250 },
  { id: "neptune4", vendor: "Elegoo", name: "Elegoo Neptune 4 (legacy preset)", width: 225, depth: 225, height: 265 },
  { id: "creality-halot-one", vendor: "Creality", name: "Creality HALOT-ONE (original)", width: 127, depth: 80, height: 160 },
  { id: "elegoo-saturn", vendor: "Elegoo", name: "Elegoo Saturn (original)", width: 192, depth: 120, height: 200 },
  { id: "tronxy-x5sa", vendor: "Tronxy", name: "Tronxy X5SA", width: 330, depth: 330, height: 400 },
  { id: "wanhao-duplicator-i3", vendor: "Wanhao", name: "Wanhao Duplicator i3", width: 200, depth: 200, height: 180 },
];

export const PRINTER_PRESETS: readonly PrinterPreset[] = [
  ...catalog.printers.map(({ model, ...printer }) => ({ ...printer, name: model.toLowerCase().startsWith(`${printer.vendor.toLowerCase()} `) ? model : `${printer.vendor} ${model}` })),
  ...LOCAL_PRESETS,
];

export const PRINTER_PRESET_GROUPS = [...new Set(PRINTER_PRESETS.map((printer) => printer.vendor))]
  .sort((a, b) => a.localeCompare(b, "en"))
  .map((vendor) => ({ vendor, printers: PRINTER_PRESETS.filter((printer) => printer.vendor === vendor).sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true })) }));
