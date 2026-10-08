import { afterEach, describe, expect, it, vi } from "vitest";
import { auroraApiKey, auroraUrl, fetchAuroraTokens } from "./aurora";

describe("auroraUrl", () => {
  it("puts the key in the path, as Aurora expects, and encodes it", () => {
    expect(auroraUrl("quote", "k/1")).toBe("https://intents-api.aurora.dev/api/quote/k%2F1");
  });

  it("adds query parameters", () => {
    expect(auroraUrl("status", "k", { depositAddress: "TX yz" })).toBe(
      "https://intents-api.aurora.dev/api/status/k?depositAddress=TX+yz"
    );
  });
});

describe("auroraApiKey", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("reads the server-only key and treats empty as missing", () => {
    vi.stubEnv("AURORA_INTENTS_API_KEY", "abc");
    expect(auroraApiKey()).toBe("abc");
    vi.stubEnv("AURORA_INTENTS_API_KEY", "");
    expect(auroraApiKey()).toBeNull();
  });
});

describe("auroraUrl for deposit submissions", () => {
  it("puts the key after the two-part path", () => {
    expect(auroraUrl("deposit/submit", "k")).toBe("https://intents-api.aurora.dev/api/deposit/submit/k");
  });
});

describe("fetchAuroraTokens", () => {
  it("unwraps Aurora's real { asset_stats, tokens } envelope", async () => {
    const fetchImpl = async () => new Response(JSON.stringify({ asset_stats: [], tokens: [{ assetId: "a" }] }), { status: 200 });
    expect(await fetchAuroraTokens("k", fetchImpl as never)).toEqual([{ assetId: "a" }]);
  });

  it("returns the token list", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify([{ assetId: "a" }]), { status: 200 }));
    expect(await fetchAuroraTokens("k", fetchImpl as never)).toEqual([{ assetId: "a" }]);
  });

  it("throws on an error status or a body that is not a list", async () => {
    await expect(fetchAuroraTokens("k", (async () => new Response("{}", { status: 500 })) as never)).rejects.toThrow();
    await expect(fetchAuroraTokens("k", (async () => new Response("{}", { status: 200 })) as never)).rejects.toThrow();
  });
});
