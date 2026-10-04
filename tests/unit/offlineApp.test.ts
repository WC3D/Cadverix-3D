import { createHash } from "node:crypto";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { precachePaths, serviceWorkerSource } from "../../scripts/generate-service-worker.mjs";

const ORIGIN = "https://cadverix.example";
const assets = new Map([["/", "app shell"], ["/runtime.js", "runtime"], ["/occt/occt-wasm.wasm", "kernel"]]);
const entries = [...assets].map(([url, body]) => ({ url, integrity: `sha256-${createHash("sha256").update(body).digest("base64")}`, bytes: body.length }));
function worker(failingPath?: string) {
  const stores = new Map<string, Map<string, Response>>();
  const listeners: Record<string, (event: any) => void> = {};
  const key = (request: string | Request) => new URL(typeof request === "string" ? request : request.url, ORIGIN).pathname;
  const caches = {
    keys: async () => [...stores.keys()], delete: async (name: string) => stores.delete(name),
    open: async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name)!;
      return { match: async (request: string | Request) => store.get(key(request))?.clone(), put: async (request: string | Request, response: Response) => { store.set(key(request), response.clone()); }, delete: async (request: string | Request) => store.delete(key(request)), keys: async () => [...store.keys()].map((path) => new Request(`${ORIGIN}${path}`)) };
    },
  };
  const fetch = vi.fn(async (request: Request) => new Response(assets.get(key(request)) ?? "missing", { status: key(request) === failingPath ? 503 : 200 }));
  const skipWaiting = vi.fn(); const claim = vi.fn(); const postMessage = vi.fn();
  class RelativeRequest extends Request { constructor(input: string, init?: RequestInit) { super(new URL(input, ORIGIN), init); } }
  vm.runInNewContext(serviceWorkerSource("test-v1", entries), { self: { location: { origin: ORIGIN }, addEventListener: (type: string, listener: typeof listeners[string]) => { listeners[type] = listener; }, skipWaiting, clients: { claim, matchAll: async () => [{ postMessage }] } }, caches, fetch, Request: RelativeRequest, Response, URL });
  const dispatch = (type: string) => { let pending: Promise<unknown> = Promise.resolve(); listeners[type]({ waitUntil: (promise: Promise<unknown>) => { pending = promise; } }); return pending; };
  return { stores, listeners, fetch, skipWaiting, claim, postMessage, dispatch };
}

describe("offline application service worker", () => {
  it("retires only Cadverix app caches when switching to a server build", async () => {
    const deleted: string[] = [];
    const unregister = vi.fn(async () => true);
    let activate: (event: { waitUntil: (promise: Promise<void>) => void }) => void = () => {};
    vm.runInNewContext(await readFile("apps/web/public/sw.js", "utf8"), {
      self: { addEventListener: (_type: string, callback: typeof activate) => { activate = callback; }, registration: { unregister } },
      caches: { keys: async () => ["cadverix-offline-v1", "another-app"], delete: async (name: string) => { deleted.push(name); } },
    });
    let pending = Promise.resolve(); activate({ waitUntil: (promise) => { pending = promise; } }); await pending;
    expect(deleted).toEqual(["cadverix-offline-v1"]); expect(unregister).toHaveBeenCalledOnce();
  });
  it("includes lazy runtime assets but excludes server/configuration files", () => {
    expect(precachePaths(["index.html", "manifest.webmanifest", "occt/occt-wasm.wasm", "_next/static/worker.js", "api/shared-projects.json", "store.php", "_headers", "_redirects", "sw.js", "bundle.js.map", "404.html", "assets/a b.png"])).toEqual(["/", "/_next/static/worker.js", "/assets/a%20b.png", "/manifest.webmanifest", "/occt/occt-wasm.wasm"]);
  });
  it("verifies asset integrity and marks readiness only after a complete install", async () => {
    const runtime = worker(); await runtime.dispatch("install");
    expect(runtime.fetch).toHaveBeenCalledTimes(3);
    for (const [request] of runtime.fetch.mock.calls) expect(request.integrity).toBe(entries.find((entry) => new URL(request.url).pathname === entry.url)!.integrity);
    expect(runtime.stores.get("cadverix-offline-test-v1")?.has("/__cadverix_offline_ready__")).toBe(true);
    expect(runtime.skipWaiting).not.toHaveBeenCalled();
    await runtime.dispatch("activate"); expect(runtime.claim).toHaveBeenCalledOnce();
  });
  it("does not claim readiness or discard a previous version when a required asset fails", async () => {
    const runtime = worker("/occt/occt-wasm.wasm");
    runtime.stores.set("cadverix-offline-old", new Map([["/", new Response("old app")]]));
    await expect(runtime.dispatch("install")).rejects.toThrow("Offline asset unavailable");
    expect(runtime.stores.has("cadverix-offline-test-v1")).toBe(false);
    expect(runtime.stores.has("cadverix-offline-old")).toBe(true);
    expect(runtime.postMessage.mock.calls.some(([message]) => message.ready === true)).toBe(false);
  });
  it("serves project deep links from the app shell but never intercepts APIs, external hosts or writes", async () => {
    const runtime = worker(); await runtime.dispatch("install"); runtime.fetch.mockClear();
    let response: Promise<Response> | undefined;
    runtime.listeners.fetch({ request: { url: `${ORIGIN}/?project=local-id`, method: "GET", mode: "navigate" }, respondWith: (value: Promise<Response>) => { response = value; } });
    expect(await (await response!).text()).toBe("app shell");
    const respondWith = vi.fn();
    for (const request of [{ url: `${ORIGIN}/api/shared-projects`, method: "GET", mode: "navigate" }, { url: `${ORIGIN}/runtime.js`, method: "POST" }, { url: "https://other.example/runtime.js", method: "GET" }, { url: `${ORIGIN}/sw.js`, method: "GET" }]) runtime.listeners.fetch({ request, respondWith });
    expect(respondWith).not.toHaveBeenCalled(); expect(runtime.fetch).not.toHaveBeenCalled();
  });
});
