import { expect, it } from "vitest";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import path from "node:path";

type McpResult = { serverInfo?: { name: string }; tools?: { name: string }[]; content?: { text: string }[]; isError?: boolean };

it.each(["cadverix", "sketchforge"])("supports the %s MCP entry point and both tool namespaces", async (entry) => {
  const urls: string[] = [];
  const server = createServer((request, response) => {
    urls.push(request.url ?? "");
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ editors: [] }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test server port");
  const url = `http://127.0.0.1:${address.port}`;
  const child = spawn(process.execPath, [path.resolve(`scripts/${entry}-mcp-server.mjs`)], {
    env: { ...process.env, CADVERIX_URL: entry === "cadverix" ? url : undefined, SKETCHFORGE_URL: entry === "cadverix" ? "http://127.0.0.1:1" : url },
    stdio: ["pipe", "pipe", "pipe"],
  });
  let buffer = "", sequence = 0;
  const pending = new Map<number, (message: { result: McpResult }) => void>();
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop()!;
    for (const line of lines.filter(Boolean)) {
      const message = JSON.parse(line);
      pending.get(message.id)?.(message);
      pending.delete(message.id);
    }
  });
  const call = (method: string, params = {}) => new Promise<McpResult>((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`MCP request timed out: ${method}`)); }, 5_000);
    pending.set(id, (message) => { clearTimeout(timer); resolve(message.result); });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
  try {
    expect((await call("initialize")).serverInfo?.name).toBe("cadverix-mcp");
    const tools = (await call("tools/list")).tools!;
    expect(tools.length).toBeGreaterThan(10);
    expect(tools.every((tool) => tool.name.startsWith("cadverix_"))).toBe(true);
    for (const name of ["cadverix_list_editors", "sketchforge_list_editors"]) {
      const result = await call("tools/call", { name, arguments: {} });
      expect(result.isError).not.toBe(true);
      expect(JSON.parse(result.content![0]!.text)).toEqual({ editors: [] });
    }
    expect(urls).toEqual(["/api/cadverix-mcp", "/api/cadverix-mcp"]);
  } finally {
    child.kill();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
