import { afterEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/sketchforge-mcp/route";

const originalEnvironment = {
  nodeEnv: process.env.NODE_ENV,
  desktop: process.env.CADVERIX_DESKTOP,
  token: process.env.CADVERIX_MCP_TOKEN,
};

afterEach(() => {
  process.env.NODE_ENV = originalEnvironment.nodeEnv;
  process.env.CADVERIX_DESKTOP = originalEnvironment.desktop;
  process.env.CADVERIX_MCP_TOKEN = originalEnvironment.token;
});

describe("packaged desktop MCP route", () => {
  it("requires the per-launch bearer token in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.CADVERIX_DESKTOP = "1";
    process.env.CADVERIX_MCP_TOKEN = "test-desktop-capability";

    const unauthorized = await GET(new Request("http://127.0.0.1:62158/api/cadverix-mcp"));
    expect(unauthorized.status).toBe(401);

    const authorized = await GET(new Request("http://127.0.0.1:62158/api/cadverix-mcp", {
      headers: { Authorization: "Bearer test-desktop-capability" },
    }));
    expect(authorized.status).toBe(200);
  });

  it("rejects non-local origins even when they know the token", async () => {
    process.env.NODE_ENV = "production";
    process.env.CADVERIX_DESKTOP = "1";
    process.env.CADVERIX_MCP_TOKEN = "test-desktop-capability";

    const response = await GET(new Request("http://127.0.0.1:62158/api/cadverix-mcp", {
      headers: {
        Authorization: "Bearer test-desktop-capability",
        Origin: "https://attacker.example",
      },
    }));
    expect(response.status).toBe(403);
  });
});
