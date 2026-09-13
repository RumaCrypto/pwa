import { describe, expect, it } from "vitest";
import { p2pSupports, sellPriceToRate } from "./p2p-prices";

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
