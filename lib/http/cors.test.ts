import { afterEach, describe, expect, it, vi } from "vitest";
import { cors, corsHeaders, preflight, withCors } from "./cors";

afterEach(() => vi.unstubAllEnvs());

describe("corsHeaders", () => {
  it.each(["capacitor://localhost", "https://localhost", "http://localhost:5173"])("allows the native app origin %s", (origin) => {
    expect(corsHeaders(origin)["Access-Control-Allow-Origin"]).toBe(origin);
  });

  it("allows nothing for an unknown origin", () => {
    expect(corsHeaders("https://evil.com")["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(corsHeaders(null)["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("lets the app send its Privy token and JSON bodies", () => {
    const headers = corsHeaders("https://localhost");
    expect(headers["Access-Control-Allow-Headers"]).toBe("Authorization, Content-Type");
    expect(headers["Access-Control-Allow-Methods"]).toBe("GET, POST, OPTIONS");
  });

  it("always varies on Origin so caches never serve one origin's answer to another", () => {
    expect(corsHeaders("https://evil.com").Vary).toBe("Origin");
    expect(corsHeaders("https://localhost").Vary).toBe("Origin");
  });

  it("accepts extra origins from CORS_EXTRA_ORIGINS", () => {
    vi.stubEnv("CORS_EXTRA_ORIGINS", "https://staging.ruma.app, https://preview.ruma.app");
    expect(corsHeaders("https://preview.ruma.app")["Access-Control-Allow-Origin"]).toBe("https://preview.ruma.app");
  });
});

describe("preflight", () => {
  it("answers 204 with the CORS headers", () => {
    const response = preflight(new Request("https://x", { method: "OPTIONS", headers: { Origin: "https://localhost" } }));
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://localhost");
  });
});

describe("withCors", () => {
  it("adds the headers to the route's response and keeps its status and body", async () => {
    const request = new Request("https://x", { headers: { Origin: "capacitor://localhost" } });
    const response = withCors(request, new Response(JSON.stringify({ ok: true }), { status: 201, headers: { "Content-Type": "application/json" } }));
    expect(response.status).toBe(201);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("capacitor://localhost");
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(await response.json()).toEqual({ ok: true });
  });
});

describe("cors", () => {
  it("decorates every response the handler returns, including early refusals", async () => {
    const handler = cors(async () => new Response("nope", { status: 401 }));
    const response = await handler(new Request("https://x", { headers: { Origin: "https://localhost" } }));
    expect(response.status).toBe(401);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://localhost");
  });
});
