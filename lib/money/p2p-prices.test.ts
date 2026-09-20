import { describe, expect, it, vi } from "vitest";
import type { Prices } from "@p2pdotme/sdk/prices";
import { clearP2pRateCache, createP2pCountryOverride, p2pSupports, sellPriceToRate } from "./p2p-prices";

/** Stands in for the SDK's `Prices.getPriceConfig`, which resolves an `ok`/`err` Result. */
function stubPrices(sellPrice: bigint): Prices {
  const getPriceConfig = vi.fn(async () => ({
    isErr: () => false,
    value: { sellPrice, buyPrice: sellPrice, buyPriceOffset: 0n, baseSpread: 0n },
  }));
  return { getPriceConfig } as unknown as Prices;
}

describe("sellPriceToRate", () => {
  it("turns a 6-decimal fixed-point sell price into a fiat-per-USDC rate", () => {
    // 2946.5 COP per USDC, as read from the diamond contract on mainnet.
    expect(sellPriceToRate(2_946_500_000n)).toBe(2946.5);
  });

  it("is independent of the fiat's own display precision", () => {
    expect(sellPriceToRate(3_220_000n)).toBeCloseTo(3.22, 10);
  });
});

describe("p2pSupports", () => {
  it("covers USD as the quoting base and every currency p2p.me prices", () => {
    expect(p2pSupports("USD")).toBe(true);
    expect(p2pSupports("COP")).toBe(true);
    expect(p2pSupports("PEN")).toBe(true);
    expect(p2pSupports("VES")).toBe(true);
    expect(p2pSupports("BOB")).toBe(true);
    expect(p2pSupports("ARS")).toBe(true);
    expect(p2pSupports("BRL")).toBe(true);
  });

  it("does not cover currencies p2p.me does not quote", () => {
    expect(p2pSupports("MXN")).toBe(false);
  });
});

describe("createP2pCountryOverride", () => {
  it("quotes Ecuador's floating ECU sell price rather than the 1:1 USD identity", async () => {
    clearP2pRateCache();
    const prices = stubPrices(980_000n);
    const override = createP2pCountryOverride(prices);

    expect(await override("EC")).toBe(0.98);
  });

  it("returns null for a country p2p.me has no USD-ambiguous override for", async () => {
    clearP2pRateCache();
    const prices = stubPrices(980_000n);
    const override = createP2pCountryOverride(prices);

    expect(await override("US")).toBeNull();
    expect(await override("CO")).toBeNull();
  });
});
