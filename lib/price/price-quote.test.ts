import { describe, expect, it } from "vitest";
import { GOOD_BAND, goodRange, isGoodPrice } from "./price-quote";

describe("goodRange", () => {
  it("is 0.98–1 to buy and 1–1.02 to sell, for dollars", () => {
    expect(goodRange("buy", 1)).toEqual({ min: 1 - GOOD_BAND, max: 1 });
    expect(goodRange("sell", 1)).toEqual({ min: 1, max: 1 + GOOD_BAND });
  });

  it("scales with the market price of the local currency", () => {
    const buy = goodRange("buy", 4000);
    expect(buy.min).toBeCloseTo(3920);
    expect(buy.max).toBe(4000);
    const sell = goodRange("sell", 4000);
    expect(sell.min).toBe(4000);
    expect(sell.max).toBeCloseTo(4080);
  });
});

describe("isGoodPrice", () => {
  it("is good to buy at or under the market price", () => {
    expect(isGoodPrice("buy", 0.99, 1)).toBe(true);
    expect(isGoodPrice("buy", 1, 1)).toBe(true);
    expect(isGoodPrice("buy", 0.95, 1)).toBe(true);
    expect(isGoodPrice("buy", 1.01, 1)).toBe(false);
  });

  it("is good to sell at or over the market price", () => {
    expect(isGoodPrice("sell", 1.01, 1)).toBe(true);
    expect(isGoodPrice("sell", 1, 1)).toBe(true);
    expect(isGoodPrice("sell", 0.99, 1)).toBe(false);
  });
});
