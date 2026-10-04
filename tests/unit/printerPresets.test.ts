import { describe, expect, it } from "vitest";
import catalog from "@/lib/printerPresets.layerling.json";
import { PRINTER_PRESETS, PRINTER_PRESET_GROUPS } from "@/lib/printerPresets";

describe("complete printer catalog", () => {
  it("includes every pinned upstream printer with its exact printable dimensions", () => {
    expect(catalog.printers).toHaveLength(190);
    expect(PRINTER_PRESETS).toHaveLength(199);
    expect(new Set(PRINTER_PRESETS.map((printer) => printer.id)).size).toBe(PRINTER_PRESETS.length);
    for (const source of catalog.printers) {
      expect(PRINTER_PRESETS.find((printer) => printer.id === source.id)).toMatchObject({ id: source.id, vendor: source.vendor, width: source.width, depth: source.depth, height: source.height });
    }
    expect(PRINTER_PRESETS.find((printer) => printer.id === "ratrig-v-minion")?.name).toBe("RatRig V-Minion");
  });
  it("keeps all fourteen earlier IDs and build volumes", () => {
    const previous: Array<[string, number, number, number]> = [
      ["bambu-a1-mini", 180, 180, 180], ["bambu-a1", 256, 256, 256], ["bambu-p1-x1", 256, 256, 256],
      ["prusa-mk4", 250, 210, 220], ["prusa-mini", 180, 180, 180], ["prusa-xl", 360, 360, 360],
      ["ender3", 220, 220, 250], ["creality-k1", 220, 220, 250], ["creality-k1-max", 300, 300, 300],
      ["neptune4", 225, 225, 265], ["creality-halot-one", 127, 80, 160], ["elegoo-saturn", 192, 120, 200],
      ["tronxy-x5sa", 330, 330, 400], ["wanhao-duplicator-i3", 200, 200, 180],
    ];
    for (const [id, width, depth, height] of previous) expect(PRINTER_PRESETS.find((printer) => printer.id === id)).toMatchObject({ width, depth, height });
    expect(PRINTER_PRESETS.find((printer) => printer.id === "elegoo-neptune-4")?.width).toBe(230);
  });
  it("groups every option exactly once without rounding fractional volumes", () => {
    expect(PRINTER_PRESET_GROUPS.flatMap((group) => group.printers)).toHaveLength(PRINTER_PRESETS.length);
    for (const group of PRINTER_PRESET_GROUPS) expect(group.printers.every((printer) => printer.vendor === group.vendor)).toBe(true);
    expect(PRINTER_PRESETS.find((printer) => printer.id === "snapmaker-u1")?.height).toBe(270.05);
    expect(PRINTER_PRESETS.find((printer) => printer.id === "raise3d-pro3-plus")?.height).toBe(605);
  });
});
