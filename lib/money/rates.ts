"use client";

import { useEffect, useState } from "react";
import { CURRENCY_CODES, type CurrencyCode } from "./currencies";
import { coingeckoRateProvider, coingeckoSupports } from "./coingecko";
import { exchangeRateProvider } from "./exchangerate";
import { routeByCoverage } from "./compose-rates";

export interface RateProvider {
  getRate(from: CurrencyCode, to: CurrencyCode): Promise<number>;
}

/** Units of each currency per 1 USD. */
const USD_RATES: Record<CurrencyCode, number> = {
  USD: 1,
  BRL: 5.4,
  COP: 3950,
  MXN: 17.2,
  ARS: 1035,
  PEN: 3.75,
};

export const mockRateProvider: RateProvider = {
  async getRate(from, to) {
    // A real provider is a network call; the delay keeps consumers honest about
    // rendering their loading state.
    await new Promise((resolve) => setTimeout(resolve, 120));
    return USD_RATES[to] / USD_RATES[from];
  },
};

export type RateState = { rate: number | null; loading: boolean; error: Error | null };

/**
 * CoinGecko quotes USDC directly, so it is preferred; COP and PEN, which it does
 * not carry, are routed to the fiat feed. Neither needs a key. A failure surfaces
 * through `useRate` and callers keep showing the USD amount, rather than
 * substituting a rate that would be quietly wrong.
 */
export const defaultRateProvider: RateProvider = routeByCoverage(
  coingeckoRateProvider,
  exchangeRateProvider,
  coingeckoSupports
);

export function useRate(
  from: CurrencyCode,
  to: CurrencyCode,
  provider: RateProvider = defaultRateProvider
): RateState {
  const [state, setState] = useState<RateState>({ rate: null, loading: true, error: null });

  useEffect(() => {
    let active = true;
    setState({ rate: null, loading: true, error: null });

    provider.getRate(from, to).then(
      (rate) => active && setState({ rate, loading: false, error: null }),
      (error: Error) => active && setState({ rate: null, loading: false, error })
    );

    return () => {
      active = false;
    };
  }, [from, to, provider]);

  return state;
}

export { CURRENCY_CODES };
