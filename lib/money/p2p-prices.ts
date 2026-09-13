import { createPrices, type Prices } from "@p2pdotme/sdk/prices";
import type { CurrencyCode as SdkCurrencyCode } from "@p2pdotme/sdk/country";

import { baseClient } from "@/lib/viem";
import type { CurrencyCode } from "./currencies";
import type { RateProvider } from "./rates";

const DIAMOND_ADDRESS = process.env.NEXT_PUBLIC_DIAMOND_ADDRESS as `0x${string}` | undefined;

/** Local currency codes p2p.me quotes a sell price for, keyed to the SDK's own id. */
const SDK_CURRENCY: Partial<Record<CurrencyCode, SdkCurrencyCode>> = {
  COP: "COP",
  ARS: "ARS",
  BRL: "BRL",
  PEN: "PEN",
  VES: "VEN",
  BOB: "BOB",
};

export function p2pSupports(currency: CurrencyCode): boolean {
  return currency === "USD" || currency in SDK_CURRENCY;
}

/** `sellPrice` is always fixed-point at 6 decimals, regardless of the fiat's own precision. */
const SELL_PRICE_DECIMALS = 6;

export function sellPriceToRate(sellPrice: bigint): number {
  return Number(sellPrice) / 10 ** SELL_PRICE_DECIMALS;
}

/** Rates track the protocol's on-chain config, not by the second. */
const TTL_MS = 60_000;
const cache = new Map<CurrencyCode, { rate: number; fetchedAt: number }>();

async function sellRateFor(prices: Prices, currency: CurrencyCode): Promise<number> {
  const cached = cache.get(currency);
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached.rate;

  const sdkCode = SDK_CURRENCY[currency];
  if (!sdkCode) throw new Error(`p2p.me does not quote ${currency}`);

  const result = await prices.getPriceConfig({ currency: sdkCode });
  if (result.isErr()) throw result.error;

  const rate = sellPriceToRate(result.value.sellPrice);
  cache.set(currency, { rate, fetchedAt: Date.now() });
  return rate;
}

/**
 * Quotes USDC's p2p.me sell price against a currency — the same rate a
 * withdraw pays out at, so a contact's estimate matches what they would get
 * cashing out directly. Only quotes against USD/USDC; anything else falls
 * through to the caller's fallback provider.
 */
export function createP2pRateProvider(prices: Prices): RateProvider {
  return {
    async getRate(from, to) {
      if (from === to) return 1;
      if (from === "USD") return sellRateFor(prices, to);
      if (to === "USD") return 1 / (await sellRateFor(prices, from));
      throw new Error(`p2p.me only quotes against USD, not ${from} -> ${to}`);
    },
  };
}

const p2pPrices = createPrices({
  publicClient: baseClient,
  diamondAddress: DIAMOND_ADDRESS ?? "0x0000000000000000000000000000000000000000",
});

export const p2pRateProvider: RateProvider = createP2pRateProvider(p2pPrices);

/** Exposed so tests and manual checks aren't served a warm cache. */
export function clearP2pRateCache(): void {
  cache.clear();
}
