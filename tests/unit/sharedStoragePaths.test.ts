import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { resolveContainedPath, resolveSharedPath, sharedRelativePath } from "@/lib/sharedStoragePaths";

let root = "";
beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), "cadverix-paths-")); });
afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });

it.each(["../secret", "a/../../secret", "/etc/passwd", "C:\\secret", "a\\..\\secret", "a/./secret", "a\0secret"])("rejects unsafe path %s", async (relative) => {
  expect(() => sharedRelativePath(relative)).toThrow();
  await expect(resolveContainedPath(root, relative, true)).rejects.toThrow();
});

it("allows nested paths and only permits a missing final component", async () => {
  await fs.mkdir(path.join(root, "Parts"));
  expect(await resolveSharedPath(root, "Parts/New.skf", true)).toBe(path.join(await fs.realpath(root), "Parts/New.skf"));
  await expect(resolveSharedPath(root, "Missing/New.skf", true)).rejects.toThrow();
  await expect(resolveSharedPath(root, "Parts/New.skf")).rejects.toThrow();
  expect(() => sharedRelativePath(null as unknown as string)).toThrow("Invalid storage path");
});

it("rejects directory and leaf links, including internal storage paths", async () => {
  await fs.mkdir(path.join(root, "Real"));
  await fs.writeFile(path.join(root, "Real/Project.skf"), "fixture");
  await fs.symlink(path.join(root, "Real"), path.join(root, "Link"));
  await fs.symlink(path.join(root, "Real/Project.skf"), path.join(root, "Linked.skf"));
  await fs.symlink(path.join(root, "Real"), path.join(root, ".backups"));
  await expect(resolveSharedPath(root, "Link/Project.skf")).rejects.toThrow("links");
  await expect(resolveSharedPath(root, "Linked.skf", true)).rejects.toThrow("links");
  await expect(resolveContainedPath(root, ".backups/new.skf", true)).rejects.toThrow("links");
});
