import type { CurrencyCode } from "./currencies";
import type { RateProvider } from "./rates";

/**
 * Routes each pair to the provider that can quote it. CoinGecko covers most of
 * the catalogue but omits COP and PEN, so those pairs go to the fiat feed
 * instead of failing.
 */
export function routeByCoverage(
  preferred: RateProvider,
  fallback: RateProvider,
  covers: (currency: CurrencyCode) => boolean
): RateProvider {
  return {
    async getRate(from, to) {
      if (from === to) return 1;
      const provider = covers(from) && covers(to) ? preferred : fallback;
      return provider.getRate(from, to);
    },
  };
}
