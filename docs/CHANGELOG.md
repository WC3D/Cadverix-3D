# Changelog

## Unreleased

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
