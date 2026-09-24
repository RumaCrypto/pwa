import type { SupportedCurrency } from "@p2pdotme/sdk/qr-parsers";

import type { CurrencyCode } from "@/lib/money/currencies";
import { currencyForCountry } from "@/lib/money/currencies";
import { sdkCurrencyForCountry } from "@/lib/contacts/contacts";
import { add, convert, fromMinor, type Money } from "@/lib/money/money";

/** 1% — matches the fee shown in the original designs for a $20 QR payment. */
export const PAY_FEE_RATE = 0.01;

export interface PayQuote {
  /** What the business is asking for, in its local currency. */
  local: Money;
  /** USDC debited to cover it, before the fee — mirrors `send.total`'s role but in reverse. */
  usdc: Money;
  fee: Money;
  /** What actually leaves the balance: usdc plus fee. */
  total: Money;
  /** 1 USDC = `rate` units of `local.currency`, locked in at order placement. */
  rate: number;
  country: string;
}

function feeOn(amount: Money): Money {
  const cents = BigInt(Math.round(Number(amount.amount) * PAY_FEE_RATE));
  return fromMinor(cents, amount.currency);
}

export function localCurrencyForCountry(country: string): CurrencyCode {
  return currencyForCountry(country) ?? "USD";
}

/**
 * Every country this app lets a PAY order target supports it (none of
 * Colombia, Peru, Ecuador, Venezuela, Argentina, Bolivia, or Brazil disable
 * PAY), so this cast just narrows `sdkCurrencyForCountry`'s general
 * `CurrencyCode` result to the subset `parseQR` accepts.
 */
export function payCurrencyForCountry(country: string): SupportedCurrency {
  return sdkCurrencyForCountry(country) as SupportedCurrency;
}

/** `rate` is local units per USDC, so converting `local` -> USDC divides by it. */
export function buildPayQuote(local: Money, rate: number, country: string): PayQuote {
  const usdc = convert(local, 1 / rate, "USD");
  const fee = feeOn(usdc);

  return {
    local,
    usdc,
    fee,
    total: add(usdc, fee),
    rate,
    country,
  };
}
