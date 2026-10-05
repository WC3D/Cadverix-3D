import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/shared-projects/route";
import { exportSkfProject } from "@/lib/skfProject";
import { DEFAULT_WORKPLANE_WORKSPACE } from "@/lib/workplaneSettings";
import { editorHistoryEntry } from "@/lib/editorHistory";

const SHARED_PROJECTS_ENV = "CADVERIX_SHARED_PROJECTS_DIR";

let sharedProjectsRoot = "";
let previousSharedProjectsRoot: string | undefined;

// Helper to create a minimal valid SKF project
async function createMinimalSkfProject() {
  const input = {
    projectName: "Test Project",
    createdAt: Date.now(),
    modifiedAt: Date.now(),
    shapes: [],
    history: [editorHistoryEntry([], [])],
    historyIndex: 0,
    assets: [],
    workspace: DEFAULT_WORKPLANE_WORKSPACE,
    snapGrid: "1.0 mm" as const,
    placementElevation: 0,
  };
  return await exportSkfProject(input);
}

// Helper to create a simple PNG thumbnail (8-byte PNG signature + minimal data)
function createMinimalPngThumbnail(): Uint8Array {
  // PNG signature: 137 80 78 71 13 10 26 10
  const pngSignature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  // Add minimal IHDR chunk to make it a valid (though tiny) PNG
  const ihdr = new Uint8Array([
    0, 0, 0, 13, // chunk length
    73, 72, 68, 82, // "IHDR"
    0, 0, 0, 1, // width: 1
    0, 0, 0, 1, // height: 1
    8, 2, 0, 0, 0, // bit depth, color type, compression, filter, interlace
    144, 119, 83, 222, // CRC
    0, 0, 0, 0, // IEND chunk length
    73, 69, 78, 68, // "IEND"
    174, 66, 96, 130, // CRC
  ]);
  const result = new Uint8Array(pngSignature.length + ihdr.length);
  result.set(pngSignature, 0);
  result.set(ihdr, pngSignature.length);
  return result;
}

// Helper to upload a project with thumbnail
async function uploadProjectWithThumbnail(fileName: string) {
  const projectBytes = await createMinimalSkfProject();
  const thumbnailBytes = createMinimalPngThumbnail();

  const formData = new FormData();
  formData.append("project", new Blob([projectBytes]));
  formData.append("thumbnail", new Blob([thumbnailBytes]));

  const url = `http://localhost/api/shared-projects?fileName=${encodeURIComponent(fileName)}`;
  const response = await POST(
    new Request(url, {
      method: "POST",
      headers: {
        Origin: "http://localhost",
        "If-None-Match": "*",
      },
      body: formData,
    })
  );

  return response;
}

describe("shared thumbnail path security", () => {
  beforeEach(async () => {
    previousSharedProjectsRoot = process.env[SHARED_PROJECTS_ENV];
    sharedProjectsRoot = await fs.mkdtemp(path.join(os.tmpdir(), "sketchforge-thumbnail-security-"));
    process.env[SHARED_PROJECTS_ENV] = sharedProjectsRoot;
  });

  afterEach(async () => {
    if (previousSharedProjectsRoot === undefined) delete process.env[SHARED_PROJECTS_ENV];
    else process.env[SHARED_PROJECTS_ENV] = previousSharedProjectsRoot;
    await fs.rm(sharedProjectsRoot, { recursive: true, force: true });
  });

  it("stores thumbnails safely within the thumbnails directory", async () => {
    const response = await uploadProjectWithThumbnail("SafeProject.skf");
    expect(response.status).toBe(201);

    const project = (await response.json()).project;
    expect(project.thumbnailUrl).toBeDefined();

    // Verify thumbnail is stored in the correct location
    const thumbnailsDir = path.join(sharedProjectsRoot, ".thumbnails");
    const files = await fs.readdir(thumbnailsDir);
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/^SafeProject\.skf\.[a-f0-9]+-[a-f0-9]+\.png$/);
  });

  it("rejects path traversal attempts via revision parameter with parent directory", async () => {
    // Create a project first
    const response = await uploadProjectWithThumbnail("Legitimate.skf");
    expect(response.status).toBe(201);

    const project = (await response.json()).project;

    // Try to access thumbnail with a malicious revision containing path traversal
    const maliciousRevision = "../../../etc/passwd";
    const url = `http://localhost/api/shared-projects?fileName=Legitimate.skf&thumbnail=1&v=${encodeURIComponent(maliciousRevision)}`;
    const thumbnailResponse = await GET(new Request(url));

    // Should fail - either 404 or 500, but not return sensitive files
    expect(thumbnailResponse.status).not.toBe(200);
    expect(thumbnailResponse.status).toBeGreaterThanOrEqual(400);
  });

  it("rejects path traversal attempts via revision parameter with absolute path", async () => {
    const response = await uploadProjectWithThumbnail("Test.skf");
    expect(response.status).toBe(201);

    // Try to use an absolute path in revision
    const maliciousRevision = "/etc/passwd";
    const url = `http://localhost/api/shared-projects?fileName=Test.skf&thumbnail=1&v=${encodeURIComponent(maliciousRevision)}`;
    const thumbnailResponse = await GET(new Request(url));

    expect(thumbnailResponse.status).not.toBe(200);
    expect(thumbnailResponse.status).toBeGreaterThanOrEqual(400);
  });

  it("rejects path traversal attempts via nested fileName with malicious revision", async () => {
    // Create nested directory structure
    await fs.mkdir(path.join(sharedProjectsRoot, "Projects"), { recursive: true });

    const response = await uploadProjectWithThumbnail("Projects/Nested.skf");
    expect(response.status).toBe(201);

    // Try to traverse out of thumbnails directory using revision
    const maliciousRevision = "../../sensitive.txt";
    const url = `http://localhost/api/shared-projects?fileName=Projects%2FNested.skf&thumbnail=1&v=${encodeURIComponent(maliciousRevision)}`;
    const thumbnailResponse = await GET(new Request(url));

    expect(thumbnailResponse.status).not.toBe(200);
    expect(thumbnailResponse.status).toBeGreaterThanOrEqual(400);
  });

  it("prevents reading arbitrary files via crafted thumbnailKey and revision combination", async () => {
    // Create a sensitive file outside the thumbnails directory
    const sensitiveFile = path.join(sharedProjectsRoot, "secret.txt");
    await fs.writeFile(sensitiveFile, "sensitive data");

    // Try to access it via thumbnail endpoint with crafted parameters
    const maliciousRevision = "../secret";
    const url = `http://localhost/api/shared-projects?fileName=dummy.skf&thumbnail=1&v=${encodeURIComponent(maliciousRevision)}`;
    const thumbnailResponse = await GET(new Request(url));

    // Should not be able to read the sensitive file
    expect(thumbnailResponse.status).not.toBe(200);
    if (thumbnailResponse.status === 200) {
      const content = await thumbnailResponse.text();
      expect(content).not.toContain("sensitive data");
    }
  });

  it("validates that thumbnail paths remain within the thumbnails directory", async () => {
    const response = await uploadProjectWithThumbnail("ValidProject.skf");
    expect(response.status).toBe(201);

    const project = (await response.json()).project;

    // Request the legitimate thumbnail
    const url = `http://localhost/api/shared-projects?fileName=ValidProject.skf&thumbnail=1&v=${project.revision}`;
    const thumbnailResponse = await GET(new Request(url));

    expect(thumbnailResponse.status).toBe(200);
    expect(thumbnailResponse.headers.get("content-type")).toBe("image/png");

    // Verify the thumbnail content is a valid PNG
    const thumbnailData = new Uint8Array(await thumbnailResponse.arrayBuffer());
    expect(thumbnailData[0]).toBe(137); // PNG signature first byte
    expect(thumbnailData[1]).toBe(80);  // PNG signature second byte
  });

  it("handles nested project thumbnails securely with hashed keys", async () => {
    // Create nested directory
    await fs.mkdir(path.join(sharedProjectsRoot, "Folder"), { recursive: true });

    const response = await uploadProjectWithThumbnail("Folder/Project.skf");
    expect(response.status).toBe(201);

    const project = (await response.json()).project;

    // Verify thumbnail is stored with hashed key for nested paths
    const thumbnailsDir = path.join(sharedProjectsRoot, ".thumbnails");
    const files = await fs.readdir(thumbnailsDir);
    expect(files.length).toBe(1);
    // Nested files should use .nested-<hash> prefix
    expect(files[0]).toMatch(/^\.nested-[a-f0-9]{64}\.[a-f0-9]+-[a-f0-9]+\.png$/);

    // Verify we can retrieve it
    const url = `http://localhost/api/shared-projects?fileName=Folder%2FProject.skf&thumbnail=1&v=${project.revision}`;
    const thumbnailResponse = await GET(new Request(url));
    expect(thumbnailResponse.status).toBe(200);
  });
});
