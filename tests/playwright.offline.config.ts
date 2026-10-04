import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./offline",
  outputDir: "../test-results/offline",
  workers: 1,
  timeout: 120000,
  use: { baseURL: process.env.CADVERIX_OFFLINE_TEST_URL, viewport: { width: 1366, height: 1024 }, serviceWorkers: "allow", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }, { name: "webkit", use: { browserName: "webkit" } }],
});
