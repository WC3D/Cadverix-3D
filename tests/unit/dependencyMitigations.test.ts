import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";

it("applies the compatibility fix on a clean install, is idempotent, and rejects unexpected source", async () => {
  const root = await mkdtemp(join(tmpdir(), "cadverix-patch-"));
  try {
    const packageRoot = join(root, "node_modules/three-bvh-csg");
    await mkdir(join(root, "patches"), { recursive: true });
    await mkdir(join(packageRoot, "src/core"), { recursive: true });
    await mkdir(join(packageRoot, "build"), { recursive: true });
    await copyFile("patches/apply.mjs", join(root, "patches/apply.mjs"));
    await writeFile(join(packageRoot, "package.json"), JSON.stringify({ version: "0.0.18" }));
    const paths = ["src/core/Brush.js", "build/index.umd.cjs"].map((path) => join(packageRoot, path));
    for (const path of paths) await writeFile(path, "new MeshBVH(geometry, { maxLeafSize: 3, indirect: true, useSharedArrayBuffer });");
    const run = () => execFileSync(process.execPath, [join(root, "patches/apply.mjs")], { stdio: "pipe" });
    run();
    run();
    for (const path of paths) expect(await readFile(path, "utf8")).toContain("targetLeafSize: 3");
    await writeFile(paths[0], "unexpected upstream source");
    expect(run).toThrow();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it("electron-builder downloads and verifies artifacts through @electron/get 5 on Node 24", async () => {
  const require = createRequire(import.meta.url);
  const { downloadElectronArtifactZip } = require("app-builder-lib/out/util/electronGet.js");
  const root = await mkdtemp(join(tmpdir(), "cadverix-electron-get-"));
  const artifact = Buffer.from("local Electron downloader compatibility fixture");
  const filename = "electron-v43.4.0-linux-x64.zip";
  const checksum = `${createHash("sha256").update(artifact).digest("hex")} *${filename}\n`;
  const requests: string[] = [];
  const server = createServer((request, response) => {
    requests.push(request.url!);
    const body = request.url!.endsWith("SHASUMS256.txt") ? Buffer.from(checksum) : artifact;
    response.writeHead(200, { "Content-Length": body.length });
    response.end(body);
  });
  try {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as { port: number };
    const file = await downloadElectronArtifactZip({
      version: "43.4.0", platformName: "linux", arch: "x64", artifactName: "electron", cacheDir: root,
      electronDownload: { mirrorOptions: { resolveAssetURL: (details: { artifactName: string }) => `http://127.0.0.1:${address.port}/${details.artifactName === "SHASUMS256.txt" ? "SHASUMS256.txt" : filename}` } },
    });
    expect(await readFile(file)).toEqual(artifact);
    expect(requests).toContain(`/${filename}`);
    expect(requests).toContain("/SHASUMS256.txt");
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(root, { recursive: true, force: true });
  }
});
