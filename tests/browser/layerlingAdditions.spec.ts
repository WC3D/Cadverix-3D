import { expect, test, type Page } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";

const scene = async (page: Page) => JSON.parse(await page.locator("[data-codex-state]").textContent() ?? "{}");
async function addBox(page: Page) {
  await page.getByRole("button", { name: "Add shape", exact: true }).click();
  await page.getByRole("button", { name: "Box", exact: true }).click();
}
async function surfacePoint(page: Page) {
  return page.locator(".transform-handle.height-top").evaluate((node) => {
    const top = node.getBoundingClientRect(), corner = document.querySelector(".transform-handle.corner")!.getBoundingClientRect();
    return { x: (top.x + top.width / 2) * .7 + (corner.x + corner.width / 2) * .3, y: (top.y + top.height / 2) * .7 + (corner.y + corner.height / 2) * .3 };
  });
}
async function savedState(page: Page) {
  const bytes = await page.evaluate(async () => {
    const id = new URL(location.href).searchParams.get("project");
    return new Promise<number[]>((resolve, reject) => {
      const open = indexedDB.open("sketchForge.projectShapes", 3);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const request = open.result.transaction("projectShapes", "readonly").objectStore("projectShapes").get(id!);
        request.onsuccess = () => { open.result.close(); resolve(Array.from(request.result?.skfPackage ?? [])); };
        request.onerror = () => { open.result.close(); reject(request.error); };
      };
    });
  });
  if (!bytes.length) return null;
  const document = JSON.parse(strFromU8(unzipSync(new Uint8Array(bytes))["project.json"]));
  return document.states.find((state: { id: string }) => state.id === document.sceneStateId);
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const fetch = window.fetch.bind(window);
    window.fetch = (input, init) => /\/api\/(?:cadverix|sketchforge)-mcp/.test(String(input)) ? Promise.resolve(new Response("", { status: 404 })) : fetch(input, init);
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Create new 3D design", exact: true }).click();
});

test("command search runs existing tools and inspection does not change model data", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
  await page.keyboard.press("Control+k");
  const search = page.getByRole("dialog", { name: "Search commands", exact: true });
  await search.getByRole("textbox").fill("Add Box"); await search.getByRole("textbox").press("Enter");
  await expect(search).not.toBeVisible();
  await expect.poll(async () => (await scene(page)).shapeCount).toBe(1);
  const before = (await scene(page)).shapes;
  await page.getByRole("button", { name: "Search commands", exact: true }).click();
  await search.getByRole("textbox").fill("shell");
  await search.getByRole("button", { name: /Modeling tools/ }).click();
  await page.getByLabel("Section view", { exact: true }).check();
  await page.getByLabel("Section offset", { exact: true }).fill("10");
  await page.getByLabel("Show overhangs", { exact: true }).check();
  await expect(page.getByLabel("Overhang angle", { exact: true })).toHaveValue("45");
  expect((await scene(page)).shapes).toEqual(before);
  await page.getByLabel("Flip section", { exact: true }).check();
  await page.getByLabel("Section view", { exact: true }).uncheck();
  expect((await scene(page)).shapes).toEqual(before);
  expect(errors).toEqual([]);
});

test("reusable shapes survive reload, insert independently and undo", async ({ page }) => {
  await addBox(page);
  await page.getByRole("button", { name: "Modeling tools", exact: true }).click();
  await page.getByLabel("Reusable shape name", { exact: true }).fill("Bracket");
  await page.evaluate(() => Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true }));
  await page.getByRole("button", { name: "Save selection to library", exact: true }).click();
  await expect(page.getByRole("button", { name: "Insert Bracket", exact: true })).toBeVisible();
  await expect.poll(async () => (await savedState(page))?.rootNodeIds.length).toBe(1);
  await page.reload();
  await page.getByRole("button", { name: "Modeling tools", exact: true }).click();
  await page.getByRole("button", { name: "Insert Bracket", exact: true }).click();
  await expect.poll(async () => (await scene(page)).shapeCount).toBe(2);
  expect(new Set((await scene(page)).shapes.map((shape: { id: string }) => shape.id)).size).toBe(2);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => (await scene(page)).shapeCount).toBe(1);
});

test("a picked pivot survives saving and reopening", async ({ page }) => {
  await addBox(page);
  await page.getByRole("button", { name: "Minimize shape settings", exact: true }).click();
  const point = await surfacePoint(page);
  await page.getByRole("button", { name: "Modeling tools", exact: true }).click();
  await page.getByRole("button", { name: "Pick face pivot", exact: true }).click();
  await page.mouse.click(point.x, point.y);
  await expect.poll(async () => (await scene(page)).shapes[0].rotationPivot).not.toBeNull();
  const pivot = (await scene(page)).shapes[0].rotationPivot;
  await expect.poll(async () => (await savedState(page))?.nodes[0].definition.rotationPivot).toEqual(pivot);
  await page.reload();
  await expect.poll(async () => (await scene(page)).shapes[0]?.rotationPivot).toEqual(pivot);
});

test("face holes cut and undo, and an associative face plane preserves the Group", async ({ page }) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await addBox(page);
  await page.getByRole("button", { name: "Minimize shape settings", exact: true }).click();
  const point = await surfacePoint(page);
  await page.getByRole("button", { name: "Modeling tools", exact: true }).click();
  await page.getByRole("button", { name: "Pick face for hole pattern", exact: true }).click();
  await page.mouse.click(point.x, point.y);
  await expect(page.getByRole("button", { name: "Create hole pattern", exact: true })).toBeEnabled();
  expect((await scene(page)).shapeCount).toBe(1);
  await page.getByRole("button", { name: "Create hole pattern", exact: true }).click();
  await expect.poll(async () => (await scene(page)).shapes[0].groupedCount, { timeout: 60000 }).toBeGreaterThan(1);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  const group = (await scene(page)).shapes[0];
  await expect.poll(async () => (await savedState(page))?.nodes.find((node: { objectId: string }) => node.objectId === group.id)?.definition.kind).toBe(group.kind);
  const definition = (await savedState(page)).nodes.find((node: { objectId: string }) => node.objectId === group.id).definition;
  const face = await surfacePoint(page);
  await page.getByRole("button", { name: "Reference planes", exact: true }).click();
  await page.getByRole("button", { name: "Pick a planar model face", exact: true }).click();
  await page.mouse.click(face.x + 15, face.y);
  await expect.poll(async () => (await scene(page)).shapes.filter((shape: { kind: string }) => shape.kind === "constructionPlane").length).toBe(1);
  expect((await scene(page)).shapes.find((shape: { id: string }) => shape.id === group.id)).toEqual(group);
  await expect.poll(async () => (await savedState(page))?.nodes.find((node: { objectId: string }) => node.objectId === group.id)?.definition).toEqual(definition);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => (await scene(page)).shapeCount).toBe(1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => (await scene(page)).shapes[0].kind).toBe("box");
  expect((await scene(page)).shapes[0].groupedCount).toBe(0);
  expect(errors).toEqual([]);
});

test("missing dashboard cards can be recovered from retained geometry", async ({ page }) => {
  await addBox(page);
  await expect.poll(async () => (await savedState(page))?.rootNodeIds.length).toBe(1);
  await page.getByRole("button", { name: "Home dashboard", exact: true }).click();
  await page.evaluate(() => localStorage.removeItem("sketchForge.projects"));
  await page.reload();
  await page.getByRole("button", { name: "Storage & backups", exact: true }).click();
  await page.getByRole("button", { name: "Recover missing designs", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Recovered 1 missing designs");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem("sketchForge.projects") ?? "[]").length)).toBe(1);
});

test("command search remains usable on a narrow phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Search commands", exact: true }).click();
  const search = page.getByRole("dialog", { name: "Search commands", exact: true });
  const bounds = (await search.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  await search.getByRole("textbox").fill("cylinder");
  await search.getByRole("textbox").press("ArrowDown"); await page.keyboard.press("Enter");
  await expect.poll(async () => (await scene(page)).shapes[0]?.kind).toBe("cylinder");
});

test("inline project pictures migrate to IndexedDB before being removed from the list", async ({ page }) => {
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem("sketchForge.projects") ?? "[]").length)).toBe(1);
  const picture = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS1cAAAAASUVORK5CYII=";
  await page.evaluate((url) => { const projects = JSON.parse(localStorage.getItem("sketchForge.projects")!); projects[0].thumbnailUrl = url; localStorage.setItem("sketchForge.projects", JSON.stringify(projects)); }, picture);
  await page.reload();
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem("sketchForge.projects")!)[0].thumbnailUrl)).toBeNull();
  const saved = await page.evaluate(async () => {
    const id = JSON.parse(localStorage.getItem("sketchForge.projects")!)[0].id;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("cadverix.projectThumbnails", 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => { const read = request.result.transaction("pictures", "readonly").objectStore("pictures").get(id); read.onsuccess = () => { request.result.close(); resolve(read.result); }; read.onerror = () => reject(read.error); };
    });
  });
  expect(saved).toBe(picture);
});

test("object snapping shows alignment guides and Alt temporarily disables it", async ({ page }) => {
  await addBox(page); await addBox(page);
  for (let index = 0; index < 20; index++) await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "Minimize shape settings", exact: true }).click();
  const point = await surfacePoint(page);
  await page.mouse.move(point.x, point.y); await page.mouse.down();
  await page.mouse.move(point.x + 4, point.y + 1, { steps: 4 });
  await expect(page.locator(".object-snap-guides line").first()).toBeVisible();
  await page.keyboard.down("Alt"); await page.mouse.move(point.x + 9, point.y + 2, { steps: 3 });
  await expect(page.locator(".object-snap-guides")).toHaveCount(0);
  await page.mouse.up(); await page.keyboard.up("Alt");
  expect((await scene(page)).shapeCount).toBe(2);
  expect((await scene(page)).shapes[0].x).toBe(0);
});
