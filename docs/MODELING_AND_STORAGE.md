# Browser modeling and capability-based storage

Modeling runs on the user's device in every deployment. Geometry tools do not
require a modeling server; shelling runs in the existing browser CAD worker.
Static hosting, including the asset-only Cloudflare deployment, serves the same
modeling application as Node, Docker, and Electron.

## Importing slicer 3MF assemblies

3MF import now resolves nested components across `.model` parts **inside the
archive**, including Production-extension component paths. IDs are scoped to
their source model; transforms and supported model units are retained when the
parts are assembled. Missing references, cycles, unsafe archive paths, and
excessive expansion fail before loading the assembled geometry.

The imported assembly remains a single editable mesh object. This change does
not add slicer-specific painted-face/material editing or external filesystem
references.

## Fractional measurements

Choose **Workspace settings → Measurement → Units → Imperial**. **Show inches
as** selects fractions rounded to 1/64 inch or decimals using the accuracy
setting. Viewport dimensions, lift labels, movement dimensions, tape-measure
labels, and sketch overlays follow the workspace units.

Editable viewport lengths and sketch segment lengths accept mixed fractions
such as `1 5/8` as well as decimals. Geometry remains in millimeters internally.
Opening and accepting an unchanged rounded label does not resize the model.
Angles continue to use degrees. Drawing sheets have their own unit settings.

## Printer presets

Open **Workspace settings → Workplane → Printer build volume**. The bundled
catalog includes ten common Bambu Lab, Prusa, Creality, and Elegoo configurations.
Selecting one sets the plate dimensions and maximum print height. Custom plate
dimensions and print height are also supported and saved with the project.

The viewport reports the configured volume and counts visible solids extending
outside it, using their transformed mesh vertices. It does not crop geometry or
prevent exports. These presets describe build envelopes, not slicing profiles,
filament settings, or direct printer connections. The catalog works offline.

## 3D patterns and face tools

Open **Geometry → Modify → Modeling tools**.

### Patterns

- **XYZ grid:** counts and spacing independently along each CAD axis. Z is
  height; X and Y lie on the base plate. Negative spacing is supported.
- **Circular:** count, total angle, axis, and whether copies rotate with the
  pattern. **Pick center on workplane** lets you click or tap a center on the
  active workplane using the current snap step. The panel returns with your
  settings preserved and shows the picked X/Y/Z coordinates. Escape or
  **Cancel picking** cancels the pick. **Clear workplane center** returns to the
  picked face pivot, or the world origin if there is no face pivot. The custom
  pattern center is session-local and does not change the face-rotation pivot.
- Counts include the originals. A full 360° circle does not duplicate its start.
- **Preview pattern** shows temporary copies. **Create pattern** creates the
  copies in one undo step. Closing the panel removes the preview.
- The limits are 256 objects including originals and one million display
  triangles. Copies are independent objects,
  rather than a persistent linked pattern feature.

### Face tools

- **Lay flat on face:** click a face of the selected geometry. The selection
  rotates to face the active workplane and moves against it, preserving the
  spacing between selected objects. The operation is undoable.
- **Pick face pivot:** click a selected object's surface. Coplanar triangle
  patches use their area-weighted center; curved/faceted picks without a planar
  patch use the picked point. This is a mesh-derived face selection.
- Use **Rotate selection**, **R / Shift+R**, or drag rotation handles to rotate
  around that pivot. The pivot is a session-local world point and is cleared
  when the selection changes. **Clear pivot** restores normal rotation.

## Shelling / hollowing

In **Modeling tools → Shell / hollow**, select one unlocked solid, choose wall
thickness and **Top**, **Bottom**, **Top and bottom**, or **Closed cavity**, then
press **Apply shell**. Openings are horizontal end faces along the vertical Z axis; use
Lay flat first when necessary.

The operation offsets surfaces inward and preserves an exact B-Rep alongside
the display mesh. It does not approximate wall thickness by scaling the body.
The resulting body supports ordinary editing/export and a single-step Undo;
wall thickness is not yet a separately re-editable feature in the inspector.

The worker checks that the result is valid and has less positive volume than
the original. Invalid thicknesses leave the source intact. Mesh reconstruction
is limited to 4,000 triangles; use exact STEP/B-Rep geometry for more complex
parts. **Close** cancels an active calculation, and a 60-second watchdog stops
stalled operations. Phone memory and CPU still determine calculation capacity,
even when the app is hosted by a powerful server.

## Sketch clipboard and corners

The sketch toolbar has **Copy**, **Cut**, **Paste**, and **Duplicate** buttons.
Ctrl/Cmd+C, X, V, and D do the same; Ctrl/Cmd+A selects the sketch entities.
This is an internal, session-local clipboard, so it also works on HTTP LAN
deployments without system-clipboard permission.

Copies receive fresh IDs, carry applicable constraints/dimensions, and paste
to the right of existing geometry to avoid accidentally welding coincident
points. Copied projections become independent geometry. Images and text can be
copied too. Each paste/cut is undoable.

Select a point where exactly two straight segments meet to expose **Fillet
corner** and **Chamfer corner**. The amount is a radius for a fillet and the
setback along each adjoining segment for a chamfer, in millimeters. Fillets use
a cubic Bézier arc approximation. Linked geometry and constrained/measured
corners must be released first; oversized or collinear corners are rejected.

## Storage & backups

Open **Storage & backups** on the dashboard. The manager enables filesystem
features only when the server advertises them.

| Deployment | Available storage |
| --- | --- |
| Any browser deployment | Existing private projects, local recovery snapshots, SKF backup downloads, restore as a new local copy |
| Node / Docker with shared storage configured | Filesystem folders, copy/move, upload from browser projects, revision-checked saves, retained versions |
| Packaged Electron | Same filesystem features using a local managed projects directory |
| Static / current Cloudflare assets deployment | Browser storage and downloads; no server-side folder writes |

### Local recovery

Successful project autosaves create recovery snapshots, at most once every two
minutes per project. Retention is five snapshots per project, twenty total, and
64 MB total. **Snapshot now** creates one immediately. Larger projects can use
**Download backup** instead. **Restore as copy** imports an SKF snapshot as a new
project without overwriting the current project.

Snapshots live in IndexedDB on the same browser origin as the application.
Clearing site storage removes them; downloaded SKF files are the independent
backup option. Snapshot failures do not prevent the main project autosave.

### Filesystem folders and versions

Configure `CADVERIX_SHARED_PROJECTS_DIR` for Node, or use the existing persistent
Docker project volume. The manager supports folder navigation/creation and
moving or copying a project to a destination such as `Parts/Bracket.skf`.
Existing revision checks prevent stale writes and moves from overwriting newer
work. Server projects still save back through the existing explicit shared-save
workflow; local edits continue to autosave privately.

Before an overwrite or deletion, the previous SKF is retained under
`.backups/`; up to ten versions per project path are kept. The version-archive
selector also exposes moved/deleted project paths. Restore opens a local copy
for inspection, which can then be saved back. Preserve `.backups/` along with
the project files when backing up or migrating the Docker volume.

Electron defaults to `projects` under its preserved **SketchForge** user-data
directory. Set `CADVERIX_DESKTOP_PROJECTS_DIR` before launching to use another
local or mounted-network directory. The app's local web server stays bound to
127.0.0.1; enabling its file store does not expose a new LAN server.

The current Cloudflare configuration remains asset-only. Shared cloud storage
would require an additional API and durable storage, such as a Worker and R2.
No cloud account, credentials, PHP runtime, or external storage service is
required by these modeling improvements.

## Verification

```bash
npm run typecheck
npm test
npm run test:mobile -- modelingImprovements.spec.ts
npm run build
npm run export
npm run verify:static-worker-assets
```
