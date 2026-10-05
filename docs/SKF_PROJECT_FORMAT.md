# Cadverix 3D project files (`.skf`)

`.skf` is Cadverix 3D's native, editable project format. It is an additional backup, transfer, and sharing mechanism; IndexedDB autosave remains the normal local persistence system, and 3MF, STL, OBJ, STEP, and SVG remain geometry exports. The established `com.sketchforge.project` schema and media types are retained for compatibility with existing files and readers.

## Architecture decision

Cadverix 3D uses a packaged container (format option B). A `.skf` file is a ZIP archive containing `project.json` and deduplicated files below `assets/`.

This was selected over pure JSON because imported STL/STEP data and exact B-Rep can be large, Base64 would add size and parsing overhead, and an archive lets Cadverix 3D validate and hash each asset independently. The editable model is still JSON and can be inspected by opening `project.json` from the package.

## Version 2 / 3 layout

```text
project.skf
├── project.json
└── assets/
    ├── source/          Original imported 3MF, STL, SVG, or STEP files
    ├── derived-mesh/    Exact caches for baked operations or legacy imports
    ├── brep/            Exact STEP/B-Rep payloads
    ├── display-edges/   Deduplicated display-edge polylines of CAD objects
    └── image/           Deduplicated sketch/reference images
```

`project.json` contains these top-level sections:

- `schema`, `formatVersion`, `minimumReaderVersion`, and `createdWithVersion`
- `metadata`: project name, source project ID, units, and timestamps
- `assets`: path, type, byte length, SHA-256, source format, and media type
- `states`: explicit root node IDs, editable object graphs, and optional workplane notes for the active scene and undo/redo states
- `history`: ordered state references, selection per state, and current undo/redo index
- `sketches`: sketch/extrusion indexes
- `features`: supported group, subtraction, intersection, mirror, sketch-extrusion, fillet, and chamfer operations used by the active project
- `groups`: explicit parent/member references and operation type
- `workplanes`: base and selected offset workplanes
- `exactCad`: objects with exact B-Rep or imported STEP sources
- `editor`: workspace dimensions, units, snap grid, and selected workplane elevation
- `editor.workspace.drawing` (format 3): paper template/orientation, title-block fields, projection convention, source-linked model views, paper entities, and dimensions with geometry fingerprints

Object nodes keep stable Cadverix 3D object IDs. Groups refer to child node IDs instead of array positions. Fillet/chamfer history refers to explicit “before” nodes. Feature dependencies are explicit and checked for cycles.

Nodes reference display edges through `cadDisplayEdgesAssetId`; the edge version remains in the shape definition. Each distinct edge array is stored once, including references from groups and reversible edge-treatment history. Mesh coordinate arrays, B-Rep strings, and image data URLs are encoded and hashed once per immutable resource. Weak caches and a bounded text cache reuse this work on subsequent saves. Import restores shared mesh and edge objects across undo states. Long node traversals yield to the event loop between batches.

New display-edge assets use `SKFEDG1` little-endian binary: an 8-byte magic, the edge count, the total coordinate count, one 32-bit length per edge, then the coordinates as doubles. Earlier format-2 JSON edge assets with media type `application/vnd.sketchforge.display-edges+json` are also accepted.

## What is preserved

- All current native shape kinds and their editable parameters
- Position, rotation, dimensions, mirrors, colour, solid/hole role, visibility, and lock state
- Nested groups, boolean operands, subtraction results, and intersection metadata
- Sketch points, lines, Bezier/smooth handles, disjoint profiles, reference images, and extrusion depth
- Imported 3MF, STL, SVG, and STEP sources, stored once and reused by instances
- Exact imported STEP data, current exact CAD B-Rep, display edges, chamfer/fillet settings, and reversible edge-treatment history
- Undo and redo states according to the export choice: Unlimited, 100, 50, or 30 recent actions. Unlimited means every state still retained by the editor, including available redo states.
- Free and body-pinned workplane notes, including text, world position, normalized body attachment, and collapsed state
- Workspace units, grid/snap settings, dimensions, and active offset workplane

Native primitives are regenerated from definitions and do not receive mesh assets. Source-backed 3MF, STL, SVG, and STEP objects are regenerated from their original asset. Derived mesh assets are written only when the current editor has genuinely baked geometry (for example a boolean or edge treatment), or when an older local project no longer has its original imported source.

## Opening safely

Cadverix 3D inspects ZIP metadata before expansion and validates the entire project before changing local state. It rejects unsafe paths, encrypted or unsupported compression, excessive expansion, malformed shapes/sketches, duplicate IDs, missing assets, hash mismatches, invalid transforms, unknown shape or operation types, cyclic groups/features, and unsupported versions.

Opening a valid `.skf` creates a new local project. It does not overwrite the project that is currently open. The imported project is then saved through the existing dashboard, thumbnail, IndexedDB, history, and editor lifecycle.

Current safety limits are 512 MB compressed, 1 GB expanded, 256 MB per asset, 64 MB for `project.json`, 4,096 archive entries, 100,000 object nodes per state, and 5,001 distinct states. The live editor retains at most 5,000 history entries and 64 MB of serialized history, so Unlimited means all history currently available inside those safety limits.

Each state accepts at most 200 workplane notes and 2,000 UTF-16 code units per note. Invalid accessory note data is normalized or ignored instead of making otherwise valid CAD geometry unreadable.

## Compatibility and migrations

Modeling-only saves use format version 2 and minimum reader version 2. Projects containing `editor.workspace.drawing` use format version 3 and minimum reader version 3, so older readers reject them instead of dropping the drawing. The current reader accepts packaged versions 1, 2, and 3, including version 1 inline display edges. The importer also migrates the documented version 0 pure-JSON prototype and preserves its object IDs and valid history.

Drawing-sheet data has its own version (currently 1). It stores view source IDs and orientation/scale/position, not duplicate meshes. Projected linework is regenerated from the model. Dimension anchors, paper entities, and title-block text are validated before import, including element limits and internal references. Model-space dimensions carry a geometry fingerprint so edits to a source cannot silently reuse stale values. Drawing undo/redo history is session-local; the saved package contains the current sheet state.

The upstream binary edge encoding requires an updated reader even on forks that previously implemented format 2 using JSON edges. Use copies of projects when testing this build against such an older installation.

The Export dialog can also write compatibility-checked Layerling `.lyl` packages. These use the `com.layerling.project` schema, Layerling MIME types, `.lylmesh`/`.lyledges` assets, and `LYLMSH1`/`LYLEDG1` binary headers. Layerling-compatible workplane notes are stored in each state and retain note-only undo history. Export is blocked rather than dropping Cadverix-only drawings, construction planes, fastener/thread models, sculpt provenance, or extended sketch data. LYL export is download-only; autosave, recovery backups, and shared storage remain SKF.

Future schema changes should add a version-to-version migration, run validation after every migration, and never mutate the user's original file.

## Current limitations

- Projects created before source-asset tracking cannot recover the exact original STL/SVG file. Their existing normalized editable mesh is preserved as a deduplicated legacy cache and is identified by the absence of a source asset.
- Cadverix 3D currently bakes the displayed result of booleans and edge treatments. `.skf` preserves the operands, group hierarchy, feature metadata, reversible history, exact B-Rep where available, and a derived-result cache; it does not add a new live parametric feature editor that the application does not yet have.
- The current workplane system stores a base plane plus numeric offset. It does not expose persistent associative face-workplane references, so `.skf` cannot preserve an association that the editor itself does not model.
- Existing sketch points, segments, curve handles, profiles, and extrusion depth are preserved, along with the constraint/dimension data supported by the current project reader.
- Camera position is intentionally omitted because the current project persistence system does not own it. It can be added as optional editor state in a compatible future version.
- OBJ is currently an export format, not an import format. An OBJ source-asset record is reserved in the schema for future import support.
