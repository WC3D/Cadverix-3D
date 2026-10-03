# Changelog

## Unreleased

- Removed vulnerable transitive `braces` and `http-cache-semantics` dependencies by replacing `patch-package` with a dependency-free compatibility installer and using `@electron/get` 5.1.0 for electron-builder on Node 24.
- Added a **Drawing** tab beside Sculpt for 2D CAD sheets: ISO A0–A4 and ANSI A–E paper templates, title blocks, first-/third-angle layouts, draggable model views, custom rotations, scale, hidden edges, and independent drawing history.
- Added paper lines, rectangles, circles and notes, plus horizontal, vertical, aligned, angular, radius and diameter dimensions. Source-geometry changes flag model measurements for review instead of silently retaining outdated values.
- Added physical-size SVG and Print/PDF output and project autosave for drawings. Drawing projects use SKF format/minimum reader 3; modeling-only projects remain format 2 and older files remain readable.
- Added color-coded toolbar group outlines and wide Shapes and Generators palettes, with generator entries appearing only in Generators. Palettes adapt between three, two, and one column, stay inside the viewport, and keep their title/close control visible while scrolling. Bent Tube now has a dedicated curved-tube menu icon.
- Fixed Honeycomb and Bent Tube previews retaining stale geometry after parameter edits. The viewport's shared geometry cache now includes the complete parametric input set, with rendered-image regressions for immediate updates, undo/redo, autosave, and reload in Chromium and WebKit.
- Redesigned the Cadverix 3D logo with a C3D monogram, isometric cube, drafting pencil, sketch curve, and measurement/grid details; added dedicated Apple touch and PNG favicon assets.
- Renamed the product to **Cadverix 3D** across the browser editor, dashboard, desktop application, installers, export labels, current documentation, and MCP tooling, with a new vector/native application icon.
- Added `CADVERIX_` configuration names, `cadverix_*` MCP tools, and `/api/cadverix-mcp`, retaining legacy aliases and persisted project/storage identifiers for compatibility. Release/update links now use the existing WC3D repository. See [rename compatibility](CADVERIX_REBRAND.md).
- Updated installer verification for the spaced `Cadverix 3D` product name and aligned desktop web builds with the configured Webpack pipeline. New OBJ exports explicitly declare Y-up coordinates while legacy branded Z-up files remain readable.
- Hardened the macOS release action against shell template injection: architecture, signing state, and artifact suffixes now pass through quoted environment variables, and the architecture input is restricted to `x64` or `arm64` before building.

## 1.0.12

### CAD edge tools

- Added a rounded-rim Fillet path for supported complete, convex, horizontal outer rims on imported meshes. Rational circular profiles follow the adjacent wall slopes, avoiding the native 121-edge fillet-builder memory fault reproduced on the door-repair STL.
- Added a tapered-cut Chamfer path for supported faceted outer rims. Rim treatments validate available material and the resulting solid, preserve the body below the treatment band, and retain B-Rep geometry.
- Stop treating WebAssembly memory faults as retryable topology failures. Faulted workers are replaced, including when optional exact preview serialization fails.
- Added fault diagnostics with the operation stage, geometry strategy, selected edge IDs, amount, and underlying error, logged under `[SketchForge CAD]` and available through the local MCP error report.

### Editor and mobile alpha

- Prevent mobile object Multi mode from injecting Shift into Fillet/Chamfer taps and silently selecting one edge instead of the tangent chain. The Multi control is hidden during edge treatment and restored afterward.
- Fixed a viewport settings feedback loop that could trigger React's maximum-update-depth error. Settings notify persistence at edit time, incoming values are compared before updating state, and saved defaults no longer override later snap/theme choices.
- Fixed wheel/trackpad zoom over selection handles by using a native non-passive listener, eliminating the repeated `preventDefault` warnings.

### Dependencies and validation

- Added a reproducible `three-bvh-csg@0.0.18` compatibility patch that replaces deprecated `maxLeafSize` with `targetLeafSize` in its ESM and CommonJS builds. Installation applies it through `patch-package`, and Docker copies the patches before installing dependencies.
- Added mathematical radius/tangency checks, real-kernel solid/volume/B-Rep tests, worker-recovery and diagnostic tests, and browser coverage for wheel zoom and settings persistence.
- Added an opt-in local-project regression covering actual rim taps, Fillet/Chamfer preview and Apply, and Multi on/off in Chromium and WebKit. The project fixture remains external to the repository.
- Updated the application version, README badge, and SKF `createdWithVersion` metadata to 1.0.12. The SKF format version remains 2.

## 1.0.11

- Added a dedicated **Generators** toolbar menu and moved Gear, Screw, Washer, and Nut out of the basic Shapes menu.
- Added editable, watertight screw, washer, and hex-nut generators that participate in selection, transforms, booleans, mesh exports, and editable `.skf` project persistence.
- Added ISO metric presets for M3, M4, M5, M6, M8, M10, and M12 threads, including standards-based hex-head across-flats dimensions, head heights, nut widths, and nut thicknesses.
- Added common UNC and UNF presets from #8 through 3/8 inch, with inch thread pitch and common ASME hex-head and finished-nut dimensions converted to millimeters.
- Added custom thread pitch, depth, handedness, quality, shaft diameter, bore diameter, head height, and across-flats controls.
- Added internal and external threading options to cylinders, including right- and left-hand threads.
- Added exact OpenCascade B-Rep STEP construction for generated screws, nuts, washers, and internally or externally threaded cylinders. STEP generation now guards against thread definitions exceeding 80 turns to avoid unsafe kernel workloads.
- Added dedicated screw, washer, and hex-nut menu artwork and updated the Center Rectangle sketch icon with a visible center point.
- Added geometry, catalog, persistence, and real-kernel STEP round-trip coverage for fasteners and threaded parts.

## 1.0.10

- Fixed STEP export for filleted and chamfered objects that retain exact CAD B-Rep geometry.
- Fixed three-point arcs creating separate coincident endpoints instead of joining existing open paths. Arc joins now preserve curve handles and produce closed, selectable profiles, including when the endpoints are picked in the same order.

- Added a Three-point Arc sketch tool: choose start and end points, then the bulge, with a live preview, cancellation, and one-step undo. Arcs use editable Bezier spans, consistent with sketch circles. Updated the separate Bezier Curve icon to show tangent handles.

- Arrow-key holds (including Ctrl/Cmd+arrow elevation changes) now finish as one undo step and one save on release. Separate taps remain separate undo steps.
- Reduced autosave work after transforms by sharing CAD display edges across undo states and reusing immutable mesh, B-Rep, and image encoding.
- Added `.skf` format 2 shared display-edge assets, with continued reading of format 1 packages and legacy JSON projects. New saves require the updated reader.
- Display-edge assets now use the compact upstream `SKFEDG1` binary encoding. Earlier JSON display-edge assets remain readable; binary saves require a reader with binary display-edge support.

## 1.0.9

- Corrected Top and Bottom camera views so they align exactly with the vertical axis in both perspective and orthographic projection.
- Added Ctrl/Cmd + right-button panning in Sketch mode while preserving middle-button panning.

## 1.0.8

- Duplicated objects now stay in the exact position of their source instead of receiving an automatic offset.
- Added geometry shortcuts: `R` rotates selected objects by 45 degrees and `Shift+R` rotates them by 22.5 degrees around the active workplane normal.
- Corrected rotation controls so objects turn in the direction indicated by the pointer on every rotation plane.
- Kept selection outlines, resize anchors, and height controls stable during close zoom while naturally hiding controls that leave the viewport.
- Kept object faces visible from inside the object and hid rotation controls while the camera is inside the selection.

## 1.0.7

- Raised the supported `project.json` size in `.skf` packages from 32 MiB to 64 MiB and compacted new project exports without removing editable data.
- Reused decoded derived-mesh data across restored history states to reduce memory pressure when opening large `.skf` projects.
- Prevented workspace-only changes from advancing the persisted shape revision and replacing newer live objects with an older snapshot.

## 1.0.6

- Fixed dense STL imports failing with `Invalid string length` while creating their initial undo-history fingerprint.
- Streamed large numeric mesh arrays into deterministic hashes instead of converting millions of coordinates to one oversized JSON string.

## 1.0.5

- Made the rotation handles larger and aligned their arrow glyphs with the model faces as the camera moves, including stable behavior on long objects.
- Positioned the lower rotation handle consistently at the model base and corrected its visual and drag directions.
- Added an optional **Select before moving** workspace setting so the first click selects an object without immediately dragging it.

## 1.0.4

- Fixed imported STL objects briefly appearing and then vanishing when a stale IndexedDB project read completed after the import.
- Prevented older persisted project data from overwriting newer live editor state during asynchronous project hydration.

## 0.1.0

- Initial open-source alpha.
- Browser-based 3D workspace with primitive shape editing.
- STL import and STL/OBJ export.
- Grouping and hole subtraction workflows.
- Local project dashboard with generated thumbnails.
