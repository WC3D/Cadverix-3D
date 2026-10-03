# Mobile Alpha

Cadverix 3D's mobile alpha adds browser touch controls and compact-screen layouts to the editor. It uses the existing locally hosted application and file import/export workflow; no mobile app or cloud account is required.

## Try it on your local network

Use Node.js 24 or newer and one development server per checkout. Stop an existing development server before switching its port, then run from the project folder:

```sh
npm ci
npm run dev -- --hostname 0.0.0.0 --port 3001
```

On a phone or tablet on the same network, visit `http://<computer-LAN-IP>:3001`. The computer must allow connections to that port. The Next.js development configuration already allows the computer's local IPv4 addresses. For a custom hostname, set `CADVERIX_ALLOWED_DEV_ORIGINS` to that hostname when starting the server.

Projects live in browser storage for that address and browser. To move a project between desktop and mobile, export/import its `.skf` file. Port 3001 also gives testing its own browser storage, separate from port 3000. Current saves include binary display-edge assets, which require an updated SKF reader.

For the local printing workflow: design in Cadverix 3D, export STL or 3MF to the device's downloads/files, then import that file into your locally hosted slicer's web interface. This alpha does not add a direct slicer API integration.

## Controls

| Input | Behavior |
| --- | --- |
| Tap an object in Edit | Select it; tap empty space to clear selection |
| Drag an already-selected object | Move it; the completed drag is one undo step |
| Drag empty space or an unselected object | Orbit the 3D camera |
| Two-finger drag | Pan |
| Pinch | Zoom, including in the 2D sketch view |
| View button (Navigate) | Navigate with one finger anywhere without editing; sketch view pans |
| Multi button | Toggle individual objects in/out of the selection by tapping; hidden during Fillet/Chamfer |
| Tap highlighted edges in Fillet/Chamfer | Select edges using the tool's **Select tangent chains** setting |
| Edit in Sculpt | Drag to brush or tap for one dab |
| Draw in Sketch | Use the active drawing/selection tool with one finger |
| Top toolbar undo/redo | Undo/redo the current geometry or sketch history |
| ? button | Show gesture help |

The first finger is held pending until it moves beyond an 8-pixel threshold or is released. A second finger takes over navigation, so an ordinary pinch does not start a brush stroke or place a sketch point. An unfinished drag preview is cancelled on takeover; brush changes already applied remain undoable, and pending worker results are cancelled. Navigation keeps ownership until all fingers lift. Finish a resize/rotate handle adjustment before starting a camera gesture.

Pen contacts are explicitly captured for the active tool and suppress native browser gestures on the drawing surface. Touch contacts are ignored while a pen is down. A cancelled/interrupted pen contact cancels unfinished drag or curve previews and pending brush work. Shape-menu taps support both pen and touch pointer events. Mouse buttons and keyboard shortcuts retain their existing behavior.

Object Multi mode no longer injects Shift into edge-tool taps. Your Multi preference is restored when you leave the edge tool. An actual keyboard **Shift** still selects a single edge. For a faceted STL rim, enable **Select tangent chains** and select the complete rim; see [CAD edge tools](CAD_EDGE_TOOLS.md) for the dedicated planar-rim Fillet and Chamfer paths.

Wheel/trackpad zoom over object handles uses a non-passive event listener. Workspace settings now synchronize without an effect feedback loop; saved defaults apply when entering a workspace, and subsequent snap/theme edits take effect immediately.

## Layout

- Tool ribbons scroll horizontally rather than squeezing their icons.
- Tool families have colored outlines while retaining their labels. Shapes and Generators use separate viewport-clamped grids: three columns on larger screens, two on phones, and one below 360 CSS pixels. Each palette scrolls beneath a sticky title/close control. Generator entries are not duplicated in Shapes.
- Tablet title rows reserve the full touch-button height, including at widths above the phone breakpoint. Dropdowns are fixed to the visible viewport below their toolbar section so scrolling the ribbon cannot clip them.
- Coarse-pointer devices use compact 36-pixel toolbar buttons and 22-pixel object handles (half the original mobile alpha's 44-pixel handles). Sketch point targets remain enlarged for touch.
- The mobile title row and tool ribbon together use 100 CSS pixels, plus the device's top safe area. Sizing follows the browser viewport in CSS pixels rather than the screen's physical pixel resolution or DPI.
- The scene inspector starts collapsed on compact screens.
- Phone shape properties use a narrower, scrollable lower panel, capped at 26% of the viewport height or 220 CSS pixels, with a compact header and visible collapse control. Wide landscape phones also get a narrower inspector.
- Touch controls remain available in geometry, sketch, and sculpt views. Undo/redo are in the top toolbar rather than duplicated in the floating touch panel.
- Dynamic viewport height, safe-area spacing, and readable input sizes accommodate mobile browsers without disabling page zoom outside the drawing surfaces.

## Validation

Automated unit coverage: touch-intent arbitration, multi-touch takeover, finger-lift ordering, cancellation, extra fingers, degenerate pinches, perspective/orthographic camera mathematics, and dropdown placement.

Repeatable browser regression tests:

```sh
npx playwright install chromium webkit
npm run test:mobile
```

The suite reuses a server on port 3000 or starts a development server when none is running. To test an existing server on another address, use `CADVERIX_TEST_URL=http://localhost:3001 npm run test:mobile`. Each test uses fresh browser storage. Tests live in `tests/browser/` and run separately from the Vitest suite.

The menu tests run in Chromium and WebKit at 390×844, 820×1180, 1024×768, and 1366×1024. They check actual hit-test visibility before tapping, because browser automation's automatic scrolling can otherwise hide a clipped-dropdown bug. Native pen-event tests exercise menu selection, geometry drag/undo, interrupted drags, sculpt dab/undo, sketch points, Bezier cancellation, palm rejection, and returning to touch. Pen injection uses Chromium's debugging protocol; that test is explicitly skipped in WebKit, so it does not substitute for testing a physical Apple Pencil.

Additional browser regressions cover three-point arcs and closed profiles, translucent region selection, CAD worker replacement after an injected fault, Multi/tangent-chain interaction, wheel zoom, and snap/theme persistence across reload. The wheel test uses desktop browser mode with touch enabled because Playwright cannot inject wheel events in mobile WebKit mode. The optional imported-rim test requires the external door-repair SKF fixture and is skipped unless `CADVERIX_CAD_REPRO_PROJECT` is set; see [CAD validation](CAD_EDGE_TOOLS.md#developer-validation).

Chromium touch emulation was exercised at phone portrait (390×844) size. Checks included selection, object dragging/undo, orbiting, pinching without geometry changes, multi-selection, sculpt dab/undo, sketch tap/pinch/undo, and STL download/import. Additional page-overflow checks covered phone landscape (844×390) and tablet (1024×768) sizes.

Physical-device testing is still needed, especially iOS Safari, Android Chrome, stylus input, the on-screen numeric keyboard, and large meshes. On a device, also verify:

1. Open and re-save a copied `.skf` project, then reload it.
2. Resize and rotate a shape; enter an exact dimension with the keyboard.
3. Add a second finger during drawing or dragging, and release fingers in either order.
4. Rotate the device, background/restore the browser, and resume editing.
5. Export STL/3MF and open the result in the local slicer.
6. Repeat the workflow on a desktop with a mouse to check hybrid-input behavior.
