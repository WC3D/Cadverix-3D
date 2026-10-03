# CAD edge tools

## Fillet and Chamfer on imported mesh rims

Cadverix 3D includes dedicated treatment paths for supported faceted STL rims that can fail in the native edge builder. These paths operate on a **complete, closed, convex outer rim on a horizontal top plane**, with enough material for the requested treatment.

1. Select the imported object and open **Fillet** or **Chamfer** in the Geometry toolbar.
2. Enable **Select tangent chains** and click or tap the rim. A single visual rim may contain many short STL edges.
3. Adjust the radius or distance and inspect the preview.
4. Choose **Apply**. The normal reversible edge-feature history remains available.

**Chamfer** builds a tapered cutting solid. **Fillet** builds rounded surfaces from rational circular profiles that follow the adjacent wall slopes. Fillet retains the faceted outline of the source rim; it rounds the transition between its top and walls rather than replacing the whole imported object with a smooth cylinder. Results are checked for valid CAD geometry and retain B-Rep data for subsequent project storage and STEP workflows.

The dedicated paths are deliberately restricted. Partial edge selections, inner rims, nonconvex or nonhorizontal loops, and other unsupported geometry use the regular CAD edge builder. Large radii/distances may need to be reduced to fit the available material.

### Touch selection

The floating **Multi** control selects objects. It is hidden while Fillet/Chamfer is open and cannot override tangent-chain selection. Its previous state returns when the edge tool closes. With a physical keyboard, **Shift** still selects a single edge.

## Fault recovery and diagnostics

A WebAssembly memory fault is not treated as an ordinary invalid-shape result. Cadverix 3D stops further topology retries, discards the worker, and creates a fresh worker. Restart the edge tool to prepare the object again. A preview whose optional exact serialization fails can still be applied as mesh geometry through the existing preview-only workflow.

Fault messages identify the phase, operation, edge count, and geometry strategy. The browser console entry beginning **`[Cadverix 3D CAD]`** includes:

- The stage, such as building the preview, tessellating it, or collecting edges.
- Fillet/Chamfer, selected edge IDs, and requested amount.
- The `native-edge` or `planar-rim` strategy.
- The underlying kernel message and stack when available.

When reporting a failure, include this entry, the affected `.skf` project, and the selected object/edge. The local development MCP bridge also retains the diagnostic in its last-error report.

After updating a running development checkout, restart the server and fully reload the editor so the active CAD worker uses the new code.

## Developer validation

Use Node.js 24 or newer. Standard checks:

```bash
npm run typecheck
npm test
npm run test:e2e -- tests/e2e/cadPlanarRim.e2e.ts tests/e2e/cadModifierFit.e2e.ts tests/e2e/cadModifierGroups.e2e.ts
npm run test:mobile
```

The geometry tests check circular radius and wall tangency, exclude inappropriate rim selections, verify the material removed by the round-over, preserve the lower body, and round-trip the resulting B-Rep through the real OCCT kernel.

`tests/browser/cadImportedRim.spec.ts` is an opt-in regression for the original door-repair project containing `Bifold_Door_Hole_Repair`. The fixture is not committed, and an arbitrary SKF file is not a substitute. On macOS/Linux, run it with a local copy of that fixture:

```bash
CADVERIX_CAD_REPRO_PROJECT="/path/to/door-repair-project.skf" npm run test:mobile -- cadImportedRim.spec.ts
```

On PowerShell:

```powershell
$env:CADVERIX_CAD_REPRO_PROJECT = "C:\path\to\door-repair-project.skf"
npm run test:mobile -- cadImportedRim.spec.ts
```

This test imports a fresh local project and uses actual touchscreen picking. It verifies both Fillet and Chamfer, with Multi enabled and disabled, including preview, Apply, selected-edge preservation, volume reduction, and B-Rep availability in Chromium and WebKit.
