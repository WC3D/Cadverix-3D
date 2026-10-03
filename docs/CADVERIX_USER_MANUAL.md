# Cadverix 3D User Manual

## Editor reference

For ISO/ANSI technical sheets, model views, and drawing dimensions, open the **Drawing** tab beside Sculpt and see the [Drawing workspace guide](DRAWING_WORKSPACE.md).

Browser-based 3D modeling, 2D sketching, and fabrication export

See the [changelog](CHANGELOG.md) for release-specific additions and fixes.

![Cadverix 3D editor overview](media/cadverix-editor.png)

> This manual describes the core Cadverix 3D editor workflows. Projects are local-first and autosave in the browser. Menu labels and available properties can vary with the selected object or active tool. See [CAD edge tools](CAD_EDGE_TOOLS.md) and [Mobile Alpha](MOBILE_ALPHA.md) for the latest rim-treatment and touch workflows.

## Contents

1. Getting started
2. Navigating the editor
3. Creating and editing 3D geometry
4. Placement and construction planes
5. Combining and modifying geometry
6. Measurement tools
7. The 2D sketch workspace
8. Turning sketches into 3D models
9. Import, export, and project files
10. Workspace settings
11. Complete keyboard shortcut reference
12. Troubleshooting and current limitations

# 1. Getting Started

## What Cadverix 3D Does

Cadverix 3D is a browser-based modeler for creating parts from primitives or custom 2D profiles. It supports solid and hole workflows, boolean grouping, construction and placement planes, fillets and chamfers, sketch extrusion, revolve, sweep, and common fabrication formats.

Projects normally stay on the device in browser storage. No account is required. A server deployment can optionally provide shared SKF project storage and controlled local-folder exports.

## Browser Requirements

- A current browser with WebGL 2, IndexedDB, Web Workers, and WebAssembly.
- Hardware acceleration enabled for the 3D viewport and revolve preview.
- Enough local storage for imported files and project history.
- Network access is not required after the application and its local worker assets have loaded.

## Create Your First Model

1. Open the dashboard and select **Create new 3D design**.
2. In the editor, stay in the **Geometry** workspace.
3. Open **Shapes** and choose **Box**.
4. Select the box and use the handles or Shape Inspector to change its size and position.
5. Add a cylinder, change it to a **Hole**, and move it through the box.
6. Select both objects and choose **Group** to subtract the hole.
7. Open **Export** and choose STL or 3MF for 3D printing.

## Dashboard Basics

- **Create:** starts a new local project.
- **Open:** opens a local project card or an SKF package.
- **Import geometry:** creates a project from STL, 3MF, STEP/STP, or SVG files.
- **Rename:** changes the local project name.
- **Delete:** permanently removes the selected local project after confirmation.
- **Search and sort:** filter by name and sort by recent activity or name.
- **Grid/List:** change the project-card layout.
- **Shared:** available only when shared project storage is configured by the server administrator.

Projects autosave geometry, history, imported assets, workspace settings, and thumbnails. Opening a shared SKF file creates a local editable copy. Saving back to shared storage checks the server revision before replacing the file.

# 2. Navigating The Editor

## Main Areas

- **Top toolbar:** project, clipboard, history, shape, visibility, combine, modify, arrange, and output commands.
- **3D viewport:** selection, camera navigation, object transforms, workplane placement, and ruler tools.
- **Shape Inspector:** object type, dimensions, position, rotation, color, solid/hole state, sketch settings, and special properties.
- **Workspace tabs:** switch between Geometry and Sketch workflows.
- **Snap Grid:** sets movement and sketch precision.
- **Status message:** reports completed actions, requirements, and errors.

## Mouse And Camera Controls

| Input | Action |
| --- | --- |
| Left click | Select a shape or use an active handle/tool. |
| Shift + left click | Add or remove a shape from the selection. |
| Drag empty viewport | Marquee-select intersecting shapes. |
| Shift + marquee | Add marquee hits to the existing selection. |
| Right drag | Orbit the 3D camera. |
| Middle drag | Pan the camera. |
| Ctrl/Command + left drag | Pan the camera. |
| Mouse wheel | Zoom toward the pointer. |
| View cube | Switch to a face, edge, or corner view. |

Use **Home**, `F`, or the `Home` key to reset the camera. Press `O` to toggle perspective and orthographic projection. Use `+` and `-` to zoom without the mouse wheel.

> Camera Home restores a fixed default view. It is not a fit-selection command.

# 3. Creating And Editing 3D Geometry

## Primitive Shape Library

Open **Shapes** for basic and profile shapes in a wide icon-and-label grid. Open **Generators** for Gear, Screw, Washer, Nut, Spring, Honeycomb, and Bent Tube; these entries appear only in that menu. Each palette adapts to the available screen width and scrolls beneath its title and close button. Toolbar group outlines use consistent colors for each tool family, with labels and tooltips identifying the actions.

| Tool | Description | Useful properties |
| --- | --- | --- |
| Box | Rectangular solid, cutter, or rounded box. | Width, depth, height, corner radius, steps. |
| Cylinder | Circular or elliptical prism. | Width, depth, height, sides. |
| Sphere | Ellipsoid generated from a sphere. | Width, depth, height, resolution steps. |
| Cone | Cone or frustum. | Base radius, top radius, depth scale, sides. |
| Pyramid | Pointed polygonal solid. | Width, depth, height, sides. |
| Wedge | Sloped block. | Width, depth, height. |
| Text | Extruded 3D text. | Text, font, bevel, segments, dimensions. |
| Round Roof | Half-round roof profile. | Dimensions and side resolution. |
| Half Sphere | Upper half of an ellipsoid. | Dimensions and resolution. |
| Torus | Ring-shaped solid. | Width, depth, height. |
| Tube | Hollow cylindrical body. | Dimensions and wall thickness. |
| Gear | Spur, helical, or bevel-style gear. | Teeth, tooth size/width, center hole, helix angle and quality. |

New shapes are inserted on the active placement workplane. Their initial orientation follows that plane.

## Selection

- Click a shape to replace the selection.
- Shift-click to toggle another shape.
- Drag on empty space to create a selection marquee.
- Press `Escape` or click empty space to clear the selection.
- Press `Mod+A` to select all visible shapes.
- Hidden shapes are not selected by Select All.
- Locked shapes can be selected but cannot be moved through normal transform handles.

## Transform Handles

Selected shapes can expose controls for:

- Moving along the active workplane axes.
- Changing width and depth.
- Changing height.
- Raising or lowering elevation.
- Rotating around X, Y, or Z.
- Entering exact dimensions, movement distances, and angles.

Hold **Shift** while dragging a corner resize handle to preserve width/depth proportions. Hold **Alt/Option** to resize around the center. Hold both modifiers to combine those behaviors. Hold **Shift** while rotating to snap to 45-degree increments.

## Shape Inspector

The inspector shows only the controls supported by the current object. Common controls include:

- Name, color, visibility, and lock state.
- Solid or Hole mode.
- Width, depth/length, height, elevation, and position.
- X, Y, and Z rotation.
- Snap precision.
- Shape-specific radius, side, resolution, wall, text, or gear settings.

Press `Enter` after typing a numeric property to commit it. Press `Escape` to restore the prior displayed value.

## Moving With The Keyboard

- Arrow keys move selected unlocked shapes on the active placement plane.
- Hold Shift for 5-unit steps instead of 1-unit steps.
- Hold Mod with Up/Down to move along the placement-plane normal.
- Press `D` to drop selected unlocked shapes onto the active placement workplane.

## Clipboard And History

- Copy, cut, paste, duplicate, and delete work on selected 3D shapes.
- Paste creates new IDs and offsets the copies so they are visible.
- Clipboard data can be shared between Cadverix 3D tabs when browser permissions allow.
- Undo and redo are separate from the temporary history used while editing a sketch.
- History retention is configurable in Workspace Settings.

> Delete and Cut can remove selected locked objects. Lock protects normal transforms and inspector edits, not every destructive command.

## Visibility, Locking, And Separation

- **Hide selected:** hides unlocked selected shapes.
- **Show selected:** restores selected hidden shapes.
- **Show all hidden:** restores every hidden shape.
- **Lock:** prevents normal transforms and property changes.
- **Separate:** splits a mesh or grouped object into disconnected components when multiple components exist.

# 4. Placement And Construction Planes

Cadverix 3D uses two related plane systems.

## Placement Workplane

The placement workplane controls where new objects are inserted and how movement, nudging, and Drop to Workplane are oriented.

1. Select **Place workplane** or press `W`.
2. Click a planar model face.
3. Hold Shift while clicking to reverse the face normal.
4. Click empty grid space to return the placement workplane to the base horizontal plane.

Press `Shift+W` with exactly one visible shape selected to place the workplane on its local top face. Press `Escape` to cancel placement mode.

Picking a model face also creates and activates an associative construction plane for sketching.

## Persistent Construction Planes

Open **Geometry > Workplane** to manage sketch planes:

- Base XZ plane.
- Offset XZ/top plane.
- Offset XY/front plane.
- Offset YZ/side plane.
- Planes attached to planar model faces.

Face-attached construction planes follow movement, rotation, and resizing of the source object. Construction-plane helpers are locked and omitted from normal geometry exports.

## Plane Workflow Tips

- Select the intended construction plane before starting a sketch.
- Use a persistent construction plane for angled projection, sweep, or revolve workflows.
- Use placement planes for quick object insertion and movement orientation.
- Reset the persistent sketch plane from the Construction Planes panel when returning to Base XZ.

# 5. Combining And Modifying Geometry

## Solids And Holes

Any normal shape can act as a cutter:

1. Select the cutter shape.
2. Choose **Hole** or press `H`.
3. Position it so it intersects a solid.
4. Select the solid and hole together.
5. Choose **Group**.

Press `S` to change selected unlocked holes back to solids. Standalone holes are translucent and omitted from normal mesh/vector exports.

## Group And Ungroup

- Group requires at least two selected unlocked objects.
- A solid-only group creates one grouped object.
- A group containing solids and holes performs subtraction.
- Ungroup restores stored operands when available.
- If a hole completely consumes its solid, the operation can remove all selected operands. Use Undo to recover them.

## Boolean Intersection

Intersection requires at least one unlocked solid and one unlocked hole. The result keeps their overlapping volume.

If the intersection is empty, the selected operands may be removed. Use Undo if this was not intended.

## Align

Align requires at least two selected shapes.

1. Enter Align mode or press `L`.
2. Choose minimum, center, or maximum alignment on X, Y, or Z.
3. Hover an alignment point to preview.
4. Click an object to make it the anchor where available.

A locked selected object acts as the fixed anchor. Align mode and Mirror mode are mutually exclusive.

## Mirror

Mirror transforms selected unlocked shapes in place around the combined selection center.

1. Select one or more shapes.
2. Enter Mirror mode or press `M`.
3. Choose X, Y, or Z.
4. Review the preview and apply.

Mirror does not create copies. Duplicate first when both versions are required.

## Fillet And Chamfer

Requirements:

- Exactly one selected object.
- The object is unlocked and is not a hole.
- Geometry can be prepared by the local OpenCascade worker.

Workflow:

1. Choose **Fillet** or **Chamfer**.
2. Wait for edge preparation.
3. Click highlighted edges.
4. Hold Shift to toggle only the clicked edge rather than its tangent chain.
5. Adjust radius/distance, chamfer angle, sharp-edge threshold, tangent-chain behavior, resize behavior, and preview quality.
6. Select **Apply** or press `Enter`. Press `Escape` to cancel.

Applied features retain removable history when possible. Removing an older feature also removes newer features that depend on it.

## Boolean And Edge Limitations

Operations can fail on open, non-manifold, very complex, or unsuitable imported meshes. Cadverix 3D attempts exact, Manifold, and fallback methods, but not every triangle soup can become a valid solid. Edge preparation and complex STEP operations may take longer the first time because the local CAD kernel must load.

# 6. Measurement Tools

## Selection Dimensions

Transform overlays can show editable width, depth, height, elevation, rotation, and optional movement distances. Press Enter to commit a direct numeric edit and Escape to cancel it.

When movement dimensions are enabled, use Tab and Shift+Tab to move between settled movement fields.

## 3D Ruler

Open **Ruler tools** and choose:

- Add measurement.
- Move measurement points.
- Delete measurement parts.

Ruler points can attach to vertices, edges, and model surfaces. Clicking an edge can measure its full polyline length. Attached measurements follow transforms when the referenced topology remains available.

Ruler annotations are viewport-session state, not project geometry.

## Sketch Measure And Dimension

- **Measure:** temporary two-point distance. It does not constrain geometry.
- **Dimension:** persistent driving or reference dimensions stored with the sketch.

The underlying model uses millimeters. Some inspector controls convert display units, while sketch dimensions, ruler values, and transform overlays currently show raw model/mm values.

# 7. The 2D Sketch Workspace

## Start Or Edit A Sketch

1. Switch to **Sketch**.
2. Open **Sketch to 3D**.
3. Choose **Extrude sketch** or **Revolve sketch**.
4. Draw on the active construction plane.
5. Finish to create the 3D object, or cancel to discard the sketch.

To edit a sketch-derived object, select exactly one such object and choose **Edit sketch**. Finishing replaces the same 3D object. Canceling discards the edit.

Sketches are stored on their generated 3D objects rather than as separate dashboard documents.

## Sketch Navigation

| Input | Action |
| --- | --- |
| Mouse wheel | Zoom the sketch plate. |
| Middle drag | Pan. |
| Ctrl/Command + left drag | Pan. |
| Escape | Clear the active draft, chain, and selection. |
| Delete/Backspace | Delete selected sketch entities. |
| Mod+Z | Sketch undo. |
| Mod+Shift+Z or Mod+Y | Sketch redo. |

Escape does not exit the entire sketch. Use the Finish or Cancel controls for that.

## Drawing Tools

| Tool | How to use it | Notes |
| --- | --- | --- |
| Select | Click or marquee geometry, points, images, text, and regions. | Linked projection geometry is fixed. |
| Line | Click successive points; click an existing endpoint to connect or close. | Closing a loop switches to Select. |
| Bezier Curve | Click-drag points to pull symmetric handles. | Handles can be edited later. |
| Three-point Arc | Click the start endpoint, the end endpoint, then a point at the desired height/bulge. | Shows a live circular-arc preview; stored as editable Bezier spans, like sketch circles. |
| Smooth Curve | Click points along a flowing path. | Handles are regenerated for smooth tangency. |
| Center Circle | Click center, then radius point. | Stored as four editable Bezier segments. |
| Diameter Circle | Click opposite diameter endpoints. | Stored as four editable Bezier segments. |
| Corner Rectangle | Click opposite corners. | Horizontal/vertical constraints are added. |
| Center Rectangle | Click center, then a corner. | Horizontal/vertical constraints are added. |
| Polygon | Set 3-24 sides, click center, then a vertex. | Creates a regular closed profile. |
| Text | Click, type, then press Enter or click away. | Converts text to closed line contours. |
| Refine | Click a segment to add a point; click a point to remove it. | Two neighbors are reconnected where possible. |
| Erase | Click a point, segment, or visible dimension to remove it. | Use Delete for selected entities. |
| Dimension | Create driving line lengths or two-anchor references. | Persistent with the sketch. |
| Measure | Pick two positions for a temporary distance. | Does not constrain geometry. |

### Three-point Arc

Choose **Three-point Arc** in the sketch Draw toolbar (the arc with three round points). Click or tap the two endpoints first, then choose a third point on the desired curve to set its side and bulge. Mouse/pen movement previews the arc before placement. The third point lies on the arc; it is not a Bezier control handle.

The endpoints must be distinct, and the third point must be off the straight line between them. Invalid clicks leave the draft open so you can choose another position. Use **Cancel arc**, **Escape**, or switch tools to abandon a draft. A completed arc is one undoable action.

Click or snap to existing open endpoints to join the arc to the sketch. Shared endpoints are welded without changing the adjoining curves. Two arcs joining the same endpoints, or an arc joining the ends of a line, form a closed profile; closing a profile switches to Select.

Arcs use editable cubic Bezier spans of at most 90 degrees, following the existing circle representation. This closely approximates a circle and passes through all three chosen points; subsequent handle edits can change its circular shape. The separate **Bezier Curve** tool has an S-shaped icon with square tangent handles and still uses click-drag drawing.

## Point And Curve Editing

Select a point to change its mode:

- **Corner:** removes handles and uses straight incident segments.
- **Smooth:** creates linked opposing curve handles.
- **Split:** allows incoming and outgoing handles to move independently.
- **Fix:** locks the point at its current coordinates.

## Snapping

Sketch snapping can use:

- Existing endpoints.
- Segment midpoints.
- Closed-profile centers.
- Text anchors.
- X/Z alignment guides through candidates.
- The configured Snap Grid.
- Optional visible grid-line magnetism.

Exact geometry anchors take priority. Endpoint snaps can reuse existing points and create connected topology. Midpoint and alignment snaps position geometry but do not create persistent constraints.

## Constraints

Select a straight segment to apply Horizontal or Vertical. Applying one removes the opposite constraint. Rectangles receive both automatically where appropriate.

Select a point and use Fix to hold it in place. Moving constrained geometry invokes the solver and may move connected points. Current sketch constraints do not include tangent, parallel, perpendicular, equal, angle, radius, or diameter.

## Dimensions

### Driving Line Length

1. Choose Dimension.
2. Click a straight line.
3. Enter a positive Length.
4. Set, update, or remove the dimension.

The solver adjusts endpoint geometry. In Select mode, the dimension label can be repositioned.

### Reference Distance

With Dimension active, select two anchors from endpoints, midpoints, or intersections. Reference dimensions update with geometry but do not drive it. Duplicate and zero-length references are rejected.

## Reference Images

1. Use Select and choose **Add Image**.
2. Choose PNG, JPEG, WebP, GIF, BMP, or SVG.
3. Drag the image or use its handles.
4. Adjust width, height, opacity, position, and aspect lock in the inspector.

Images are references only. They do not create extrusion regions.

## Sketch Text

Sketch text converts immediately to geometric line contours. It can form regions and can be refined, erased, mirrored, or patterned. There is no semantic text/font/size editor after placement.

## Project Geometry Into A Sketch

1. Choose **Project** in an active sketch.
2. Select a source sketch-derived object or 3D shape.
3. Choose **Linked reference** or **Editable copy**.
4. Apply Project.

A sketch source projects its native profile. A 3D shape creates a plane intersection, not a silhouette. Linked references refresh when the sketch reopens and cannot be directly edited.

## Offset

Select one or more non-branching connected segments, choose Offset, enter a nonzero distance, and optionally include the connected path. Positive values offset closed loops outward and open paths to their left. Bezier curves are flattened into line segments in the result.

## Sketch Mirror And Patterns

- **Mirror:** copy around Origin X, Origin Z, or a selected segment.
- **Rectangular pattern:** 1-20 rows/columns with configurable spacing and optional selected-line direction.
- **Circular pattern:** 2-40 instances around the sketch origin or a selected point, over a nonzero total angle.

These operations keep the originals and select the generated copies. Compatible constraints and dimensions are remapped where possible.

# 8. Turning Sketches Into 3D Models

## Extrude

1. Start Extrude Sketch.
2. Draw one or more closed regions.
3. In Select mode, click shaded regions or use All/Clear.
4. Finish the sketch.
5. Adjust Height on the resulting shape.

Regions support disjoint solids, nested holes, islands, overlaps, and open dividers crossing a closed face. At least one valid region must be selected. New extrusions start at 10 mm and extend along the positive plane normal.

Cadverix 3D first requests exact OpenCascade/B-Rep geometry. If that fails, it falls back to a triangulated mesh that remains sketch-editable but may not retain exact CAD edges.

## Revolve

1. Start Revolve Sketch.
2. Draw on the left side of the marked vertical revolve axis.
3. Review the live 3D preview.
4. Finish the revolve.
5. Adjust start angle, sweep angle, side count, and open-path thickness.

Closed paths create filled sections. Open paths use the Thickness setting. Geometry crossing the axis is clipped and geometry fully on the unusable side is ignored. Revolve creates Manifold mesh geometry rather than an exact OCCT B-Rep.

## Sweep

1. Draw exactly one closed section and one separate open path.
2. Use Select and marquee every segment in both paths.
3. Choose Sweep.
4. Confirm Create Sweep.

Sweep supports straight and Bezier paths. It creates the body immediately and stores section/path IDs for later sketch editing. Holes, multiple sections, multiple paths, branching, and connected section/path topology are not supported.

# 9. Import, Export, And Project Files

## Import Formats

| Format | Support | Notes |
| --- | --- | --- |
| STL | Import | Triangulated mesh. |
| 3MF | Import | Package transforms, declared units, mesh geometry, and display color. |
| STEP/STP | Import | Requires solid geometry and retains B-Rep data. |
| SVG | Import | Converts valid closed vector geometry to a shallow extrusion. |
| SKF | Open project | Restores editable project state and assets. |
| OBJ | Not imported | OBJ is export-only. |

Multiple geometry files can be imported together. Importing from the dashboard creates a new local project.

## Export Formats

| Format | Best use | Behavior |
| --- | --- | --- |
| STL | Slicers and printing | Triangulated mesh. |
| 3MF | Modern print workflow | Millimeter package with object names and colors. |
| OBJ | Mesh interchange | General triangulated geometry. |
| SVG | 2D manufacturing | Top-view silhouette with holes. |
| STEP | CAD exchange | Exact supported primitives and retained STEP B-Reps. |
| SKF | Editable backup/share | Geometry, sketches, history, assets, settings, and CAD data. |

If shapes are selected, direct exports use selected solids. With no selection they use all non-hole, non-construction-plane shapes. Hidden solids can be included in an all-project export, so select the intended objects when hidden content must be excluded.

Exact STEP export is currently limited to supported boxes, cylinders, spheres, cones, and imported STEP bodies that retained B-Rep data. Unsupported mesh and swept geometry is reported as skipped.

## SKF Project Packages

SKF can preserve:

- Native and imported geometry.
- Groups and boolean operands.
- Sketch profiles, constraints, dimensions, projections, images, and feature metadata.
- Construction and placement planes.
- Undo/redo history according to the chosen limit.
- Workspace settings and themes.
- Original imported source assets and exact CAD data.

Opening an SKF package creates a new local project rather than overwriting the currently open one.

## Download Destinations

- **Browser downloads:** available in normal and static deployments.
- **Local folder:** available in localhost server builds. The folder must already exist and be inside Downloads or `SKETCHFORGE_LOCAL_DOWNLOAD_ROOT`.
- **Shared storage:** SKF-only and available when configured by the server administrator.

# 10. Workspace Settings

## Appearance

- Cadverix 3D, Light, SolidWorks, Inventor, and Custom themes.
- Custom UI, background, grid, shape, selection, hole, and outline colors.
- Shadows.
- Movement dimensions.
- Camera zoom speed.
- Cruise while adding shapes setting.

## Measurement

- Metric, Imperial, or Bricks.
- Millimeters, centimeters, meters, inches, feet, or studs.
- One to three decimal places.
- Snap Grid from Off through fine millimeter steps and Brick/8 mm.

## Workplane

- Width and depth from 60 to 2000 mm.
- Grid block size from 1 to 200 mm.
- Preset or custom grid color.

## History

- 30, 50, 100, Unlimited, or a custom limit up to 5000 actions.
- Lowering the limit permanently removes older history states from the current project.

## Dashboard Export Settings

Dashboard Settings chooses between normal browser downloads and an approved local-folder destination. It does not change local project autosave.

# 11. Complete Keyboard Shortcut Reference

## Modifier Names

In the tables below, **Mod** means:

- macOS: Command
- Windows/Linux: Ctrl

Application shortcuts are ignored while typing in an input, text area, select, or content-editable field. Extra modifiers are accepted by several shortcuts, so prefer the exact combinations shown.

## Project And Selection Shortcuts

| Shortcut | Context | Action |
| --- | --- | --- |
| `Mod+Z` | Geometry or Sketch | Undo in the active mode. |
| `Mod+Shift+Z` | Geometry or Sketch | Redo in the active mode. |
| `Mod+Y` | Geometry or Sketch | Alternate redo. |
| `Mod+C` | Geometry | Copy selected shapes. |
| `Mod+X` | Geometry | Cut selected shapes. |
| `Mod+V` | Geometry | Paste from available clipboard data. |
| `Mod+D` | Geometry | Duplicate selected shapes. |
| `Mod+A` | Geometry | Select all visible shapes. |
| `Mod+G` | Geometry | Group selected unlocked shapes. |
| `Mod+Shift+G` | Geometry | Ungroup selected groups. |
| `Mod+L` | Geometry | Toggle lock for the selection. |
| `Mod+H` | Geometry | Toggle selected visibility. |
| `Mod+Shift+H` | Geometry | Show all hidden shapes. |
| `Delete` or `Backspace` | Geometry | Delete selected shapes. |
| `Delete` or `Backspace` | Sketch | Delete selected sketch entities; otherwise clear a temporary measurement. |
| `Escape` | Geometry | Clear shape selection; active contextual tools may also cancel. |
| `Escape` | Sketch | Clear the active draft, chain, and selection without exiting the sketch. |

## Movement And Modeling Shortcuts

| Shortcut | Context | Action |
| --- | --- | --- |
| `Left` / `Right` | Geometry | Nudge along placement-plane X by 1. |
| `Up` / `Down` | Geometry | Nudge along placement-plane Z by 1. |
| `Shift+Arrow` | Geometry | Nudge by 5 instead of 1. |
| `Mod+Up` / `Mod+Down` | Geometry | Move by 1 along the placement-plane normal. |
| `Mod+Shift+Up` / `Mod+Shift+Down` | Geometry | Move by 5 along the placement-plane normal. |
| `D` | Geometry | Drop selected unlocked shapes to the placement workplane. |
| `H` | Geometry | Change selected unlocked shapes to holes. |
| `S` | Geometry | Change selected unlocked shapes to solids. |
| `L` | Geometry | Toggle Align mode. |
| `M` | Geometry | Toggle Mirror mode. |

> `S` is Make Solid, not Save. Projects autosave and Cadverix 3D has no manual Save shortcut. If a browser/operating-system combination such as Mod+S or Mod+M reaches the editor, the matching modeling command can run.

## Viewport And Workplane Shortcuts

| Shortcut | Context | Action |
| --- | --- | --- |
| `W` | 3D viewport | Toggle placement-workplane mode. |
| `Shift+W` | 3D viewport | Place on the selected shape's top face when exactly one visible shape is selected; otherwise toggle placement mode. |
| `F` | 3D viewport | Reset camera to Home. |
| `Home` | 3D viewport | Reset camera to Home. |
| `O` | 3D viewport | Toggle perspective/orthographic projection. |
| `=` or `+` | 3D viewport | Zoom in. |
| `-` or `_` | 3D viewport | Zoom out. |
| `Escape` | 3D viewport | Cancel workplane placement or reset active ruler modes. |

## Pointer Modifiers

| Input | Context | Action |
| --- | --- | --- |
| `Mod` + left drag | 3D viewport or Sketch | Pan. |
| Middle drag | 3D viewport or Sketch | Pan. |
| Right drag | 3D viewport | Orbit. |
| Shift + shape click | 3D viewport | Toggle shape in selection. |
| Shift + empty marquee | 3D viewport | Add marquee hits to selection. |
| Shift + edge click | Fillet/Chamfer | Toggle only one edge instead of its tangent chain. |
| Shift + face click | Workplane placement | Reverse the picked face normal. |
| Shift + corner resize | Transform | Preserve width/depth proportions. |
| Alt/Option + resize | Transform | Resize around the center. |
| Shift + Alt/Option + corner resize | Transform | Proportional center-based resize. |
| Shift + rotate drag | Transform | Snap rotation to 45-degree increments. |

Transform modifiers can be pressed or released during the drag.

## Contextual Input Keys

| Key | Context | Action |
| --- | --- | --- |
| `Enter` | Transform, movement, inspector, edge field | Commit the typed value, usually by leaving the field. |
| `Escape` | Transform or edge numeric field | Cancel or restore the prior value. |
| `Tab` / `Shift+Tab` | Movement dimensions | Move forward/backward between available movement fields. |
| `Enter` | Sketch text | Commit non-empty text. |
| `Escape` | Sketch text | Cancel text placement. |
| `Enter` or `Space` | Focused sketch region | Toggle extrusion-region selection. |
| `Enter` | Sketch driving-length field | Apply the typed straight-line length. |
| `Enter` | Sketch image property | Commit width, height, opacity, or position. |
| `Enter` | Sweep, Project, Offset, Mirror, or Pattern form | Submit the active sketch operation. |
| `Enter` | Export filename | Run the selected export when allowed. |
| `Enter` | Active Fillet/Chamfer session | Apply a valid prepared preview. |
| `Escape` | Active Fillet/Chamfer session | Cancel the modifier session. |
| `Enter` | Workspace numeric setting | Commit width, length, grid size, or custom history limit. |
| `Escape` | Grid-color popover | Close the color popover and return focus. |
| `Enter` | Dashboard rename field | Confirm the project rename. |
| `Escape` | Sketch-create or Visibility menu | Close the open toolbar menu. |

Most full dialogs do not use Escape as a universal close command. Use their visible Close or Cancel control. One Escape keypress can clear selection while also canceling an active workplane, ruler, edge, or toolbar state.

# 12. Troubleshooting And Current Limitations

## The 3D View Does Not Start

- Confirm hardware acceleration and WebGL 2 are enabled.
- Close other graphics-heavy tabs or applications.
- Use the on-screen retry control.
- Update the browser and graphics driver.
- Revolve preview can show a fallback when WebGL is unavailable.

## A Boolean, Fillet, Or Chamfer Fails

- Confirm the object is a closed solid rather than an open mesh.
- Simplify highly detailed imported geometry.
- Check that a hole actually intersects its solid.
- For edge tools, select exactly one unlocked solid.
- Try Draft preview quality before Standard or Fine.
- Undo if an empty boolean removed the operands.

## A Sketch Will Not Extrude

- Confirm at least one shaded bounded region exists and is selected.
- Close small endpoint gaps.
- Remove zero-length or duplicate segments.
- Avoid self-intersecting loops unless the intended split regions are visible.
- Open-only geometry cannot form a normal extrusion region.

## A Sweep Will Not Build

- Select exactly one closed section and one separate open path.
- Include every segment in both paths.
- Remove branches and shared endpoints between section and path.
- Holes and multiple sweep paths are not currently supported.

## A Projection Is Empty

- A 3D source must intersect the active sketch plane.
- Projection is a plane intersection, not a camera silhouette.
- Geometry perpendicular to the plane can collapse.
- Prefer a persistent construction plane for angled workflows.

## Import Or Export Issues

- OBJ is export-only.
- STEP export skips unsupported mesh/text/sweep bodies rather than faceting them.
- 3MF and SKF enforce archive and asset safety limits.
- Local-folder export works only in an eligible localhost server deployment and approved directory.
- Select intended visible objects before export when hidden objects must not be included.

## Unit Display

The model kernel uses millimeters. Inspector and edge-modifier fields support configured display units, but sketch dimensions, 3D ruler values, transform labels, and movement overlays currently display raw model/mm values.

## Shortcut Focus And Browser Conflicts

Shortcuts are suppressed while typing in standard fields. They can still act when a toolbar button has focus. Several browser combinations share letters with Cadverix 3D commands. Use the exact shortcuts in this manual and click the viewport before issuing model commands.

## Quick Recovery Checklist

1. Read the status message at the bottom of the editor.
2. Press Escape to cancel the active contextual tool.
3. Check selection count, lock state, solid/hole mode, and active plane.
4. Use Undo before trying a different operation.
5. Save an SKF package before complex booleans or imported-mesh operations.

---

Cadverix 3D is an open-source project. For installation, server deployment, and contributor information, see the repository README.
