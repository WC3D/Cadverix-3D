# Dependency compatibility patches

`npm install` / `npm ci` applies these patches through `patch-package`.

## three-bvh-csg 0.0.18

The current CSG release passes the deprecated `maxLeafSize` option to
`three-mesh-bvh`. Change it to `targetLeafSize` in both the browser ESM source and
the CommonJS build, retaining the value of 3 and the other BVH options. This
avoids repeated deprecation warnings without hiding console output or changing
the geometry algorithm. Remove the patch once an upstream release uses the new
option. Installation fails if the patch no longer applies.
