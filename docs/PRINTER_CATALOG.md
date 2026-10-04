# Printer catalog

Cadverix includes the complete 190-entry printer catalog bundled by
[henmedia/layerling](https://github.com/henmedia/layerling) at commit
`aef0efb9db4948f522890f76c856ebe92a5a052a`.

The source file is
[`apps/web/src/lib/printerPresets.generated.ts`](https://github.com/henmedia/layerling/blob/aef0efb9db4948f522890f76c856ebe92a5a052a/apps/web/src/lib/printerPresets.generated.ts).
Layerling derives its rectangular build envelopes from the standard 0.4 mm
nozzle profiles in [OrcaSlicer](https://github.com/SoftFever/OrcaSlicer), at commit
`3384daa6bcbdfccea9797238fc7acb9f4144dae8`. The upstream projects distribute
their work under AGPL-3.0; attribution and both revisions are recorded with the
imported data in `apps/web/src/lib/printerPresets.layerling.json`.

These values describe the slicer's printable envelope, which is not always
identical to the advertised nominal build volume. Fractional dimensions are
preserved. The catalog does not import slicer settings, nozzle controls,
filament profiles, or a printer connection protocol.

## Cadverix additions and compatibility

`printerPresets.ts` adapts the imported data to the existing settings UI. It
retains nine local entries, bringing the dropdown to **199 presets**:

- Tronxy X5SA, Wanhao Duplicator i3, original Creality HALOT-ONE, and original
  Elegoo Saturn.
- Five older IDs: `bambu-a1-mini`, `bambu-a1`, `bambu-p1-x1`, `ender3`, and
  `neptune4`. These appear as legacy presets and keep their previous dimensions.

The other existing IDs—Prusa MINI/MK4/XL and Creality K1/K1 Max—already exist
in the upstream catalog with matching dimensions. No saved project is resized
by this catalog expansion. Choosing a preset in settings applies its listed
width, depth, and height. X/Y are the plate dimensions; Z is height.

## Updating the snapshot

Normal application builds use the bundled JSON and make no catalog requests.
To reproduce the pinned snapshot:

```bash
npm run printers:sync
```

To intentionally import a newer Layerling revision:

```bash
npm run printers:sync -- <full-40-character-layerling-commit-sha>
```

The importer downloads the generated catalog, parses its data without
executing upstream code, validates names/IDs/dimensions, and records the source
SHA-256. Review changes and any collisions with retained local IDs before
shipping an update. Update the documented counts and regression fixtures when
the upstream catalog grows.
