# Parametric sketch behavior

Current behavior for source release **1.21.0**. See the [user manual](CADVERIX_USER_MANUAL.md) for controls and the [architecture plan](PARAMETRIC_CAD_PLAN.md) for deferred milestones.

## Research references

- [Autodesk: sketch constraints](https://www.autodesk.com/learn/ondemand/tutorial/sketch-constraints): geometry relationships and driving dimensions preserve design intent; construction geometry does not divide extrusion profiles.
- [Autodesk: Extrude](https://help.autodesk.com/view/fusion360/ENU/?guid=SLD-EXTRUDE-SOLID): choose coplanar profiles, set extent/direction, preview, then commit.
- [SOLIDWORKS: Extrude PropertyManager](https://help.solidworks.com/2024/english/solidworks/sldworks/r_extrude_propertymanager.htm): the default extrusion direction is normal to the sketch; reverse and mid-plane are explicit choices.
- [SOLIDWORKS: Instant3D](https://help.solidworks.com/2026/English/SolidWorks/sldworks/HelpViewerDS.aspx?lang=English&path=sldworks%2Ft_creating_and_modifying_instant3d.htm&prod=SolidWorks&version=2026): dimension manipulators change feature parameters after leaving Edit Sketch.

Research used indexed official documentation excerpts. Direct Autodesk page retrieval was blocked (403); the linked help viewers also require JavaScript. No video playback or hands-on Fusion/SOLIDWORKS testing was performed.

## Implemented contract

1. A sketch defines a cross-section in its own coordinate frame.
2. Drawing an axis-aligned line infers a persistent horizontal/vertical constraint. Dimension conflicts do not replace the current sketch.
3. An edge click selects the edge, not every edge in its closed profile.
4. Extrusion has an editable distance, one-sided/reverse/symmetric direction, and live preview. Symmetric distance is total thickness.
5. Changing distance preserves the cross-section, orientation, exact CAD resource, and logical start plane. Dragging either end preserves the opposite end.
6. Reopening a sketch preserves distance/direction. Finishing rebuilds the same body using the edited sketch coordinates, not a newly centered copy.
7. Saved projects retain these parameters and the plane attachment. Generic mesh footprint scaling is not presented as a sketch parameter edit.
8. Preview geometry updates do not reset the user's orbit.
9. **Save sketch only** retains an independent named sketch, including open contours. **Extrude saved sketch** creates a source-linked feature; saving a source edit atomically rebuilds its directly linked exact extrusions or retains the last committed source and solids on failure.
10. Reference planes remain in the project when their helpers are hidden. Unselected helpers are hidden by default; **Show all reference planes** is a session display control. Plane definitions, dependencies, and supported attachments remain editable and persistent.
11. The sketch plate is orthographic. Background body outlines are display-only silhouettes formed by unioning projected triangles with the existing Manifold/Clipper2 engine; outline and fill use the same contours, including genuine silhouette holes and separate components. The orbitable 3D preview is perspective, and source-colored geometry represents existing bodies, not a newly generated feature.
12. Silhouette projection waits for the shared geometry runtime and reports failures instead of substituting a bounding rectangle. Native projection resources are released after use. This is separate from **Project**, which creates sketch entities from native profiles or mesh/plane intersections.
13. Independent sketches, source-linked extrusions, or three-point planes in retained history use SKF format/minimum reader 5. Ordinary projects keep their feature-appropriate older format; application `createdWithVersion` is **1.21.0**.

## Persistence and recovery

Valid normalized placement-plane axes retain their numeric values across storage round trips. This prevents floating-point normalization from repeatedly triggering dashboard saves and renders. Empty reference meshes and reference-plane nodes do not produce invalid SVG coordinates, and large-mesh reference bounds do not spread vertex arrays into function arguments.

A missing saved record for a nonempty project returns to the dashboard with an explanation, without mounting an empty autosaving editor. Blocked database upgrades report other open tabs, and save failures remain visible inside the editor until that project's latest queued save succeeds. These guards do not reconstruct missing or previously corrupted geometry.

Autosave and recovery snapshots are browser-origin/profile-local and best-effort, not independent backups. Export and verify an SKF before restarting an unresponsive browser when possible. Restoring tabs does not restore unsaved geometry. See [storage and recovery](MODELING_AND_STORAGE.md#local-recovery).

## Rotation bug

The previous normal-handle resize converted imported sketch geometry to world-space coordinates, reset its rotation, and discarded its exact B-Rep. The plane-attachment refresh then reapplied the construction plane's rotation to the already-transformed vertices. This caused double transformation on vertical sketch planes.

Sketch extrusions now retain their local geometry and orientation. Distance edits update the axial dimension and center along the body's local normal, and update the plane-local center explicitly. The manipulator uses that same local frame, independently of the currently active placement workplane.

## Known limits

- This is not a general parametric feature dependency graph. Editing a base sketch with downstream edge/sculpt/group/taper work is blocked to avoid silently deleting those changes.
- Existing circles and arcs are represented by Bezier sketch segments, not native driving radius/diameter entities. Tangent, equal, parallel, perpendicular, and angular constraints remain unavailable.
- A failed exact-kernel build can still use the existing mesh fallback; the creation notice identifies fallback output. Manufacturing tolerances and arbitrary imported geometry have not been certified.
- Previously baked/corrupted meshes are not automatically reconstructed. Recreate the feature from its source sketch if its saved frame is already wrong.
