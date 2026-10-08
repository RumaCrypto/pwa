import { describe, expect, it } from "vitest";
import { NETWORKS, assetsForNetwork, findNetwork, isNetworkId, withdrawAssetsForNetwork, allWithdrawAssets, tokenList, type IntentsToken } from "./networks";

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
  token("arb", "USDC", "nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near"),
  token("tron", "USDT", "nep141:tron-d28a265909efecdcee7c5028585214ea0b96f015.omft.near"),
  token("tron", "USDC", "nep141:tron-usdc.omft.near"),
  token("tron", "TRX", "nep141:tron.omft.near"),
  token("near", "wNEAR", "nep141:wrap.near", 24),
  token("near", "USDC", "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1"),
  token("near", "BTC", "nep141:nbtc.bridge.near", 8),
  token("btc", "BTC", "nep141:btc.omft.near", 8),
];

describe("network catalogue", () => {
  it("offers the networks from the spec, without Base, which has its own option", () => {
    expect(NETWORKS.map((n) => n.id)).toEqual(["eth", "arb", "tron", "btc", "near"]);
  });

  it("doesn't offer Optimism, which Aurora won't quote, so a link to it 404s", () => {
    expect(isNetworkId("op")).toBe(false);
  });

  it("still names Optimism, so a stored record from it renders instead of crashing", () => {
    expect(findNetwork("op")).toEqual({ id: "op", name: "Optimism", logo: "/networks/op.svg" });
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
      { assetId: "nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1", symbol: "USDC", decimals: 6, priceUsd: 1 },
      { assetId: "nep141:wrap.near", symbol: "NEAR", decimals: 24, priceUsd: 1 },
    ]);
  });

  it("returns nothing when the API lists no asset for the network", () => {
    expect(assetsForNetwork(TOKENS, "op")).toEqual([]);
  });
});

describe("withdrawAssetsForNetwork", () => {
  it("offers only stablecoins on EVM chains, in USDC, USDT order, tagged with the network", () => {
    expect(withdrawAssetsForNetwork(TOKENS, "eth").map((a) => [a.symbol, a.network])).toEqual([
      ["USDC", "eth"],
      ["USDT", "eth"],
    ]);
  });

  it("offers only USDT on Tron and only BTC on Bitcoin", () => {
    expect(withdrawAssetsForNetwork(TOKENS, "tron").map((a) => a.symbol)).toEqual(["USDT"]);
    expect(withdrawAssetsForNetwork(TOKENS, "btc").map((a) => a.symbol)).toEqual(["BTC"]);
  });

  it("skips what Aurora does not list and never offers native coins", () => {
    expect(withdrawAssetsForNetwork(TOKENS, "near").map((a) => a.symbol)).toEqual(["USDC"]);
    expect(withdrawAssetsForNetwork(TOKENS, "arb").map((a) => a.symbol)).toEqual(["USDC"]);
  });
});

describe("allWithdrawAssets", () => {
  it("lists every network's withdrawal assets once", () => {
    const ids = allWithdrawAssets(TOKENS).map((a) => a.assetId);
    expect(ids).toContain("nep141:btc.omft.near");
    expect(ids).not.toContain("nep141:eth.omft.near");
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("tokenList", () => {
  const TOKEN = { assetId: "a" };

  it("accepts Aurora's envelope and a bare array", () => {
    expect(tokenList({ asset_stats: [], tokens: [TOKEN] })).toEqual([TOKEN]);
    expect(tokenList([TOKEN])).toEqual([TOKEN]);
  });

  it("returns null when there is no list", () => {
    expect(tokenList({ asset_stats: [] })).toBeNull();
    expect(tokenList(null)).toBeNull();
    expect(tokenList("x")).toBeNull();
  });
});
