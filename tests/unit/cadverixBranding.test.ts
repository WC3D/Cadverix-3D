import { describe, expect, it, vi } from "vitest";
import { exportMeshesToObj } from "@/lib/objExport";
import { importedShapeFromObj } from "@/lib/objImport";
import { SKF_SCHEMA_ID, SKF_MEDIA_TYPE } from "@/lib/skfProject";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import path from "node:path";
import { GET as listSharedProjects } from "@/app/api/shared-projects/route";

describe("Cadverix 3D rename compatibility", () => {
  it("prefers the new shared-library setting while honoring the legacy fallback and explicit disable", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "cadverix-env-"));
    try {
      for (const folder of ["new", "old"]) {
        mkdirSync(path.join(root, folder));
        writeFileSync(path.join(root, folder, `${folder}.skf`), "listing fixture");
      }
      vi.stubEnv("SKETCHFORGE_SHARED_PROJECTS_DIR", path.join(root, "old"));
      vi.stubEnv("CADVERIX_SHARED_PROJECTS_DIR", path.join(root, "new"));
      const request = () => new Request("http://localhost:3000/api/shared-projects");
      expect((await (await listSharedProjects(request())).json()).projects.map((project: { fileName: string }) => project.fileName)).toEqual(["new.skf"]);
      vi.stubEnv("CADVERIX_SHARED_PROJECTS_DIR", "");
      expect((await (await listSharedProjects(request())).json()).enabled).toBe(false);
      vi.stubEnv("CADVERIX_SHARED_PROJECTS_DIR", undefined);
      expect((await (await listSharedProjects(request())).json()).projects.map((project: { fileName: string }) => project.fileName)).toEqual(["old.skf"]);
    } finally {
      vi.unstubAllEnvs();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("round-trips a new branded OBJ without swapping its vertical and depth axes", () => {
    const text = exportMeshesToObj([{ name: "Part", vertices: [[0, 0, 0], [2, 0, 5], [0, 3, 0]], faces: [[0, 1, 2]] }]);
    expect(text).toContain("# Cadverix 3D OBJ export");
    const imported = importedShapeFromObj("part.obj", text);
    expect(imported.width).toBe(2);
    expect(imported.height).toBe(3);
    expect(imported.depth).toBe(5);
  });

  it("keeps the existing project file contract and desktop installation identity", () => {
    expect(SKF_SCHEMA_ID).toBe("com.sketchforge.project");
    expect(SKF_MEDIA_TYPE).toBe("application/vnd.sketchforge.project+zip");
    const config = readFileSync("apps/desktop/electron-builder.yml", "utf8");
    expect(config).toContain("productName: Cadverix 3D");
    expect(config).toContain("appId: com.sketchforge.desktop");
    const desktop = readFileSync("apps/desktop/main.cjs", "utf8");
    expect(desktop).toContain('"62158"');
  });

  it.each([false, true])("retains the previous desktop profile when packaged=%s", (isPackaged) => {
    const paths: Record<string, string> = {};
    let appName = "";
    const app = {
      isPackaged,
      setName: (name: string) => { appName = name; },
      getPath: () => path.resolve("legacy-app-data"),
      setPath: (key: string, value: string) => { paths[key] = value; },
      requestSingleInstanceLock: () => false,
      quit: () => {},
      on: () => {},
    };
    const require = createRequire(import.meta.url);
    runInNewContext(readFileSync("apps/desktop/main.cjs", "utf8"), {
      require: (name: string) => name === "electron" ? { app } : name === "electron-updater" ? { autoUpdater: {} } : require(name),
      process: { env: {} },
    });
    expect(appName).toBe("Cadverix 3D");
    expect(paths.userData).toBe(path.resolve("legacy-app-data", isPackaged ? "SketchForge" : "sketchforge"));
  });
});
