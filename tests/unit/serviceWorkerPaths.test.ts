import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { generateServiceWorker } from "../../scripts/generate-service-worker.mjs";

let root = "";
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "cadverix-export-"));
  await fs.mkdir(path.join(root, "occt"));
  for (const file of ["index.html", "manifest.webmanifest", "occt/occt-wasm.wasm"]) await fs.writeFile(path.join(root, file), file);
});
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });

it("generates and replaces a regular service worker", async () => {
  const first = await generateServiceWorker(root);
  const second = await generateServiceWorker(root);
  expect(second.version).toBe(first.version);
  expect(second.entries).toHaveLength(3);
  expect(await fs.readFile(path.join(root, "sw.js"), "utf8")).toContain(first.version);
});

it.each(["asset.js", "sw.js", "linked-directory"])("rejects a linked %s without modifying its target", async (name) => {
  const target = name === "linked-directory" ? path.join(root, "occt") : path.join(root, "index.html");
  await fs.symlink(target, path.join(root, name));
  await expect(generateServiceWorker(root)).rejects.toThrow("regular files");
  expect(await fs.readFile(path.join(root, "index.html"), "utf8")).toBe("index.html");
});
