import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/app-update/route";
import { SKF_CREATED_WITH_VERSION } from "@/lib/skfProject";

vi.mock("node:child_process", async () => {
  const { promisify } = await import("node:util");
  const execFile = vi.fn();
  Object.defineProperty(execFile, promisify.custom, { value: vi.fn(async (_command, args, options) => {
    if (args[0] === "merge") await fs.writeFile(path.join(options.cwd, "package.json"), JSON.stringify({ version: "9999.0.0" }));
    return { stdout: "", stderr: "" };
  }) });
  return { execFile, spawn: vi.fn(() => ({ unref: vi.fn() })) };
});

let root = "";
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "cadverix-update-"));
  await fs.mkdir(path.join(root, ".git"));
  await fs.writeFile(path.join(root, "package.json"), JSON.stringify({ version: "0.0.1" }));
  vi.spyOn(process, "cwd").mockReturnValue(root);
  vi.stubEnv("CADVERIX_APP_VERSION", "");
  vi.stubEnv("SKETCHFORGE_APP_VERSION", "");
  vi.stubEnv("NEXT_PUBLIC_STATIC_EXPORT", "false");
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ version: "9999.0.0" })));
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await fs.rm(root, { recursive: true, force: true });
});

it("reads the discovered application manifest, not a request path", async () => {
  const response = await GET(new Request("http://localhost/api/app-update?force=1&root=/etc&file=passwd"));
  expect((await response.json()).currentVersion).toBe("0.0.1");
});

it("does not read a linked application manifest", async () => {
  await fs.writeFile(path.join(root, "other.json"), JSON.stringify({ version: "88.0.0" }));
  await fs.unlink(path.join(root, "package.json"));
  await fs.symlink(path.join(root, "other.json"), path.join(root, "package.json"));
  const response = await GET(new Request("http://localhost/api/app-update?force=1"));
  expect((await response.json()).currentVersion).toBe(SKF_CREATED_WITH_VERSION);
});

it.each(["file", "directory"])("does not execute a restart script through a linked %s", async (linked) => {
  await fs.mkdir(path.join(root, "other-scripts"));
  await fs.writeFile(path.join(root, "other-scripts/restart-local-dev.mjs"), "throw new Error('untrusted')");
  if (linked === "directory") await fs.symlink(path.join(root, "other-scripts"), path.join(root, "scripts"));
  else {
    await fs.mkdir(path.join(root, "scripts"));
    await fs.symlink(path.join(root, "other-scripts/restart-local-dev.mjs"), path.join(root, "scripts/restart-local-dev.mjs"));
  }
  const response = await POST(new Request("http://localhost/api/app-update", { method: "POST" }));
  expect(response.status).toBe(409);
  expect((await response.json()).error).toContain("links");
  expect(spawn).not.toHaveBeenCalled();
});

it("still launches a regular restart script from the discovered repository", async () => {
  await fs.mkdir(path.join(root, "scripts"));
  await fs.writeFile(path.join(root, "scripts/restart-local-dev.mjs"), "// restart");
  const response = await POST(new Request("http://localhost/api/app-update", { method: "POST" }));
  expect(response.status).toBe(202);
  expect(spawn).toHaveBeenCalledWith(process.execPath, [path.join(await fs.realpath(root), "scripts/restart-local-dev.mjs"), String(process.pid), root], expect.objectContaining({ cwd: root }));
});
