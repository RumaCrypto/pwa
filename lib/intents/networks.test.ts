import { describe, expect, it } from "vitest";
import { NETWORKS, assetsForNetwork, findNetwork, isNetworkId, isValidRefundAddress, type IntentsToken } from "./networks";

const token = (blockchain: string, symbol: string, assetId: string, decimals = 6): IntentsToken => ({
  assetId,
  blockchain,
  symbol,
  decimals,
  price: 1,
  contractAddress: null,
});

const TOKENS: IntentsToken[] = [
  token("eth", "ETH", "nep141:eth.omft.near", 18),
  token("eth", "USDT", "nep141:eth-0xdac17f958d2ee523a2206206994597c13d831ec7.omft.near"),
  token("eth", "USDC", "nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near"),
  token("eth", "PEPE", "nep141:eth-0x6982508145454ce325ddbe47a25d4ec3d2311933.omft.near", 18),
  token("tron", "USDT", "nep141:tron-d28a265909efecdcee7c5028585214ea0b96f015.omft.near"),
  token("tron", "TRX", "nep141:tron.omft.near"),
  token("near", "wNEAR", "nep141:wrap.near", 24),
  token("near", "BTC", "nep141:nbtc.bridge.near", 8),
  token("btc", "BTC", "nep141:btc.omft.near", 8),
];

describe("network catalogue", () => {
  it("offers the networks from the spec, without Base, which has its own option", () => {
    expect(NETWORKS.map((n) => n.id)).toEqual(["eth", "arb", "op", "tron", "btc", "near"]);
  });

  it("recognises only catalogued network ids", () => {
    expect(isNetworkId("tron")).toBe(true);
    expect(isNetworkId("base")).toBe(false);
    expect(isNetworkId("../etc")).toBe(false);
  });

  it("finds a network by id", () => {
    expect(findNetwork("btc").name).toBe("Bitcoin");
  });
});

describe("assetsForNetwork", () => {
  it("keeps only the allowed assets of that network, stablecoins first", () => {
    expect(assetsForNetwork(TOKENS, "eth").map((a) => a.symbol)).toEqual(["USDC", "USDT", "ETH"]);
  });

  it("drops tokens from other chains", () => {
    expect(assetsForNetwork(TOKENS, "tron").map((a) => a.symbol)).toEqual(["USDT", "TRX"]);
  });

  it("shows wrapped NEAR as NEAR and ignores bridged BTC on NEAR", () => {
    expect(assetsForNetwork(TOKENS, "near")).toEqual([
      { assetId: "nep141:wrap.near", symbol: "NEAR", decimals: 24, priceUsd: 1 },
    ]);
  });

  it("returns nothing when the API lists no asset for the network", () => {
    expect(assetsForNetwork(TOKENS, "op")).toEqual([]);
  });
});

describe("isValidRefundAddress", () => {
  it("accepts each network's own address format", () => {
    expect(isValidRefundAddress("eth", "0x5aeda56215b167893e80b4fe645ba6d5bab767de")).toBe(true);
    expect(isValidRefundAddress("arb", "0x5aeda56215b167893e80b4fe645ba6d5bab767de")).toBe(true);
    expect(isValidRefundAddress("tron", "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t")).toBe(true);
    expect(isValidRefundAddress("btc", "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq")).toBe(true);
    expect(isValidRefundAddress("btc", "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa")).toBe(true);
    expect(isValidRefundAddress("near", "alice.near")).toBe(true);
    expect(isValidRefundAddress("near", "a".repeat(64))).toBe(true);
  });

  it("rejects an address from another network, where a refund would be lost", () => {
    expect(isValidRefundAddress("tron", "0x5aeda56215b167893e80b4fe645ba6d5bab767de")).toBe(false);
    expect(isValidRefundAddress("eth", "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t")).toBe(false);
    expect(isValidRefundAddress("btc", "alice.near")).toBe(false);
    expect(isValidRefundAddress("near", "Alice.NEAR")).toBe(false);
    expect(isValidRefundAddress("eth", "  ")).toBe(false);
  });
});
