import { expect, test } from "@playwright/test";
import { chooseModifyTool } from "./helpers/modifyTools";

test.use({ isMobile: false, hasTouch: false, viewport: { width: 1440, height: 1000 } });

test("edits selection dimensions, changes theme and opens modifier sections", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && /WebGL|uncaught|hydration|passive event listener/i.test(message.text())) errors.push(message.text());
  });
  page.on("requestfailed", (request) => {
    if (["script", "stylesheet"].includes(request.resourceType()) && !request.failure()?.errorText.includes("ABORTED")) errors.push(`${request.url()}: ${request.failure()?.errorText}`);
  });
  await page.goto("/?editor=1");
  await page.getByRole("button", { name: "Add shape", exact: true }).click();
  await page.getByRole("button", { name: "Box", exact: true }).click();
  for (const axis of ["width", "depth", "height"]) {
    await expect(page.getByRole("button", { name: `${axis} dimension`, exact: true })).toBeVisible();
  }
  await page.getByRole("button", { name: "width dimension", exact: true }).click();
  const input = page.locator("input.dimension-input");
  await input.fill("30.4");
  await input.press("Enter");
  await expect.poll(async () => JSON.parse(await page.locator("[data-codex-state]").textContent() ?? "{}").shapes[0].width).toBe(30.4);
  await page.getByRole("button", { name: "height dimension", exact: true }).click();
  await input.fill("999");
  await input.press("Escape");
  await expect(page.getByRole("button", { name: "height dimension", exact: true })).not.toHaveText("999");
  for (const axis of ["X", "Y", "Z"]) await expect(page.getByRole("button", { name: `Rotate ${axis}`, exact: true })).toBeVisible();

  await page.getByRole("combobox", { name: "Quick theme", exact: true }).selectOption("light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("combobox", { name: "Quick theme", exact: true }).selectOption("sketchforge");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  for (const label of ["Documentation", "Knowledge base", "Keyboard shortcuts", "Support"]) {
    await expect(page.getByRole("link", { name: `${label} (opens in new tab)`, exact: true })).toHaveAttribute("target", "_blank");
  }
  for (const [label, section] of [["3D pattern / array", "pattern"], ["Face tools / rotation pivot", "faces"], ["Face hole pattern", "holes"], ["Shell / hollow", "shell"]]) {
    await chooseModifyTool(page, label);
    await expect(page.locator(`[data-modeling-section="${section}"]`)).toBeInViewport();
    await expect(page.locator(".modeling-tools > fieldset")).toHaveCount(1);
    await expect(page.locator(".modeling-tools input[aria-label='Reusable shape name']")).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test("keeps quick access reachable on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?editor=1");
  const theme = page.getByRole("combobox", { name: "Quick theme", exact: true });
  await theme.selectOption("inventor");
  await expect(theme).toHaveValue("inventor");
  const support = page.getByRole("link", { name: "Support (opens in new tab)", exact: true });
  await support.scrollIntoViewIfNeeded();
  await expect(support).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("modeling chooser keeps inspection and reusable shapes in separate panels", async ({ page }) => {
  await page.goto("/?editor=1");
  await chooseModifyTool(page, "Modeling tools");
  const chooser = page.getByRole("navigation", { name: "Choose modeling tool", exact: true });
  await expect(chooser.getByRole("button")).toHaveCount(6);
  await expect(page.locator(".modeling-tools fieldset")).toHaveCount(0);
  await chooser.getByRole("button", { name: "Inspect / print", exact: true }).click();
  const inspect = page.getByRole("complementary", { name: "Inspect / print", exact: true });
  await expect(inspect.getByLabel("Section view", { exact: true })).toBeVisible();
  await expect(inspect.getByLabel("Shell thickness", { exact: true })).toHaveCount(0);
  await inspect.getByRole("button", { name: "All modeling tools", exact: true }).click();
  await chooser.getByRole("button", { name: "Reusable shapes", exact: true }).click();
  const library = page.getByRole("complementary", { name: "Reusable shapes", exact: true });
  await expect(library.getByLabel("Reusable shape name", { exact: true })).toBeVisible();
  await expect(library.getByLabel("Section view", { exact: true })).toHaveCount(0);
});
