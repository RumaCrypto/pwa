import { describe, expect, it, vi } from "vitest";
import { checkWithdrawRequest } from "./withdraw-check";
import { buildWithdrawQuoteRequest } from "./quote";
import type { IntentsToken, WithdrawAsset } from "./networks";

const NOW = new Date("2026-10-04T12:00:00Z");
const OWNER = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" as const;
const TOKENS: IntentsToken[] = [
  { assetId: "nep141:tron-usdt", blockchain: "tron", symbol: "USDT", decimals: 6, price: 1, contractAddress: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t" },
  { assetId: "nep141:eth-usdc", blockchain: "eth", symbol: "USDC", decimals: 6, price: 1, contractAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" },
  { assetId: "nep141:near-usdc", blockchain: "near", symbol: "USDC", decimals: 6, price: 1, contractAddress: null },
];
const asset = (assetId: string) => ({ assetId, symbol: "X", decimals: 6, priceUsd: 1, network: "eth", contractAddress: null }) as WithdrawAsset;
const body = (destinationAsset: string, recipient: string, dry = false) =>
  buildWithdrawQuoteRequest({ asset: asset(destinationAsset), amount: 1_000_000n, recipient, refundTo: OWNER, dry, now: NOW });

const deps = (overrides: Partial<Parameters<typeof checkWithdrawRequest>[1]> = {}) => ({
  userId: "did:privy:1",
  dry: false,
  tokens: async () => TOKENS,
  ownsWallet: vi.fn(async () => true),
  nearAccountExists: vi.fn(async () => true),
  now: NOW,
  ...overrides,
});

describe("checkWithdrawRequest", () => {
  it("lets a well-formed withdrawal refunded to the caller's own wallet through", async () => {
    const result = await checkWithdrawRequest(body("nep141:eth-usdc", "0x000000000000000000000000000000000000dEaD"), deps());
    expect(result).toMatchObject({ ok: true, request: { destinationAsset: "nep141:eth-usdc" } });
  });

  it("always needs a signed-in caller (S1)", async () => {
    expect(await checkWithdrawRequest(body("nep141:eth-usdc", "0x000000000000000000000000000000000000dEaD"), deps({ userId: null }))).toEqual({
      ok: false,
      status: 401,
      error: "Sign in required",
    });
  });

  it("only takes the dry value its route expects", async () => {
    const result = await checkWithdrawRequest(body("nep141:eth-usdc", "0x000000000000000000000000000000000000dEaD", true), deps());
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it("refuses refunds to a wallet the caller does not own", async () => {
    const result = await checkWithdrawRequest(
      body("nep141:eth-usdc", "0x000000000000000000000000000000000000dEaD"),
      deps({ ownsWallet: vi.fn(async () => false) })
    );
    expect(result).toMatchObject({ ok: false, status: 403 });
  });

  it("refuses sending to the caller's own refund wallet or to a token contract", async () => {
    expect(await checkWithdrawRequest(body("nep141:eth-usdc", OWNER), deps())).toMatchObject({ ok: false, status: 422 });
    expect(await checkWithdrawRequest(body("nep141:eth-usdc", "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"), deps())).toMatchObject({
      ok: false,
      status: 422,
    });
    expect(await checkWithdrawRequest(body("nep141:tron-usdt", "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"), deps())).toMatchObject({
      ok: false,
      status: 422,
    });
  });

  it("refuses a named NEAR account that does not exist", async () => {
    const result = await checkWithdrawRequest(body("nep141:near-usdc", "ghost.near"), deps({ nearAccountExists: vi.fn(async () => false) }));
    expect(result).toMatchObject({ ok: false, status: 422 });
  });

  it("refuses anything outside the allow-list", async () => {
    expect(await checkWithdrawRequest(body("nep141:eth.omft.near", "0x000000000000000000000000000000000000dEaD"), deps())).toMatchObject({
      ok: false,
      status: 400,
    });
  });
});
