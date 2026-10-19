import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { DELETE, GET, PATCH, POST } from "@/app/api/shared-projects/route";
import { createHash } from "node:crypto";
import { exportSkfProject } from "@/lib/skfProject";
import { DEFAULT_WORKPLANE_WORKSPACE } from "@/lib/workplaneSettings";
import { editorHistoryEntry } from "@/lib/editorHistory";
let root = "", prior: string | undefined;
const url = "http://localhost/api/shared-projects";
const patch = (body: object, revision?: string) => PATCH(new Request(url, { method: "PATCH", headers: { "Content-Type": "application/json", ...(revision ? { "If-Match": `"${revision}"` } : {}) }, body: JSON.stringify(body) }));
beforeEach(async () => { prior = process.env.CADVERIX_SHARED_PROJECTS_DIR; root = await fs.mkdtemp(path.join(os.tmpdir(), "cadverix-storage-")); process.env.CADVERIX_SHARED_PROJECTS_DIR = root; });
afterEach(async () => { if (prior === undefined) delete process.env.CADVERIX_SHARED_PROJECTS_DIR; else process.env.CADVERIX_SHARED_PROJECTS_DIR = prior; await fs.rm(root, { recursive: true, force: true }); });
it("creates folders, retains the old SKF on save, and uses revisions for moves", async () => {
  expect((await patch({ action: "mkdir", path: "Parts" })).status).toBe(200);
  const input = { projectName: "Bracket", createdAt: 1, modifiedAt: 2, shapes: [], history: [editorHistoryEntry([], [])], historyIndex: 0, assets: [], workspace: DEFAULT_WORKPLANE_WORKSPACE, snapGrid: "1.0 mm" as const, placementElevation: 0 };
  const bytes = await exportSkfProject(input);
  const first = await POST(new Request(`${url}?fileName=Parts%2FBracket.skf`, { method: "POST", headers: { "If-None-Match": "*" }, body: new Uint8Array(bytes) }));
  expect(first.status).toBe(201);
  const firstProject = (await first.json()).project;
  const second = await POST(new Request(`${url}?fileName=Parts%2FBracket.skf`, { method: "POST", headers: { "If-Match": `"${firstProject.revision}"` }, body: new Uint8Array(await exportSkfProject({ ...input, projectName: "Changed bracket" })) }));
  expect(second.status).toBe(200);
  const secondProject = (await second.json()).project;
  const versions = await (await GET(new Request(`${url}?fileName=Parts%2FBracket.skf&versions=1`))).json();
  expect(versions.versions).toHaveLength(1);
  const recovered = await GET(new Request(`${url}?fileName=Parts%2FBracket.skf&backup=${versions.versions[0]}`));
  expect(new Uint8Array(await recovered.arrayBuffer())).toEqual(bytes);
  expect((await patch({ action: "move", path: "Parts/Bracket.skf", destination: "Moved.skf" }, "stale")).status).toBe(409);
  expect((await patch({ action: "move", path: "Parts/Bracket.skf", destination: "Moved.skf" }, secondProject.revision)).status).toBe(200);
  const listing = await (await GET(new Request(url))).json();
  expect(listing.folders).toEqual(["Parts"]);
  expect(listing.capabilities).toMatchObject({ folders: true, versions: true });
  expect(listing.projects[0].fileName).toBe("Moved.skf");
  expect((await (await GET(new Request(`${url}?archives=1`))).json()).archives).toContain("Parts/Bracket.skf");
});
it("rejects traversal and symlink directories and does not remove another writer's lock", async () => {
  expect((await patch({ action: "mkdir", path: "../escape" })).status).toBe(400);
  await fs.symlink(os.tmpdir(), path.join(root, "Link"));
  expect((await patch({ action: "mkdir", path: "Link/escape" })).status).toBe(400);
  await fs.writeFile(path.join(root, "Source.skf"), "fixture");
  await fs.writeFile(path.join(root, "Source.skf.lock"), "owned by another request");
  const listed = (await (await GET(new Request(url))).json()).projects[0];
  const result = await patch({ action: "copy", path: "Source.skf", destination: "Copy.skf" }, listed.revision);
  expect(result.ok).toBe(false);
  expect(await fs.readFile(path.join(root, "Source.skf.lock"), "utf8")).toBe("owned by another request");
});

it.each([".backups", "version-directory", "project.json"])("refuses a linked %s without deleting the project or writing outside storage", async (linked) => {
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), "cadverix-outside-"));
  try {
    await fs.writeFile(path.join(outside, "secret"), "private");
    await fs.writeFile(path.join(root, "Source.skf"), "project");
    const hash = createHash("sha256").update("Source.skf").digest("hex");
    const directory = path.join(root, ".backups", hash);
    if (linked === ".backups") await fs.symlink(outside, path.join(root, ".backups"));
    else if (linked === "version-directory") {
      await fs.mkdir(path.join(root, ".backups"));
      await fs.symlink(outside, directory);
    } else {
      await fs.mkdir(directory, { recursive: true });
      await fs.symlink(path.join(outside, "secret"), path.join(directory, "project.json"));
    }
    const project = (await (await GET(new Request(url))).json()).projects[0];
    const response = await DELETE(new Request(`${url}?fileName=Source.skf`, { method: "DELETE", headers: { "If-Match": `"${project.revision}"` } }));
    expect(response.ok).toBe(false);
    expect(await fs.readFile(path.join(root, "Source.skf"), "utf8")).toBe("project");
    expect(await fs.readdir(outside)).toEqual(["secret"]);
    expect(await fs.readFile(path.join(outside, "secret"), "utf8")).toBe("private");
  } finally {
    await fs.rm(outside, { recursive: true, force: true });
  }
});

it("does not read a linked backup file", async () => {
  const hash = createHash("sha256").update("Source.skf").digest("hex");
  const directory = path.join(root, ".backups", hash);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(root, "secret"), "private");
  await fs.symlink(path.join(root, "secret"), path.join(directory, "1-abcd.skf"));
  const response = await GET(new Request(`${url}?fileName=Source.skf&backup=1-abcd.skf`));
  expect(response.ok).toBe(false);
  expect(await response.text()).not.toContain("private");
});
