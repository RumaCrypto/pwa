import { describe, expect, it, vi } from "vitest";
import { createMemoryLimiter, guardRequest, readGuardConfig, redisCredentials, type GuardConfig } from "./guard";

describe("readGuardConfig", () => {
  it("requires a session and limits to 30 per minute by default", () => {
    expect(readGuardConfig({})).toEqual({ authRequired: true, rateLimit: { limit: 30, windowMs: 60_000 } });
  });

  it("reads both settings from env", () => {
    expect(readGuardConfig({ INTENTS_AUTH_REQUIRED: "false", INTENTS_RATE_LIMIT: "30/10" })).toEqual({
      authRequired: false,
      rateLimit: { limit: 30, windowMs: 10_000 },
    });
  });

  it("turns the limit off with 'off' and falls back to the default on garbage", () => {
    expect(readGuardConfig({ INTENTS_RATE_LIMIT: "off" }).rateLimit).toBeNull();
    expect(readGuardConfig({ INTENTS_RATE_LIMIT: "lots" }).rateLimit).toEqual({ limit: 30, windowMs: 60_000 });
  });
});

describe("readGuardConfig in production", () => {
  it("never drops the session check in production, whatever the env says", () => {
    expect(readGuardConfig({ INTENTS_AUTH_REQUIRED: "false", VERCEL_ENV: "production" }).authRequired).toBe(true);
    expect(readGuardConfig({ INTENTS_AUTH_REQUIRED: "false", VERCEL_ENV: "preview" }).authRequired).toBe(false);
  });
});

describe("readGuardConfig zero values", () => {
  it("falls back to the default on a zero limit or window", () => {
    for (const raw of ["5/0", "0/60", "0/0"]) {
      expect(readGuardConfig({ INTENTS_RATE_LIMIT: raw }).rateLimit).toEqual({ limit: 30, windowMs: 60_000 });
    }
  });
});

describe("createMemoryLimiter", () => {
  it("allows up to the limit per key within the window, then resets", () => {
    let t = 0;
    const allow = createMemoryLimiter(2, 1000, () => t);
    expect([allow("a"), allow("a"), allow("a"), allow("b")]).toEqual([true, true, false, true]);
    t = 1001;
    expect(allow("a")).toBe(true);
  });
});

const req = (headers: Record<string, string> = {}) => new Request("http://x/api/intents/tokens", { headers });
const verify = vi.fn(async (token: string) => {
  if (token !== "good") throw new Error("bad token");
  return { userId: "did:privy:1" };
});
const on: GuardConfig = { authRequired: true, rateLimit: null };

describe("guardRequest", () => {
  it("rejects a missing or invalid session with 401", async () => {
    expect(((await guardRequest(req(), { config: on, verify, limiter: null })) as Response).status).toBe(401);
    const bad = req({ Authorization: "Bearer nope" });
    expect(((await guardRequest(bad, { config: on, verify, limiter: null })) as Response).status).toBe(401);
  });

  it("lets a valid session through, keyed by user", async () => {
    const ok = await guardRequest(req({ Authorization: "Bearer good" }), { config: on, verify, limiter: null });
    expect(ok).toEqual({ userId: "did:privy:1", key: "did:privy:1" });
  });

  it("skips the session check when auth is off, keying by IP", async () => {
    const off: GuardConfig = { authRequired: false, rateLimit: null };
    const ok = await guardRequest(req({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }), { config: off, verify, limiter: null });
    expect(ok).toEqual({ userId: null, key: "ip:1.2.3.4" });
  });

  it("answers 429 once the caller is over the limit", async () => {
    const limiter = vi.fn(() => false);
    const res = await guardRequest(req({ Authorization: "Bearer good" }), { config: on, verify, limiter });
    expect((res as Response).status).toBe(429);
    expect(limiter).toHaveBeenCalledWith("did:privy:1");
  });
});

describe("redisCredentials", () => {
  it("reads the Upstash names", () => {
    expect(redisCredentials({ UPSTASH_REDIS_REST_URL: "https://u", UPSTASH_REDIS_REST_TOKEN: "t" })).toEqual({
      url: "https://u",
      token: "t",
    });
  });

  it("falls back to the names Vercel KV sets", () => {
    expect(redisCredentials({ KV_REST_API_URL: "https://kv", KV_REST_API_TOKEN: "k" })).toEqual({
      url: "https://kv",
      token: "k",
    });
  });

  it("returns null unless both a URL and a token are set", () => {
    expect(redisCredentials({})).toBeNull();
    expect(redisCredentials({ UPSTASH_REDIS_REST_URL: "https://u" })).toBeNull();
    expect(redisCredentials({ KV_REST_API_TOKEN: "k" })).toBeNull();
  });
});
