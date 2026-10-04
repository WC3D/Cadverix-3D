import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { unzipSync } from "fflate";

test.beforeEach(async ({ request }) => { await request.post("/__pwa-test/reset"); });

test("cached app reloads and performs CAD shelling, drawings and SKF export offline", async ({ page, context, request, browserName }) => {
  await page.goto("/");
  await expect(page.getByLabel("Offline app status")).toHaveText("Ready for offline use", { timeout: 90000 });
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.state)).toBe("activated");
  // WebKit's driver-level offline switch returns an internal error for SW
  // navigations here. Drop all app-server connections instead, so neither
  // navigations nor lazy runtime requests can fall back to the server.
  if (browserName === "webkit") await request.post("/__pwa-test/disconnect");
  else await context.setOffline(true);
  await page.reload();
  await expect(page.getByLabel("Offline app status")).toHaveText("Ready for offline use");
  await page.getByRole("button", { name: "Create new 3D design", exact: true }).click();
  await page.getByRole("button", { name: "Add shape", exact: true }).click();
  await page.getByRole("button", { name: "Box", exact: true }).click();
  await page.getByRole("button", { name: "Modeling tools", exact: true }).click();
  await page.getByRole("button", { name: "Apply shell", exact: true }).click();
  await expect(page.locator(".editor-toast")).toContainText("Shelled", { timeout: 65000 });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("tab", { name: "Drawing", exact: true }).click();
  await page.getByRole("button", { name: "Add view", exact: true }).click();
  await expect(page.locator('[data-drawing-kind="view"]')).toHaveCount(1);
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save SKF", exact: true }).click();
  expect(unzipSync(await readFile((await (await downloaded).path())!))["project.json"]).toBeDefined();
  await page.reload();
  await expect.poll(async () => JSON.parse(await page.locator("[data-codex-state]").textContent() ?? "{}").shapeCount).toBe(1);
  await page.getByRole("tab", { name: "Drawing", exact: true }).click();
  await expect(page.locator('[data-drawing-kind="view"]')).toHaveCount(1);
});

test("failed precache is not advertised as offline-ready and can be retried", async ({ page, request }) => {
  await request.post("/__pwa-test/fail-kernel?enabled=1");
  await page.goto("/");
  await expect(page.getByLabel("Offline app status")).toContainText(/could not|did not/, { timeout: 90000 });
  expect(await page.evaluate(() => navigator.serviceWorker.controller === null)).toBe(true);
  await request.post("/__pwa-test/fail-kernel?enabled=0");
  await page.getByRole("button", { name: "Retry offline setup", exact: true }).click();
  await expect(page.getByLabel("Offline app status")).toHaveText("Ready for offline use", { timeout: 90000 });
});

test("updates wait for the editor to close rather than taking over an active session", async ({ page, context, request }) => {
  await page.goto("/");
  await expect(page.getByLabel("Offline app status")).toHaveText("Ready for offline use", { timeout: 90000 });
  await page.evaluate(() => { (window as Window & { previousController?: ServiceWorker | null }).previousController = navigator.serviceWorker.controller; });
  await request.post("/__pwa-test/update");
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())!.update());
  await expect(page.getByText(/Update ready\. Finish your work/)).toBeVisible({ timeout: 90000 });
  expect(await page.evaluate(() => navigator.serviceWorker.controller === (window as Window & { previousController?: ServiceWorker | null }).previousController)).toBe(true);
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.waiting?.state)).toBe("installed");
  await page.close();
  const reopened = await context.newPage();
  await reopened.goto("/");
  await expect(pageReady(reopened)).toHaveText("Ready for offline use", { timeout: 90000 });
  await expect.poll(() => reopened.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.waiting === null)).toBe(true);
  await expect(reopened.getByText(/Update ready\. Finish your work/)).toHaveCount(0);
});

function pageReady(page: import("@playwright/test").Page) { return page.getByLabel("Offline app status"); }

test("install banner uses the captured browser prompt and fits a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByLabel("Offline app status")).toHaveText("Ready for offline use", { timeout: 90000 });
  const manifest = await page.evaluate(async () => (await fetch(document.querySelector<HTMLLinkElement>('link[rel="manifest"]')!.href)).json());
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.some((icon: { purpose: string }) => icon.purpose === "maskable")).toBe(true);
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(event, { prompt: async () => { document.documentElement.dataset.installPromptCalled = "true"; }, userChoice: Promise.resolve({ outcome: "accepted" }) });
    window.dispatchEvent(event);
  });
  const banner = page.getByRole("complementary", { name: "Install Cadverix for offline use" });
  const bounds = (await banner.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
  await page.getByRole("button", { name: "Install now", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-install-prompt-called", "true");
});
