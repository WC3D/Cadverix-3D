# Parametric CAD architecture and milestones

Status for source release **1.21.0**. Implemented foundation and later milestones are distinguished below; this is not a claim that the full multi-plane loft workflow is available.

## Milestone 1 — assessment

The application is a Next.js/React client editor with Electron and static/web deployment paths. `CadverixEditor.tsx` owns immutable scene records, selections, tool state, modeling commands, and snapshot history. `WorkplaneViewport.tsx` renders Three.js objects and handles picking, orbit/pan/zoom, face/edge tools, and manipulators. `SketchWorkspace.tsx` is a normal-to-plane SVG editor; it already keeps geometry in local 2D coordinates and supports precise zoom-aware snaps, dimensions, trim/extend, projection, offset, mirror, and patterns.

Geometry is hybrid, not mesh-only:

- `sketchCad.worker.ts` builds exact OpenCascade B-reps and tessellations through the installed `occt-wasm` kernel.
- `cadModifier.worker.ts`, `brepKernel.ts`, and the existing modeling utilities implement exact modifications where supported.
- Manifold and Three.js CSG supply existing mesh fallbacks. Three.js meshes are display/cache data, not a substitute for an exact feature evaluator.
- `sketchCadProfile.ts` and `polygon-clipping` already identify selectable bounded regions, holes, intersections, and open dividers.
- `sketchConstraints.ts` is a small propagation solver for horizontal, vertical, fixed points, and line lengths. It is **not** a general nonlinear geometric solver or a reliable degrees-of-freedom analysis.
- `constructionPlanes.ts` supplies rigid origin/quaternion transforms, offset and angled planes, face attachments, and parallel midplanes. Plane resolution currently lives in the editor.

Persistence uses immutable scene records, `editorHistory.ts`, IndexedDB resource deduplication (`projectShapePersistence.ts` and `app/page.tsx`), and compressed SKF packages (`skfProject.ts`). SKF versions 1–4 cover older modeling projects, display-edge resources, drawings, and PCB documents; format 5 adds independent-sketch/source-reference and three-point-plane semantics only when needed. The native reader accepts versions 1–5. Existing packaged feature lists describe outputs; they are not an executable regeneration graph. STEP retains supported exact solids; STL is tessellated output only.

### Integration decisions

1. Keep the existing renderer, kernels, editor history, and resource storage. Add no dependency for the foundational work.
2. Represent an independent sketch as a non-solid document node in the existing immutable scene collection, just as reference planes are already non-solid nodes. Its stable ID/name, local entities/constraints, plane attachment, and projection references are authoritative. Derived profile topology is calculated, not persisted as stale tessellation.
3. Render sketches as wires; exclude them from solid tools and manufacturing exports. Do not disguise an independent sketch as a thin solid.
4. Add stable source-sketch IDs to new features. Legacy bodies with embedded profiles remain readable and editable; do not rewrite existing history automatically.
5. Version only documents using new node semantics. Old documents remain at their existing format. Unsupported older readers must reject new documents rather than silently lose sketches.
6. Resolve dependencies in topological order, reject cycles and unsafe deletions, and keep last-good geometry on evaluation failure. Do not use transient mesh indices as durable references.

## Implementation sequence and acceptance gates

### Implemented foundation in 1.21.0

- Independent `sketchProfile` document nodes with stable IDs/names, local points/curves/constraints/dimensions, rigid plane attachments, and derived display wires. Open sketches can be saved without producing a solid.
- Model-browser edit/extrude/rename/visibility actions and reference-plane access. Solid manipulators and manufacturing exports exclude reference nodes.
- Editable existing principal/offset, angle, face-offset, and midplane definitions, plus non-collinear three-point plane creation/editing. Dependent sketches and bodies follow plane changes without rewriting local sketch entities.
- Deterministic, non-recursive dependency ordering, missing-reference/type checks, cycle rejection, and referenced-node deletion protection. These are foundations for the feature engine, not a claim of a general evaluator.
- Linked exact extrusions can reuse a saved sketch. Saving a source edit atomically rebuilds its directly linked extrusions; kernel failure or stale asynchronous results leave the last committed source and solids intact. The existing downstream-modifier safeguard remains in place.
- SKF format/reader version 5 only for new sketch/reference semantics; old projects remain readable and ordinary exports retain their prior version. Native history/IndexedDB persistence includes sketches. Older readers reject new semantics instead of dropping them.
- Original 3D camera pose/projection/zoom are remembered when returning from the normal-to-plane SVG sketch editor.
- Body-reference silhouettes use the shared Manifold/Clipper2 runtime to union projected surfaces and simplify their outline. This replaces partial depth slices, unmerged face boundaries, and the JavaScript clipping path that failed on saved boolean meshes. The model remains unchanged; runtime readiness and projection failures are visible in the sketch UI.
- Reference inputs are memoized before passing them into the sketch workspace, avoiding repeat projection on unrelated editor renders. Native cross-sections are explicitly released. Reference helpers are hidden by default unless selected, with an explicit show-all display control.
- Plane normalization preserves already-valid axes to stop the dashboard persistence loop. Missing nonempty saved records and failed reads do not create empty autosaving replacements; blocked database opens and write failures are reported. These protections do not guarantee recovery of unsaved or already lost geometry. See [storage limits and recovery](MODELING_AND_STORAGE.md#local-recovery).

The foundation does not implement native ellipse/arc radius constraints, tangent planes, arbitrary hinge-axis selection, lofts, a complete solver, a visible executable feature timeline, general transitive geometry regeneration, or persistent topological face/edge naming. Linked projected geometry still refreshes when its sketch is reopened or rebuilt; it is not yet a general reactive feature graph. Unsupported dependent modifiers block a source rebuild instead of silently losing work. Cross-project clipboard/library reference remapping is not implemented: changes with missing sketch/plane dependencies are rejected; open the native SKF project to retain the whole document.

| Milestone | Increment | Required evidence |
| --- | --- | --- |
| 1 | This assessment and integration plan | Existing architecture, kernels, file formats, and limitations identified |
| 2 | Independent local-coordinate sketches, plane management, saved reusable sketches | Round-trip transforms, arbitrary-plane placement, save/reopen, undo/redo, plane changes without changing local entities, dependency validation |
| 3 | Mathematical curve entities, construction geometry, extended dimensions, real solver | Constraint residuals/DOF/conflicts; curve and topology regression tests, not visual alignment alone |
| 4 | Executable typed feature graph with stable inputs and regeneration states | Dependency closure, topological evaluation, cycle prevention, rollback/last-good results, unaffected-feature reuse |
| 5 | Extrude/revolve evaluators on graph inputs | Exact solid validity/volume, operation modes, edit/regenerate and persistence tests |
| 6 | Multi-plane B-rep loft and sweep | Ordered transformed kernel wires, solid/surface validity, mixed sections, profile alignment, failures, dependency regeneration |
| 7 | Advanced feature evaluators, browser/history UI, robust subshape naming and exports | Fillet/cut/pattern regeneration, persisted references, export/reimport geometry tests |

### Mandatory multi-plane model

The full requested circle → offset ellipse → tilted rounded rectangle → loft → face cut → diameter edit → regenerate → save/reopen scenario is the integration gate for milestones 3–7. The installed kernel exposes loft and sweep APIs, but the application does not yet have native ellipse/rounded-rectangle sketch parameters, a complete solver, a loft evaluator, or persistent downstream face naming. The complete scenario must be reported as **unsupported**, not replaced by a visual mesh loft or a fabricated passing test, until those pieces are integrated.

### Compatibility and scope

Keep existing direct modeling, embedded sketch features, local project recovery, export formats, and keyboard/touch/pen workflows. Existing analytic face attachment is based on the application's current source-frame reference, not a proven persistent topological face identifier. Tangent planes, arbitrary hinge axes, guide rails, full constraint DOF, and general downstream regeneration need explicit later implementations and tests.
