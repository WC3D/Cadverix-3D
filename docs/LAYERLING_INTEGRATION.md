# Selected Layerling improvements

These additions were reviewed against [henmedia/layerling](https://github.com/henmedia/layerling)
at commit `f309232160bd208f71e1903f22f58db9eacc709d`. Adapted algorithms
retain AGPL-3.0 attribution in their source files; Cadverix remains AGPL-3.0.
This is a selective adaptation, not a merge of Layerling's editor, branding,
storage endpoints, deployment settings, or project format.

## Storage and safety

- Project-list replacement never deletes the old list first. A quota error
  retains the previous list and reports the failure. Inline card pictures
  migrate to IndexedDB before their data URLs are removed from localStorage.
- **Dashboard → Storage & backups → Recover missing designs** rebuilds missing
  cards from retained project packages in IndexedDB. Unreadable records remain
  untouched. This cannot recover data after browser site storage is cleared;
  downloaded SKF backups remain important.
- MCP deletion, ungrouping, and edge treatment reject locked targets before
  changing any selected objects. Existing update/group/boolean protections stay.

## Finding and positioning tools

- **Ctrl/Cmd+K**, or the search button beside the workspace tabs, searches
  Geometry commands and shape generators. Keywords such as `round edges` and
  `shell` work. Disabled commands remain visible with an explanation. Arrow
  keys select results, Enter runs one, Escape closes, and recent commands appear
  first for an empty search. Workspace switching is also searchable.
- Dragged objects snap their edges or centers to visible solids and show guide
  lines. Hold **Alt** to pause object snapping; **Shift** constrains the move to
  one horizontal axis. The snap reach follows the camera scale (eight pixels).
  Snapping uses world-horizontal bounding boxes, not exact curved-surface mates;
  tilted workplanes keep their existing grid behavior.

## Geometry → Modify → Modeling tools

- **Section view:** inspect a cut across X, Y, or Z, change its offset, or flip
  the retained side. This is a visual clipping plane, without generated caps,
  section measurements, or section SVG export. Model geometry and geometry
  exports remain whole. Section settings are session-local.
- **Show overhangs:** orange highlights downward-facing triangles above the
  plate beyond the chosen angle (45° initially). This is inspection guidance,
  not slicer support generation or a guarantee of printability. It is also
  session-local and does not modify saved geometry.
- **Pick face pivot:** a single body's pivot is saved in its normalized local
  frame, follows movement/rotation/resizing/mirroring, and survives SKF/LYL
  round-trips. Baking a transformed body rebases its pivot without moving it.
  A multi-object selection still uses a session-local pivot. **Clear pivot**
  removes the saved pivot from unlocked selected bodies. Old readers can open
  the geometry but do not necessarily honor the pivot when editing it.
- **Face hole pattern:** select one unlocked solid, choose round, square,
  rectangular, hexagonal, or slot holes, then pick a flat face. Grid/staggered
  rows, spacing, edge margin, and through/blind depth are supported. The preview
  is temporary; **Create hole pattern** performs one undoable cut. Ungroup
  restores the source body and ordinary editable mesh cutters. Changing settings
  clears the preview; pick the face again to refresh it. Closing the panel or
  changing the source discards a pending result. Patterns are limited to 256
  holes, at least 0.4 mm separation, 100,000 input triangles, and a bounded
  synchronous face-test budget. Detailed meshes may need simplification.
- **Reusable shapes:** name and save a selection, then insert an independent
  copy into a project. The library stores validated SKF snapshots in IndexedDB,
  including needed source assets, not references to another project's live
  objects. Each insertion receives fresh object IDs and is undoable. Live sketch
  projections become independent geometry, and attached sketch planes use their
  saved poses rather than following planes in the source project. The library
  is local to this browser/site: 16 MB per entry and 128 MB total. Existing
  inserted copies survive deletion of a library entry. Export SKF backups before
  clearing browser data. Shared-library synchronization is not included.

## Viewport work

Overlay materials for move dimensions, arrows, and CAD edge selection are shared
within each viewport and released on teardown. CAD edge-array props stay stable
when their contents have not changed. Imported connected-part counts are cached
by immutable position-array identity, rather than recomputed after every move,
resize, or rotation. No new runtime dependencies were added.

## Verification

Unit coverage includes failed list writes, command ranking, snapping, face-pattern
boundaries/cutters/winding, overhangs, section axes, pivot transforms and package
round-trips, shared materials, and avoiding topology recounts. Browser tests in
`tests/browser/layerlingAdditions.spec.ts` exercise command search, phone sizing,
inspection, saved pivots, library reload/insert/undo, hole preview/cut/undo,
missing-card recovery, thumbnail migration, and snapping guides/Alt bypass.
