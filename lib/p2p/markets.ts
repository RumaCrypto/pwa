import type { CurrencyCode } from "@/lib/money/currencies";

/**
 * p2p.me's `CurrencyCode` is a market identifier, not an ISO currency: `ECU` is
 * Ecuador, which settles in dollars, and `MEX` and `VEN` are Mexico and
 * Venezuela under non-ISO spellings. Feeding these straight into
 * `Intl.NumberFormat` would break formatting, so the two vocabularies are kept
 * apart and translated here.
 */
export const P2P_MARKETS = [
  "IDR",
  "INR",
  "BRL",
  "ARS",
  "MEX",
  "VEN",
  "BOB",
  "EUR",
  "NGN",
  "USD",
  "COP",
  "CUP",
  "ECU",
  "PEN",
  "PHP",
  "KES",
] as const;

export type P2pMarket = (typeof P2P_MARKETS)[number];

/** One market per country, mirroring the SDK's COUNTRY_OPTIONS. */
const MARKET_BY_COUNTRY: Record<string, P2pMarket> = {
  AR: "ARS",
  BO: "BOB",
  BR: "BRL",
  CO: "COP",
  CU: "CUP",
  EC: "ECU",
  ID: "IDR",
  IN: "INR",
  KE: "KES",
  MX: "MEX",
  NG: "NGN",
  PE: "PEN",
  PH: "PHP",
  US: "USD",
  VE: "VEN",
};

/** Markets whose code is not the ISO currency they settle in. */
const ISO_BY_MARKET: Partial<Record<P2pMarket, CurrencyCode>> = {
  MEX: "MXN",
  ECU: "USD",
};

export function marketForCountry(country: string): P2pMarket | null {
  return MARKET_BY_COUNTRY[country.toUpperCase()] ?? null;
}

/** The ISO currency a market settles in, for formatting and conversion. */
export function isoCurrencyForMarket(market: P2pMarket): string {
  return ISO_BY_MARKET[market] ?? market;
}

export function isSupportedCountry(country: string): boolean {
  return marketForCountry(country) !== null;
}
