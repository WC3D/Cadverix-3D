# Combined PCB and mechanical projects

Cadverix projects can contain mechanical geometry and multiple independent PCB
designs. Open the **PCB** tab beside Drawing. Finish an active mechanical sketch
before switching workspaces.

The PCB editor is adapted from
[SketchForge-PCB](https://github.com/Formsmith746/SketchForge-PCB), pinned to
`bbbb55276faa11eb23784f4b8d7c701d03a59039`. Its source license and provenance are
retained in `apps/web/src/pcb/vendor/`. KiCad model attribution remains at
`apps/web/public/assets/kicad3d/ATTRIBUTION.md` (CC BY-SA 4.0).

## Boards and instances

- **Add board** creates an independent circuit and a default 60 × 40 × 1.6 mm
  rectangular board, plus its first linked instance in Geometry.
- **Active PCB board** switches the circuit/layout being edited. Each design
  has its own parts, wire connections, junctions, outline, and trace width.
  Different boards may both contain R1 or J1 without sharing electrical nets.
- **Manage boards / exports** contains rename, duplicate, instance, and export
  controls.
- **Duplicate independent board** copies the design into a separate editable
  circuit. Subsequent edits do not affect the original.
- **Add linked instance** reuses the selected design at another assembly
  position. Editing that design refreshes every linked instance.
- **Delete board and instances** removes the design and its linked instances
  as one undoable project action. Other boards and mechanical geometry remain.

Current limits are 32 board designs, 128 linked root instances, 2,000 components
per board, and one million triangles per generated reference assembly. The
existing project/archive/history limits also apply.

## Circuit and board editing

The embedded editor provides **Circuit** and **Board** views, a component and
footprint library, component values and reference designators, routed wires,
junctions, outline/cutout tools, placement tools, design checks, and a 3D board
preview. The initial editing scope follows upstream's top-side placement and
routing tools; it is not a full multilayer EDA suite. A bounded DC test mode is
available for basic switch/LED circuits, as described below.

### Themes

Open **PCB → Settings → Appearance → Theme preset** to use the same project
theme as Geometry and Drawing. The circuit background/grid, toolbars, inspectors,
settings, import/export panels, test panel and 3D preview follow the selected
preset. Saved custom themes are supported; edit custom colours in Geometry's
workspace settings. Component artwork, pad and copper colours retain their
physical meaning rather than being recoloured by the theme.

### Interactive DC tests

In **Circuit** view, click **Test circuit**. Click a pushbutton on the canvas or
its button in the test panel to close/open its two electrical contacts. A powered
LED glows and shows ON; the panel reports estimated LED and supply current.
Keyboard users can focus a pushbutton and press Space or Enter. Click **Stop
circuit test**, press Escape, or switch to Board view to finish. Contacts start
open each time; test state is not saved, exported, added to undo history, or used
to regenerate mechanical geometry. Test clicks latch contacts until clicked
again; physical momentary timing/contact bounce are not simulated.

Supported components are **one battery/DC source**, fixed resistors, ordinary
two-pin LEDs, pushbuttons, and passive pin headers. Set the battery value to a
voltage such as `5 V`. Resistance accepts values such as `330 Ω`, `1 kΩ`, and
`4k7`. LED pin **2 is anode (+)** and pin **1 is cathode (−)**. The pushbutton's
1A/1B pads are the same contact, as are 2A/2B; closing joins contacts 1 and 2.
Hidden components remain electrically present.

A [ready-to-import example](../tests/fixtures/pcb-led-switch.sfpcb) connects:

```text
BT1 + (5 V) → R1 (330 Ω) → SW1 → D1 anode (2)
BT1 −       ←                 D1 cathode (1)
```

Use **Import PCB** for the `.sfpcb` example. With the contacts closed, its red LED
draws approximately 9.41 mA. An open return path or reversed LED does not light it.
The test uses the same pad aliases, wire contacts, and explicit junctions as the
electrical-net exporter. Crossing wires do not join without a junction/contact.

This is **not SPICE**, a fabrication check, or a guarantee a real circuit is safe.
It solves a small steady-state resistor network with ideal switches/source,
nominal LED forward drops (red 1.8 V, orange/yellow 2 V, green 2.1 V, blue/white
3.1 V), 10 Ω LED dynamic resistance, and negligible numerical leakage to ground
for floating nodes. Below 0.1 mA an LED reads OFF. Source voltage must be above 0
and at most 60 V; resistance must be 0.01 Ω–1 GΩ. Current above a generic 20 mA LED
limit, high supply current, reverse bias, and resistor dissipation above 0.25 W
produce warnings—verify actual device ratings and use an appropriate resistor.
Direct supply shorts, invalid values, non-convergence, missing/multiple sources,
and unsupported devices produce an explicit error, not a guessed LED result.

Tests are bounded to 32 components, 128 wires, 128 junctions and 1,024 route points.
Capacitors, inductors, transistors, ICs, RGB/addressable LEDs, motors and other
dynamic devices are not modelled. Designs containing them remain editable and
exportable, but this test mode refuses to simulate them. A real analog/transient
or microcontroller simulator would be a separate integration.

PCB preferences such as grid visibility remain separate from mechanical
workspace preferences. Undo retention uses the combined project's history
setting, available in the main Workspace settings. The embedded clipboard is
for PCB entities, and keyboard shortcuts are isolated from the CAD editor.

## Mechanical assembly

Linked instances appear as named groups in the Geometry Scene list. Move,
rotate, align, duplicate, hide, or lock them using the normal controls. The
instance's PCB document origin is preserved when a board outline or component
changes its bounding box. Coordinates are converted from the PCB editor's
20-pixels-per-mm representation into millimeters; the modeling UI remains
Z-up.

Select a linked instance to expose **Edit PCB** and **Make independent CAD
copy**. Generated geometry is protected against direct resizing, sculpting,
edge treatments, and destructive grouping. An independent CAD copy can be
modified with normal CAD tools and no longer follows the board design.

Linked instances may be copied/pasted within their project. Use SFPCB export
and PCB import to transfer editable board designs between projects; copying an
independent CAD object transfers geometry only.

PCB geometry refreshes asynchronously. Incomplete or failed references are
not rendered as final boards, and assembly/drawing exports are blocked until
the references are current. **Retry PCB geometry** retries a failed build.
Revision and project-session checks discard stale model-load responses,
including responses arriving after Undo or a project change. Generated-mesh
updates do not add extra user undo steps.

The geometry generator uses bundled KiCad models and the upstream procedural
models where supported. Components without an available 3D body are reported;
their circuit, footprint pads and holes remain. The instance list retains a
missing-body count after reload. Such references are incomplete representations
of component clearances. Generated reference geometry is mesh-based, not an
exact STEP/B-Rep electronics assembly.

PCB changes update the board reference; they do not automatically redesign
enclosure walls, move mounting posts, or create associative connector cutouts.
Use the resulting geometry as a reference for those mechanical operations.

## Save, undo, backups, and shared storage

**Ctrl/Cmd+S** inside the PCB editor downloads an SKF backup of the complete
project: mechanical shapes, PCB designs, linked instances, notes, drawing
sheets, assets, and retained history. PCB edits participate in project history;
Undo restores their source data and matching geometry, regenerating a cached
reference when necessary.

PCB edits autosave with the project. The PCB toolbar no longer has a separate
**Project → Save** button; the keyboard shortcut remains available. For a
touch-friendly SKF download, return to **Geometry → Export → SKF**.

Projects containing PCB data in the active state or retained history use
**SKF format 4 / minimum reader 4**. Older readers reject these packages rather
than silently dropping the circuits. Modeling-only projects remain format 2,
and drawing-only extensions remain format 3. Existing formats still open.

Autosave, recovery snapshots, SKF downloads, shared-folder saves, and versioned
backups use the same combined package. No additional storage service or account
is required. Native saves can retain unfinished PCB work; cached references are
marked for rebuilding rather than treated as authoritative circuit data.

## Import and export

**Import PCB** adds an SFPCB or supported KiCad board as a new design in the
current project. The embedded editor's Import command replaces the active
board's scene. Input is bounded and checked for invalid coordinates, duplicate
IDs, unsupported components/footprints, and missing wire/pin references.

Under **Manage boards / exports**:

- **Export selected board:** SFPCB, KiCad PCB, Gerber ZIP, SVG, or BOM CSV.
- **Export all boards:** a ZIP with a separate numbered directory and export
  for each independent design. Linked instances do not become duplicate PCB
  design packages; this is not automatic panelization.
- **3D board preview → Download OBJ:** upstream board-mesh export workflow.

SFPCB is an individual-board exchange file, not the combined project. Older
SketchForge-PCB readers may ignore the added saved trace-width field; use SKF
for full Cadverix fidelity. KiCad import/export retains the supported upstream
subset rather than every KiCad construct. Open construction lines are omitted
from fabrication exports, which require valid closed board outlines. Saved
trace width is used consistently for reference geometry, SVG, KiCad tracks,
and Gerber copper.

In Geometry's Export panel, mesh exports offer **Mechanical only**, **PCB
references only**, **Complete visible assembly**, or the existing selection
scope. PCB references use STL/OBJ/3MF/SVG; choose mechanical-only geometry for
STEP. Native SKF always saves the combined project. Layerling export rejects
PCB-bearing states rather than dropping their data.

## Deployment and maintenance

The editor and geometry generation run in the browser. Component models and
artwork are bundled locally for Node, Docker, desktop, static hosting, and the
offline PWA. No PCB computation server is required. The standalone PCB MCP
bridge is disabled in the managed workspace; PCB-specific Cadverix MCP tools
are not included in this integration.

The vendor stylesheet is scoped to `.pcb-workspace`; the circuit workspace
follows the selected project theme. Board-management and component panels fit
within the available workspace on phones. Runtime model assets retain their
upstream paths so the existing offline-cache generator can include them.

`scripts/import-pcb-upstream.mjs` records the bootstrap process and refuses to
overwrite the adapted port. Future upstream updates require reviewing the
local adaptations. Bump `PCB_GEOMETRY_REVISION` when changing reference-geometry
generation or bundled models so cached instances are refreshed.

## Checks

```bash
npm run typecheck
npm test -- tests/unit/pcbProject.test.ts
npm run test:mobile -- pcbWorkspace.spec.ts
npm run export
npm run test:offline
```
