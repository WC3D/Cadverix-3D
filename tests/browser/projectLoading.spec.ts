import { expect, test } from "@playwright/test";

test("save failures warn inside the editor and clear only after a successful save", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Create new 3D design", exact: true }).click();
  await page.evaluate(() => {
    document.documentElement.dataset.failProjectWrites = "true";
    const transaction = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (stores, mode, options) {
      if (this.name === "sketchForge.projectShapes" && mode === "readwrite" && document.documentElement.dataset.failProjectWrites === "true") {
        this.close();
        throw new DOMException("Simulated storage full", "QuotaExceededError");
      }
      return transaction.call(this, stores, mode, options);
    };
  });
  await page.getByRole("button", { name: "Add shape", exact: true }).click();
  await page.getByRole("button", { name: "Box", exact: true }).click();
  const warning = page.getByRole("alert", { name: "Project save failed", exact: true });
  await expect(warning).toContainText("Project not saved: Simulated storage full");
  await expect(warning).toContainText("Export an SKF backup before closing");
  expect(JSON.parse(await page.locator("[data-codex-state]").textContent() ?? "{}").shapeCount).toBe(1);
  await page.evaluate(() => { document.documentElement.dataset.failProjectWrites = "false"; });
  await page.getByRole("button", { name: "Add shape", exact: true }).click();
  await page.getByRole("button", { name: "Box", exact: true }).click();
  await expect(warning).toHaveCount(0);
  await page.reload();
  await expect.poll(async () => JSON.parse(await page.locator("[data-codex-state]").textContent() ?? "{}").shapeCount).toBe(2);
});

test("a missing saved record cannot open and autosave an empty replacement", async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("sketchForge.projects")) localStorage.setItem("sketchForge.projects", JSON.stringify([
      { id: "missing-record", name: "Retained design", revision: 1, createdAt: 1, updatedAt: 1, shapes: 2 },
    ]));
  });
  await page.goto("/?editor=1&project=missing-record");
  await expect(page.getByRole("status")).toContainText("No empty replacement was saved");
  await expect(page.locator("[data-codex-state]")).toHaveCount(0);
  expect(await page.evaluate(async () => {
    const projects = JSON.parse(localStorage.getItem("sketchForge.projects")!);
    const count = await new Promise<number>((resolve, reject) => {
      const request = indexedDB.open("sketchForge.projectShapes", 3);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const read = db.transaction("projectShapes", "readonly").objectStore("projectShapes").count();
        read.onsuccess = () => { db.close(); resolve(read.result); };
        read.onerror = () => { db.close(); reject(read.error); };
      };
    });
    return { shapes: projects.find((project: { id: string }) => project.id === "missing-record").shapes, records: count };
  })).toEqual({ shapes: 2, records: 0 });
});

test("a blocked storage upgrade returns to projects without replacing saved geometry", async ({ context, page }) => {
  const holder = await context.newPage();
  await holder.goto("/");
  await expect(holder.getByRole("button", { name: "Create new 3D design", exact: true })).toBeVisible();
  await expect.poll(() => holder.evaluate(() => localStorage.getItem("sketchForge.projects"))).toBe("[]");
  await holder.evaluate(async () => {
    localStorage.setItem("sketchForge.projects", JSON.stringify([{ id: "blocked-project", name: "Blocked project", revision: 1, createdAt: 1, updatedAt: 1, shapes: 1 }]));
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("sketchForge.projectShapes", 2);
      request.onupgradeneeded = () => request.result.createObjectStore("projectShapes", { keyPath: "id" });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction("projectShapes", "readwrite");
        transaction.objectStore("projectShapes").put({
          id: "blocked-project", revision: 1, updatedAt: 1,
          shapes: [{ id: "saved-box", name: "Saved box", kind: "box", color: "#ff0000", x: 0, z: 0, size: 20, width: 20, depth: 20, height: 20, rotation: 0 }],
        });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        // Keep this old connection alive until the tab closes, like an outdated app tab.
        (window as Window & { heldDatabase?: IDBDatabase }).heldDatabase = database;
      };
    });
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?editor=1&project=blocked-project");
  await expect(page.getByRole("status")).toContainText("Project storage is blocked by another tab");
  await expect(page.getByRole("status", { name: "Loading editor", exact: true })).toHaveCount(0);
  await expect(page.locator("[data-codex-state]")).toHaveCount(0);
  expect(await holder.evaluate(async () => new Promise((resolve, reject) => {
    const database = (window as Window & { heldDatabase?: IDBDatabase }).heldDatabase!;
    const request = database.transaction("projectShapes", "readonly").objectStore("projectShapes").get("blocked-project");
    request.onsuccess = () => resolve(request.result.shapes.map((shape: { id: string }) => shape.id));
    request.onerror = () => reject(request.error);
  }))).toEqual(["saved-box"]);
  await holder.close();
  await page.goto("/?editor=1&project=blocked-project");
  await expect.poll(async () => JSON.parse(await page.locator("[data-codex-state]").textContent() ?? "{}").shapes?.map((shape: { id: string }) => shape.id)).toEqual(["saved-box"]);
  await expect(page.getByRole("status", { name: "Loading editor", exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});
