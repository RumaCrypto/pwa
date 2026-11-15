"use client";

import { useResidency } from "@/lib/settings/residency-context";
import { useRate } from "@/lib/money/rates";
import { routeByCoverage } from "@/lib/money/compose-rates";
import { coingeckoRateProvider, coingeckoSupports } from "@/lib/money/coingecko";
import { exchangeRateProvider } from "@/lib/money/exchangerate";
import { localCurrencyForCountry } from "@/lib/deposit/quote";
import type { CurrencyCode } from "@/lib/money/currencies";
import {
  p2pBuyCountryOverrideRate,
  p2pBuyRateProvider,
  p2pCountryOverrideRate,
  p2pQuotesCountry,
  p2pRateProvider,
} from "@/lib/money/p2p-prices";
import { goodRange, isGoodPrice, type PriceRange, type PriceSide } from "./price-quote";

/** USDC's market price, independent of Ruma's own: CoinGecko, or the fiat feed where it has no quote. */
const marketRateProvider = routeByCoverage(coingeckoRateProvider, exchangeRateProvider, coingeckoSupports);

export interface PriceQuote {
  currency: CurrencyCode;
  /** Local units per USDC that adding (buy) or taking out (sell) money settles at. */
  price: number;
  market: number;
  range: PriceRange;
  good: boolean;
}

/**
 * The buy or sell price of USDC in the user's country of residence, judged
 * against the market. `supported` is false where Ruma has no local-currency
 * corridor, and `quote` stays null while loading or if either read fails.
 */
export function usePriceQuote(side: PriceSide) {
  const { country } = useResidency();
  const currency = country ? localCurrencyForCountry(country) : "USD";
  const supported = country !== null && p2pQuotesCountry(country, currency);

  // Unsupported countries ask for USD→USD with no country, which resolves to 1 without a fetch.
  const target = supported ? currency : "USD";
  const price = useRate(
    "USD",
    target,
    supported ? country : undefined,
    side === "buy" ? p2pBuyRateProvider : p2pRateProvider,
    side === "buy" ? p2pBuyCountryOverrideRate : p2pCountryOverrideRate
  );
  const market = useRate("USD", target, undefined, marketRateProvider);

  const quote: PriceQuote | null =
    supported && price.rate !== null && market.rate !== null
      ? {
          currency,
          price: price.rate,
          market: market.rate,
          range: goodRange(side, market.rate),
          good: isGoodPrice(side, price.rate, market.rate),
        }
      : null;

  return {
    supported,
    quote,
    loading: supported && (price.loading || market.loading),
    error: price.error ?? market.error,
  };
}
