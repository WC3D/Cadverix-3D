import { expect, test, type Locator } from "@playwright/test";

test("native pen edits, interruption cleanup, and palm rejection", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Native pen injection requires Chromium CDP; WebKit runs the touch/menu coverage.");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const session = await page.context().newCDPSession(page);
  const pen = async (type: "mousePressed" | "mouseMoved" | "mouseReleased", x: number, y: number) => {
    await session.send("Input.dispatchMouseEvent", { type, x, y, pointerType: "pen", button: "left", buttons: type === "mouseReleased" ? 0 : 1, force: type === "mouseReleased" ? 0 : 0.6, clickCount: 1 });
    await page.waitForTimeout(50);
  };
  const tap = async (locator: Locator) => {
    await locator.scrollIntoViewIfNeeded();
    const rect = (await locator.boundingBox())!;
    await pen("mousePressed", rect.x + rect.width / 2, rect.y + rect.height / 2);
    await pen("mouseReleased", rect.x + rect.width / 2, rect.y + rect.height / 2);
  };
  const state = async () => JSON.parse((await page.locator("[data-codex-state]").textContent())!);
  const surfacePoint = async () => page.locator(".transform-handle.height-top").evaluate((node) => {
    const top = node.getBoundingClientRect();
    const corner = document.querySelector(".transform-handle.corner")!.getBoundingClientRect();
    const x = (top.x + top.width / 2) * 0.7 + (corner.x + corner.width / 2) * 0.3;
    const y = (top.y + top.height / 2) * 0.7 + (corner.y + corner.height / 2) * 0.3;
    return { x, y, target: document.elementFromPoint(x, y)?.tagName };
  });

  await page.goto("/?editor=1");
  await expect(page.getByRole("tab", { name: "Sculpt", exact: true })).toHaveCount(0);
  await expect(page.locator(".touch-controls")).toBeVisible();
  await tap(page.getByRole("button", { name: "Add shape", exact: true }));
  await tap(page.getByRole("button", { name: "Box", exact: true }));
  expect((await state()).shapeCount).toBe(1);
  await tap(page.getByRole("button", { name: "Minimize shape settings" }));
  let point = await surfacePoint();
  expect(point.target).toBe("CANVAS");
  await pen("mousePressed", point.x, point.y);
  await pen("mouseMoved", point.x + 35, point.y + 20);
  await pen("mouseReleased", point.x + 35, point.y + 20);
  const moved = await state();
  expect(moved.shapes[0].x !== 0 || moved.shapes[0].z !== 0).toBe(true);
  await tap(page.getByRole("button", { name: "Undo", exact: true }));
  expect((await state()).shapes[0].x).toBe(0);

  point = await surfacePoint();
  await pen("mousePressed", point.x, point.y);
  await pen("mouseMoved", point.x + 30, point.y + 15);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await pen("mouseReleased", point.x + 30, point.y + 15);
  expect((await state()).shapes[0].x).toBe(0);

  await tap(page.getByRole("tab", { name: "Sketch", exact: true }));
  await tap(page.getByRole("button", { name: "Sketch to 3D options" }));
  await tap(page.getByRole("menuitem", { name: /^Extrude sketch/ }));
  await expect(page.locator(".sketch-plate")).toBeVisible();
  await tap(page.getByRole("button", { name: "Line", exact: true }));
  await pen("mousePressed", 650, 500); await pen("mouseReleased", 650, 500);
  await pen("mousePressed", 800, 600); await pen("mouseReleased", 800, 600);
  await expect(page.locator(".sketch-points circle")).toHaveCount(2);
  await tap(page.getByRole("button", { name: "Bezier Curve", exact: true }));
  await pen("mousePressed", 720, 400); await pen("mouseMoved", 780, 450);
  await expect(page.locator(".sketch-drag-handles")).toHaveCount(1);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(page.locator(".sketch-drag-handles")).toHaveCount(0);
  await pen("mouseReleased", 780, 450);
  await expect(page.locator(".sketch-points circle")).toHaveCount(2);

  await tap(page.getByRole("button", { name: "Line", exact: true }));
  await pen("mousePressed", 840, 400);
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ id: 1, x: 900, y: 600, radiusX: 20, radiusY: 20, force: 1 }] });
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await pen("mouseReleased", 840, 400);
  await expect(page.locator(".sketch-points circle")).toHaveCount(3);
  await page.touchscreen.tap(900, 500);
  await expect(page.locator(".sketch-points circle")).toHaveCount(4);
  expect(errors).toEqual([]);
});
