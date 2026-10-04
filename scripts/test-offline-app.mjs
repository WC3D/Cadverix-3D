import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const repository = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const root = path.join(repository, "apps/web/.next-export");
await stat(path.join(root, "sw.js")).catch(() => { throw new Error("Run npm run export before testing the offline app"); });
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".wasm": "application/wasm", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png", ".txt": "text/plain" };
let update = 0, failKernel = false, disconnected = false;
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://localhost");
    if (request.method === "POST" && url.pathname === "/__pwa-test/reset") { update = 0; failKernel = false; disconnected = false; response.end("ok"); return; }
    if (request.method === "POST" && url.pathname === "/__pwa-test/disconnect") { disconnected = true; response.end("ok"); return; }
    if (request.method === "POST" && url.pathname === "/__pwa-test/update") { update++; response.end("ok"); return; }
    if (request.method === "POST" && url.pathname === "/__pwa-test/fail-kernel") { failKernel = url.searchParams.get("enabled") === "1"; response.end("ok"); return; }
    if (disconnected) { request.socket.destroy(); return; }
    if (failKernel && url.pathname === "/occt/occt-wasm.wasm") { response.writeHead(503); response.end("Simulated failed offline download"); return; }
    let file = path.resolve(root, `.${decodeURIComponent(url.pathname)}`);
    if (file !== root && !file.startsWith(root + path.sep)) throw new Error("Invalid path");
    if ((await stat(file)).isDirectory()) file = path.join(file, "index.html");
    let bytes = await readFile(file);
    if (url.pathname === "/sw.js" && update) bytes = Buffer.from(bytes.toString().replace(/const VERSION = "[^"]+";/, `const VERSION = "test-update-${update}";`));
    response.writeHead(200, { "Content-Type": mime[path.extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store" });
    response.end(bytes);
  } catch { response.writeHead(404); response.end("Not found"); }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const baseURL = `http://127.0.0.1:${server.address().port}`;
console.log(`Offline app test server: ${baseURL}`);
try {
  const child = spawn(process.execPath, ["node_modules/@playwright/test/cli.js", "test", "--config", "tests/playwright.offline.config.ts", ...process.argv.slice(2)], { cwd: repository, stdio: "inherit", env: { ...process.env, CADVERIX_OFFLINE_TEST_URL: baseURL } });
  process.exitCode = await new Promise((resolve, reject) => { child.once("error", reject); child.once("exit", (code) => resolve(code ?? 1)); });
} finally {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
