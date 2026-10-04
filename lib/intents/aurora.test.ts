import { afterEach, describe, expect, it, vi } from "vitest";
import { auroraApiKey, auroraUrl } from "./aurora";

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
