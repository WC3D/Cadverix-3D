# Layerling-inspired modifiers

Open **Geometry → Modify** or search for a tool with **Ctrl/Cmd+K**.
The row groups tools into **Transform**, **Shape**, **Print**, and **Mesh** dropdowns, retaining the existing icon sizes. Flexi joints, cookie cutters, and lids are under Print; offsets and face operations are under Shape; simplification and textures are under Mesh.
The row now covers every modifier category from the referenced Layerling toolbar.
This is core tool coverage, **not a bit-for-bit port of every upstream option**.

## Using a modifier

1. Select an unlocked model body. Flexi joints, cookie cutters, and lids also accept multiple selected solids and hole cutters.
2. Choose a modifier and adjust its settings. For face operations, choose CAD faces from the list; area, orientation, and coordinates identify each face.
3. Click **Preview modifier**. This does not change the saved project. The viewport shows the proposed geometry and the panel reports body/triangle counts.
4. Click **Apply modifier** to create one undo step, or **Cancel** to retain the source. Changing settings invalidates the preview.

Jobs run in disposable browser workers. Cancel terminates the worker. Jobs time out after 90 seconds. A source changed during calculation cannot be overwritten by its late result. Normal project autosave, SKF backups, mesh exports, and undo/redo operate on the applied results.

## New tools

| Tool | Behavior | Limits / differences from Layerling |
| --- | --- | --- |
| Flexi joints | Cuts a body into independently editable links with retained, print-in-place knuckles and sockets; automatic/manual counts, axis, diameter, end offsets, clearance, and swing. | Requires enough width, height, and spacing for retained sockets. Actual swing may be reduced to fit. Geometry is baked, not a live parametric feature. Calibrate printer clearance with a test print. |
| Cookie cutter | Uses the top-view silhouette to build cutting walls, rim, inner imprint walls, connecting bridges or a backing plate; adds the cutter beside the source. | Baked mesh rather than editable sketch components. Eight terraces approximate the cutting bevel. Bridge placement is automatic; upstream adjustable bridge counts, inner-edge controls, and junction fillets are not ported. Disconnected islands require a backing plate. No food-safety certification. |
| Lid | Plug, cap, combined groove, or flat plate; configurable thickness, per-side fit gap, lip depth, and wall. Adds a flipped, print-oriented lid beside the source. | Assumes a horizontal top rim. Non-flat lids require an open body. Test-print the fit; printer/material shrinkage is not compensated automatically. |
| Offset body | Uniform positive/negative CAD offset with retained B-Rep geometry. | Rejects invalid/collapsed offsets; exact STEP/B-Rep or fewer than 4,000 source mesh triangles. |
| Delete faces | Removes complete CAD features and heals surrounding faces into a closed solid, retaining B-Rep geometry. | Not arbitrary mesh-face deletion. Every selected face must actually disappear; an unhealable selection leaves the source unchanged. Face selection currently uses a list, not viewport highlighting. |
| Push / pocket face | Extrudes or pockets a planar CAD face; optional inset and separate editable extrusion/hole. | One face at a time. Inset supports a single boundary wire, not faces with holes. Rounded inset corners are not ported. |
| Simplify mesh | Reduces mesh detail within a maximum surface-deviation tolerance using the installed Manifold kernel. | Uses tolerance, not Layerling's target-triangle-count simplifier. Results replace exact CAD geometry with a mesh. |
| Surface texture | Inward/outward/bidirectional relief, spacing, depth, angle, width, top/bottom masks, triplanar/cylindrical/flat projection. All 16 pattern categories are exposed, including local image and text height maps. | This is a bounded procedural implementation, **not Layerling's full texture engine**. Pattern shapes/refinement differ. Text/images are repeating square raster tiles (up to 256×256), not surface-unfolded outline text. Cracks do not create separate inlay bodies. Individual picked-face/body masks, adaptive pattern-aligned refinement, wood species, image presets, and the full per-pattern controls are not ported. |

The pre-existing mirror, rotation pivot, arrays, face-hole patterns, split, chamfer, fillet, and hollow tools remain available. Their underlying implementations were not replaced.

## Geometry and resource limits

- Mesh modifiers accept at most 250,000 source triangles. Texture refinement is also capped at 250,000 triangles; use larger spacing when needed. Images and text need more refinement than simple patterns.
- Texture displacement requires a closed source mesh. Small depth is important for thin walls. Kernel validity is not a guarantee against every possible geometric self-intersection or printable wall-thickness issue; inspect the preview and slicer output.
- Local image height maps accept PNG/JPEG/WebP files up to 4 MB and process them locally. White is full relief and black is zero relief.
- Lids and cutters retain their source objects. Other modifiers replace the selection only on Apply; Undo restores the originals.
- Mesh outputs intentionally lose the source's parametric construction history. Undo and SKF history preserve the original editor state. STEP stays exact only for tools retaining B-Rep data; other results export as meshes.

## Attribution

Flexi-joint planning/construction and lid construction were adapted from **henmedia/layerling** (`flexiJoints.ts`, `lidTool.ts`); CAD face-healing validation follows `cadDeleteFaces.ts`. Reference repository tree: `9a6fb306b02088a0f0c4e1e771a3b298bfdfa72f` (2026-10-31). Upstream and this project are licensed under AGPL-3.0. Other tools reuse Cadverix's existing geometry, storage, worker, and history infrastructure with the differences documented above.
