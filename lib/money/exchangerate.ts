import type { CurrencyCode } from "./currencies";
import type { RateProvider } from "./rates";

/** Open access tier: no key, USD-based, refreshed once a day. */
const ENDPOINT = "https://open.er-api.com/v6/latest/USD";

const TTL_MS = 600_000;

type Cache = { rates: Record<string, number>; fetchedAt: number };
let cache: Cache | null = null;

async function fetchRates(): Promise<Record<string, number>> {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) return cache.rates;

  const response = await fetch(ENDPOINT, { headers: { accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`open.er-api responded ${response.status}`);
  }

  const body = (await response.json()) as { result?: string; rates?: Record<string, number> };
  if (body.result !== "success" || !body.rates) {
    throw new Error("open.er-api returned no rates");
  }

  cache = { rates: body.rates, fetchedAt: Date.now() };
  return body.rates;
}

/** Covers the fiats CoinGecko omits, COP and PEN among them. */
export const exchangeRateProvider: RateProvider = {
  async getRate(from: CurrencyCode, to: CurrencyCode) {
    if (from === to) return 1;

    const rates = await fetchRates();
    const fromRate = rates[from];
    const toRate = rates[to];

    if (!fromRate || !toRate) {
      throw new Error(`open.er-api has no rate for ${from} or ${to}`);
    }

    return toRate / fromRate;
  },
};

export function clearExchangeRateCache(): void {
  cache = null;
}
