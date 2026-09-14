import { CURRENCY_CODES, type CurrencyCode } from "./currencies";
import type { RateProvider } from "./rates";

const ENDPOINT = "https://api.coingecko.com/api/v3/simple/price";

/**
 * USDC's price in each fiat currency, which is what the balance is denominated
 * in — so USD→BRL comes from the same source as the balance rather than a
 * separate FX feed that could disagree with it.
 */
const COIN_ID = "usd-coin";

/**
 * CoinGecko's `supported_vs_currencies` covers 62 fiats but omits COP and PEN,
 * both of which this app needs. Asking for them returns nothing rather than an
 * error, so the gap is declared here and reported instead of silently dropped.
 */
export const COINGECKO_CURRENCIES = new Set<CurrencyCode>(["USD", "BRL", "MXN", "ARS"]);

export function coingeckoSupports(currency: CurrencyCode): boolean {
  return COINGECKO_CURRENCIES.has(currency);
}

/** Rates move slowly enough that refetching per render is waste, not freshness. */
const TTL_MS = 60_000;

type Cache = { rates: Record<string, number>; fetchedAt: number };
let cache: Cache | null = null;

async function fetchRates(): Promise<Record<string, number>> {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) return cache.rates;

  const vs = CURRENCY_CODES.filter(coingeckoSupports)
    .map((code) => code.toLowerCase())
    .join(",");
  const key = process.env.NEXT_PUBLIC_COINGECKO_API_KEY;
  const url = `${ENDPOINT}?ids=${COIN_ID}&vs_currencies=${vs}`;

  const response = await fetch(key ? `${url}&x_cg_demo_api_key=${key}` : url, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`CoinGecko responded ${response.status}`);
  }

  const body = (await response.json()) as Record<string, Record<string, number>>;
  const rates = body[COIN_ID];
  if (!rates) {
    throw new Error("CoinGecko returned no prices for USDC");
  }

  cache = { rates, fetchedAt: Date.now() };
  return rates;
}

export const coingeckoRateProvider: RateProvider = {
  async getRate(from: CurrencyCode, to: CurrencyCode) {
    if (from === to) return 1;

    const unsupported = [from, to].filter((code) => !coingeckoSupports(code));
    if (unsupported.length > 0) {
      throw new Error(`CoinGecko does not quote ${unsupported.join(" or ")}`);
    }

    const rates = await fetchRates();
    const fromRate = rates[from.toLowerCase()];
    const toRate = rates[to.toLowerCase()];

    if (!fromRate || !toRate) {
      throw new Error(`CoinGecko returned no price for ${from} or ${to}`);
    }

    return toRate / fromRate;
  },
};

/** Exposed so tests and manual checks aren't served a warm cache. */
export function clearRateCache(): void {
  cache = null;
}
