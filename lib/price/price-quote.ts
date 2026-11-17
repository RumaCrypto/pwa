/**
 * Whether USDC's buy/sell price is a good deal right now, measured against
 * the market price of USDC in the same fiat. Prices are local units per USDC.
 *
 * Adding money (buy) is good when it costs at most the market price and no
 * more than 2% under it; taking money out (sell) is good when it pays at
 * least the market price, up to 2% over it. For dollars that is 0.98–1 to
 * buy and 1–1.02 to sell.
 */
export type PriceSide = "buy" | "sell";

export const GOOD_BAND = 0.02;

export interface PriceRange {
  min: number;
  max: number;
}

export function goodRange(side: PriceSide, market: number): PriceRange {
  return side === "buy"
    ? { min: market * (1 - GOOD_BAND), max: market }
    : { min: market, max: market * (1 + GOOD_BAND) };
}

/** A price beyond the band in the user's favour still counts as good. */
export function isGoodPrice(side: PriceSide, price: number, market: number): boolean {
  return side === "buy" ? price <= market : price >= market;
}
