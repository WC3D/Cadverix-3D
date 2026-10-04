# Installable offline web app

The **static export**, including the Cloudflare assets deployment, can be
installed as a Progressive Web App (PWA). It uses the browser's own app window
and storage; it does not require Electron or a server running on the device.

## Install and prepare for offline use

1. Open the deployed static site over **HTTPS** while online. Localhost is also
   supported for testing.
2. The dashboard shows **Cadverix 3D as an app** and offline-download progress.
3. Wait for **Ready for offline use**. Installation of an icon alone is not
   proof that the CAD runtime has finished downloading.
4. Click **Install now** when the browser offers its installation prompt.
   Otherwise use the browser's installation menu. On iPhone/iPad, use Safari's
   **Share → Add to Home Screen**; on supported macOS Safari versions use
   **File → Add to Dock**.
5. Open the installed app once while online and confirm readiness there before
   testing offline. Some browsers give installed apps separate storage from
   ordinary browser tabs.

The app can also reopen offline in a normal browser tab. Browser installation
support varies; the offline status does not depend on receiving an install
prompt. Dismissing the suggestion leaves an **Offline ready · App options**
button so the status and instructions remain accessible.

## What works offline

After caching completes, the local editor, modeling tools, CAD shelling,
sketches, drawing sheets, local project storage and file exports are available
without a network connection. The offline copy includes lazy JavaScript
chunks, CAD workers, WebAssembly kernels, styles, fonts and app assets—not
only the dashboard page.

External services, shared server folders, remote update checks and assets not
part of the exported application still need a connection. The service worker
does not cache `/api/` responses, PHP endpoints, external origins, or writes.

Projects and recovery snapshots stay in the existing browser IndexedDB/local
storage. They are not placed in the application-file cache. Clearing site data
can remove both; downloaded SKF files remain the independent backup option.
Offline cache storage can also be evicted by the browser. The readiness check
verifies that all expected files are present and offers retry if setup fails
or files are missing.

## Updates

Every changed static build gets a content-derived service-worker version.
Files are downloaded with SHA-256 integrity checks before that version is
considered complete. A failed download cannot activate a partial offline copy.

The active worker serves a consistent cached app shell and assets, even while
online. A new version installs in the background and waits. The dashboard then
says **Update ready**. Finish your work, close **all Cadverix tabs and installed
app windows for that site**, and reopen to activate it. Reloading a tab alone
does not force the update while the old worker still has clients.

There is no forced reload or `skipWaiting` takeover of an open editing session.
Activation retains the current complete cache and one previous complete cache;
older app caches are removed without touching project databases or caches
belonging to other applications.

When an existing PWA origin is switched to a normal Node/Docker build, its
`sw.js` retires the old offline cache after the old tabs close. It unregisters
the worker without deleting projects, so the old cached app cannot permanently
hide the newly deployed server application.

## Deployment scope

| Installation | Offline PWA behavior |
| --- | --- |
| Static export served over HTTPS, including Cloudflare | Install banner, offline caching, and safe update lifecycle |
| Static export on localhost | Same behavior; useful for testing |
| Static export served on plain LAN HTTP | No offline-install promise; service workers require a secure context |
| Normal Node development/production or Docker server build | Existing web app behavior; offline registration is disabled |
| Electron desktop | Existing native desktop behavior; no PWA registration |

Serve the static export at the site's root. The manifest, startup URL and
service-worker scope use `/`, matching the current Cloudflare configuration.
The included `_headers` file makes Cloudflare revalidate the manifest and avoid
caching `sw.js`. Other static hosts should serve `sw.js` with a JavaScript MIME
type and `Cache-Control: no-store` or an equivalent revalidation policy. Do not
replace failed asset requests with HTML: integrity checks will reject those
responses rather than advertise an incomplete offline app.

## Build and test

```bash
npm run brand:icons       # Only needed after changing the brand artwork
npm run export           # Builds the static site and generates sw.js
npm run test:offline     # Serves the export and runs Chromium/WebKit checks
```

The generator reports the asset count and uncompressed cache size. Downloads
are bounded to four concurrent requests. The test runner verifies real offline
reloads, CAD worker operations, drawing persistence, SKF export, failed-cache
recovery, installation-button wiring and updates that wait for clients to
close. Browser/OS installation dialogs themselves require a manual check on
the intended device.

Chromium tests use the browser's offline switch. In this environment WebKit's
driver-level offline switch reports an internal navigation error, so the WebKit
test instead disconnects the app server entirely and verifies the same cached
reload and modeling workflows without a server fallback.
