import { readFile, writeFile } from "node:fs/promises";

// This deliberately handles only our version-pinned, two-line compatibility
// patch. Validate all targets before writing, and accept an already-patched
// installation so repeated npm installs are safe.
const root = new URL("../node_modules/three-bvh-csg/", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
if (manifest.version !== "0.0.18") {
  throw new Error(`Review the three-bvh-csg compatibility patch for version ${manifest.version}`);
}
const before = "{ maxLeafSize: 3, indirect: true, useSharedArrayBuffer }";
const after = "{ targetLeafSize: 3, indirect: true, useSharedArrayBuffer }";
const edits = [];
for (const path of ["src/core/Brush.js", "build/index.umd.cjs"]) {
  const url = new URL(path, root);
  const source = await readFile(url, "utf8");
  const oldCount = source.split(before).length - 1;
  const newCount = source.split(after).length - 1;
  if (oldCount === 0 && newCount === 1) continue;
  if (oldCount !== 1 || newCount !== 0) {
    throw new Error(`Cannot safely apply three-bvh-csg compatibility patch to ${path}`);
  }
  edits.push({ url, source: source.replace(before, after) });
}
for (const { url, source } of edits) await writeFile(url, source);
console.log("three-bvh-csg 0.0.18 compatibility patch verified");
