// The kernel is ESM-only; keep it outside Playwright's CommonJS test transform.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { strFromU8, unzipSync } from "fflate";
import { OcctKernel } from "occt-wasm";

const [archive, bodyId, volumeText] = process.argv.slice(2);
const expectedVolume = Number(volumeText);
assert(archive && bodyId && Number.isFinite(expectedVolume) && expectedVolume > 0);
const files = unzipSync(await readFile(archive));
const document = JSON.parse(strFromU8(files["project.json"]));
const body = document.exactCad.find((entry) => entry.objectId === bodyId);
assert(body?.brepAssetId, "The generated body must retain exact B-rep geometry");
const asset = document.assets.find((entry) => entry.id === body.brepAssetId);
assert(asset && files[asset.path], "Exact geometry asset must be present");
const wasm = join(dirname(fileURLToPath(import.meta.resolve("occt-wasm"))), "occt-wasm.wasm");
const kernel = await OcctKernel.init({ wasm });
try {
  const solid = kernel.fromBREP(strFromU8(files[asset.path]));
  assert(kernel.isSolid(solid), "Regenerated geometry must be a solid");
  assert(kernel.isValid(solid), "Regenerated topology must be valid");
  assert(Math.abs(kernel.getVolume(solid) - expectedVolume) <= expectedVolume * 1e-8, "Regenerated solid volume must match the driving dimensions");
} finally {
  kernel.releaseAll();
}
