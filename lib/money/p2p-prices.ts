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

/**
 * Countries whose payout currency this app shows as plain USD (`currencyOf`
 * maps them to "USD") but whose own p2p.me corridor still floats — Ecuador's
 * "ECU" sell price is currently ~0.98, not 1:1. `from === to === "USD"`
 * can't tell a US-dollar balance from an Ecuador payout apart, so this is
 * keyed by country and checked before currency-only routing ever runs.
 */
const SDK_CURRENCY_BY_COUNTRY: Partial<Record<string, SdkCurrencyCode>> = {
  EC: "ECU",
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
const cache = new Map<SdkCurrencyCode, { rate: number; fetchedAt: number }>();
const buyCache = new Map<SdkCurrencyCode, { rate: number; fetchedAt: number }>();

async function sellRateForSdkCode(prices: Prices, sdkCode: SdkCurrencyCode): Promise<number> {
  const cached = cache.get(sdkCode);
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached.rate;

  const result = await prices.getPriceConfig({ currency: sdkCode });
  if (result.isErr()) throw result.error;

  const rate = sellPriceToRate(result.value.sellPrice);
  cache.set(sdkCode, { rate, fetchedAt: Date.now() });
  return rate;
}

async function sellRateFor(prices: Prices, currency: CurrencyCode): Promise<number> {
  const sdkCode = SDK_CURRENCY[currency];
  if (!sdkCode) throw new Error(`p2p.me does not quote ${currency}`);
  return sellRateForSdkCode(prices, sdkCode);
}

/**
 * `buyPrice` is what a BUY order (adding money) actually settles at — usually
 * a little richer than `sellPrice`, the protocol's spread. Kept in its own
 * cache so a deposit quote never accidentally reuses a withdraw-side rate.
 */
async function buyRateForSdkCode(prices: Prices, sdkCode: SdkCurrencyCode): Promise<number> {
  const cached = buyCache.get(sdkCode);
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached.rate;

  const result = await prices.getPriceConfig({ currency: sdkCode });
  if (result.isErr()) throw result.error;

  const rate = sellPriceToRate(result.value.buyPrice);
  buyCache.set(sdkCode, { rate, fetchedAt: Date.now() });
  return rate;
}

async function buyRateFor(prices: Prices, currency: CurrencyCode): Promise<number> {
  const sdkCode = SDK_CURRENCY[currency];
  if (!sdkCode) throw new Error(`p2p.me does not quote ${currency}`);
  return buyRateForSdkCode(prices, sdkCode);
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

/**
 * Quotes USDC's p2p.me buy price against a currency — what an add-money
 * (deposit) order actually settles at. Mirrors `createP2pRateProvider`, but
 * reads `buyPrice` instead of `sellPrice`.
 */
export function createP2pBuyRateProvider(prices: Prices): RateProvider {
  return {
    async getRate(from, to) {
      if (from === to) return 1;
      if (from === "USD") return buyRateFor(prices, to);
      if (to === "USD") return 1 / (await buyRateFor(prices, from));
      throw new Error(`p2p.me only quotes against USD, not ${from} -> ${to}`);
    },
  };
}

/**
 * The p2p.me rate for a country whose currency code alone is ambiguous with
 * USD (see `SDK_CURRENCY_BY_COUNTRY`), or `null` for a country with no such
 * override — callers should fall through to ordinary currency-keyed routing.
 */
export function createP2pCountryOverride(prices: Prices) {
  return async function p2pCountryOverrideRate(country: string): Promise<number | null> {
    const sdkCode = SDK_CURRENCY_BY_COUNTRY[country];
    if (!sdkCode) return null;
    return sellRateForSdkCode(prices, sdkCode);
  };
}

/** Buy-side counterpart of `createP2pCountryOverride`, for deposit quotes. */
export function createP2pBuyCountryOverride(prices: Prices) {
  return async function p2pBuyCountryOverrideRate(country: string): Promise<number | null> {
    const sdkCode = SDK_CURRENCY_BY_COUNTRY[country];
    if (!sdkCode) return null;
    return buyRateForSdkCode(prices, sdkCode);
  };
}

const p2pPrices = createPrices({
  publicClient: baseClient,
  diamondAddress: DIAMOND_ADDRESS ?? "0x0000000000000000000000000000000000000000",
});

export const p2pRateProvider: RateProvider = createP2pRateProvider(p2pPrices);
export const p2pCountryOverrideRate = createP2pCountryOverride(p2pPrices);
export const p2pBuyRateProvider: RateProvider = createP2pBuyRateProvider(p2pPrices);
export const p2pBuyCountryOverrideRate = createP2pBuyCountryOverride(p2pPrices);

/** Exposed so tests and manual checks aren't served a warm cache. */
export function clearP2pRateCache(): void {
  cache.clear();
  buyCache.clear();
}
