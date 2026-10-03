# Cadverix 3D rename and compatibility

The product name is **Cadverix 3D**, and the package/local image slug is `cadverix-3d`. Browser titles, dashboard branding, desktop menus, installer names, export labels, current documentation, and MCP tool names use the new brand.

The logo combines a **C3D** monogram, a shaded isometric cube, a pencil drawing a curved profile, dimension ticks, and a subtle drafting grid. Its lettering uses vector paths rather than system fonts. The SVG master lives under `apps/web/public/assets/cadverix`; `npm run brand:icons` generates the 1024px desktop PNG, 180px Apple touch icon, and 32px PNG favicon from that source.

## Existing projects and installations

The rename does not require converting projects. The application retains the existing `.skf` extension, schema/media identifiers, browser storage keys, IndexedDB database, clipboard formats, saved theme IDs, desktop application ID, desktop profile directory, and local server port. These identifiers are compatibility contracts, so they intentionally still contain the former name. Legacy type/module imports and internal event/IPC names remain supported as well.

Quit the old desktop app before launching the renamed build. Both use the same installation identity and existing project profile.

Browser data remains scoped to the same site address and browser. If you host the renamed app at a different domain or port, transfer projects with `.skf` export/import.

Docker Compose retains the `sketchforge` service key and `sketchforge-shared-projects` volume key so existing shared files remain attached during upgrades. Local images use `cadverix-3d:local`. The prebuilt image and release URLs follow the actual `WC3D/SketchForge-3D` repository rather than assuming a renamed GitHub repository or a new website exists.

The existing Cloudflare worker name in `wrangler.jsonc` also remains a deployment identifier, so deploying the rebrand updates the current site instead of silently creating a different origin.

## Configuration

New configuration uses `CADVERIX_` prefixes. The corresponding `SKETCHFORGE_` variables remain accepted for existing deployments:

- Shared-project directory, local-download root, server port and shared-project volume.
- Update manifest/guide URLs, app version, administrator key and update trigger settings.
- Desktop development URL/port, Docker build mode, allowed development origins and legacy Docker port.
- MCP server URL, browser-test URL and the optional CAD regression fixture.

For application environment variables, an explicitly set new name takes precedence, including an empty value used to disable a feature.

## MCP clients

Use `npm run mcp:cadverix`, `scripts/cadverix-mcp-server.mjs`, `/api/cadverix-mcp`, and the advertised `cadverix_*` tools. Existing server entry points, the old route, and `sketchforge_*` tool calls remain aliases. The new Codex skill is in `docs/skills/cadverix-mcp-skill`.

## Attribution and historical material

Cadverix 3D is derived from SketchForge. Original copyright notices and the AGPL-3.0-only license are preserved. Historical screenshots/manuals, format fixtures, stable integration identifiers, and actual repository addresses may still mention SketchForge; these are provenance or compatibility references, not current product labels.
