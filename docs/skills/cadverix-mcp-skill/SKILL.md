---
name: cadverix-mcp-skill
description: Control a live local Cadverix 3D editor through its MCP server. Use when Codex needs to list currently open Cadverix 3D editor tabs, target a tab by editorNumber/projectName, read the current scene, list or select objects, create boxes/cubes/cylinders/sketch extrusions, update dimensions/position/rotation, align objects, group/ungroup/cut/separate parts, list exact CAD edge ids, apply chamfer/fillet to specific edges, inspect editor errors, or capture viewport images from view-cube angles.
---

# Cadverix 3D MCP

## Quick Start

Use this skill only with a local Cadverix 3D app running in development mode.

1. Start Cadverix 3D from the repo:

```bash
npm run dev
```

2. Open an editor tab at `http://localhost:3000/?editor=1`.

3. Configure your MCP client to start the stdio server:

```bash
node scripts/cadverix-mcp-server.mjs
```

The MCP server talks to the app through `/api/cadverix-mcp`. Open editor tabs heartbeat into that route and receive commands from it. Production and Docker/static builds intentionally return 404 for the MCP route.

## Client Compatibility

Codex can use this folder as a skill and the MCP server as tools. Install the folder under `~/.codex/skills/cadverix-mcp-skill` and configure the MCP server in Codex.

Claude Desktop does not read Codex skills, but it can use the same `scripts/cadverix-mcp-server.mjs` MCP server through Claude's `mcpServers` JSON config. Use the repository README for client setup examples.

## Targeting Editors

Always call `cadverix_list_editors` first when the user mentions multiple projects, tabs, or a number like `49536`.

Use `editorNumber` for follow-up commands. It is a 5-digit per-tab number stored in browser `sessionStorage`, so two open Cadverix 3D tabs have different numbers. The list also includes `projectName`, `projectId`, URL, shape count, selected count, notice, and last error.

If only one editor is open, commands may omit `editorNumber`; the server will target the sole live editor.

## Core Workflow

Read scene/object state before modifying geometry:

```text
cadverix_list_editors
cadverix_read_scene({ editorNumber })
cadverix_list_objects({ editorNumber })
```

For object edits, use exact object `id` values from the scene. Do not invent object names; names are helpful labels only.

Useful tools:

- `cadverix_select_objects`: select ids in the live editor.
- `cadverix_delete_objects`: delete ids in the live editor, or delete the current selection when ids are omitted.
- `cadverix_create_shape`: create `box`, `cube`, `cylinder`, or `sketch`.
- `cadverix_import_mesh`: import STL-style mesh data into the editor.
- `cadverix_update_object`: set exact dimensions, position, color, name, hole state, and `rotation`/`rotationX`/`rotationZ`.
- `cadverix_align_objects`: align two or more ids using the same logic as the editor Alignment button.
- `cadverix_group_objects`: group selected ids using the normal Cadverix 3D group/boolean path.
- `cadverix_boolean_cut`: pass `solidIds` and `holeIds`; the result replaces the operands.
- `cadverix_ungroup_objects`: restore grouped children while preserving edited child geometry.
- `cadverix_separate_parts`: split disconnected parts in one object.
- `cadverix_inspect_errors`: read the editor notice, edge modifier error, and last MCP error.

## Edge Features

Chamfer and fillet are separate edge-treatment operations in Cadverix 3D. Do not fake a chamfer/fillet with cylinders or extra decorative geometry. Cylinders are only appropriate when the requested shape itself has a circular/rounded 2D footprint, such as rounded tray corners or a cylindrical peg.

For chamfer/fillet, never guess edge ids.

1. Call `cadverix_list_edges({ editorNumber, id, sharpAngle })`.
2. Use returned `selectableEdgeIds` or inspect returned edge geometry.
3. Call `cadverix_apply_edge_treatment({ editorNumber, id, kind, edgeIds, amount, chamferAngle })`.

`edgeIds` can be an array of numeric ids or `"all"`. `kind` is `chamfer` or `fillet`. The app commits the result through normal history, so undo/redo works.

## Images

Use `cadverix_capture_image` for viewport PNGs. `face` can be `current`, `home`, `top`, `bottom`, `front`, `back`, `right`, or `left`. These use the same camera/view-cube orientation logic as the editor UI.

## Visual Verification

After creating or heavily modifying an object, use vision when available. Capture at least one useful viewport image with `cadverix_capture_image`; for 3D geometry, prefer `home` plus any needed orthographic-style faces such as `top`, `front`, or `right`. Inspect the rendered result against the user's requirements before saying the task is done.

Do not rely only on numeric scene data when the user asked for a physical object. Use numeric checks for dimensions and visual checks for whether the model reads correctly.

## Safety

This bridge is local-development only. If a command fails, call `cadverix_inspect_errors` before retrying. For geometry operations that can be expensive, set a larger `timeoutMs` on the tool call.
