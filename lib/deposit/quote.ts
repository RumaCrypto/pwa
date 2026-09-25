import type { CurrencyCode } from "@/lib/money/currencies";
import { currencyForCountry } from "@/lib/money/currencies";
import { convert, type Money } from "@/lib/money/money";

export interface DepositQuote {
  /** What the user pays, in their local currency. */
  local: Money;
  /** USDC the user receives, at p2p.me's buy price. */
  usdc: Money;
  /** 1 USDC = `rate` units of `local.currency`, locked in at order placement. */
  rate: number;
  country: string;
}

export function localCurrencyForCountry(country: string): CurrencyCode {
  return currencyForCountry(country) ?? "USD";
}

/** `rate` is local units per USDC, so converting `local` -> USDC divides by it. */
export function buildDepositQuote(local: Money, rate: number, country: string): DepositQuote {
  const usdc = convert(local, 1 / rate, "USD");

  return { local, usdc, rate, country };
}
