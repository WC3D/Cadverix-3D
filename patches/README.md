# Dependency compatibility patches

`npm install` / `npm ci` applies the compatibility change through the
dependency-free `node patches/apply.mjs` installer. The `.patch` file records the
equivalent diff for review. The installer checks the package version and both
targets before writing, accepts an already-patched installation, and fails if
the expected source no longer matches. Docker copies this directory before
installing dependencies.

This replaces `patch-package`, whose workspace-discovery dependency introduced
the unpatched `braces` advisory GHSA-vfj7-8cjw-p6xm.

## Electron download dependency

`package.json` overrides `app-builder-lib`'s `@electron/get` dependency to 5.1.0.
This uses the newer downloader without the `got` → `cacheable-request` →
`http-cache-semantics` chain affected by GHSA-ch52-4w7c-c8xp. Version 5 requires
Node >=22.12.0; this project uses Node 24, which also supports its ESM exports
from electron-builder's CommonJS code. Review the override when updating
electron-builder; remove it when the upstream dependency uses version 5 or later.

## three-bvh-csg 0.0.18

The current CSG release passes the deprecated `maxLeafSize` option to
`three-mesh-bvh`. Change it to `targetLeafSize` in both the browser ESM source and
the CommonJS build, retaining the value of 3 and the other BVH options. This
avoids repeated deprecation warnings without hiding console output or changing
the geometry algorithm. Remove the patch once an upstream release uses the new
option. Installation fails if the patch no longer applies.
