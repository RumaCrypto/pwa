import { CURRENCIES, type CurrencyCode } from "./currencies";

/**
 * An amount in a currency's minor units (cents), so that sums and conversions
 * never accumulate IEEE 754 error the way `200 + 1.2 === 201.20000000000002`
 * does. Convert to `number` only at the display boundary, via `toNumber`.
 */
export type Money = { amount: bigint; currency: CurrencyCode };

const RATE_SCALE = 1_000_000_000n;

function pow10(n: number): bigint {
  return 10n ** BigInt(n);
}

/** Divides, rounding half away from zero — what people expect of money. */
function divRound(numerator: bigint, denominator: bigint): bigint {
  const sign = numerator < 0n !== denominator < 0n ? -1n : 1n;
  const a = numerator < 0n ? -numerator : numerator;
  const b = denominator < 0n ? -denominator : denominator;
  return sign * ((a * 2n + b) / (b * 2n));
}

export function fromMinor(amount: bigint, currency: CurrencyCode): Money {
  return { amount, currency };
}

export function fromNumber(value: number, currency: CurrencyCode): Money {
  return fromDecimalString(value.toFixed(CURRENCIES[currency].decimals), currency);
}

/** Parses a plain decimal string, such as what viem's `formatUnits` returns. */
export function fromDecimalString(value: string, currency: CurrencyCode): Money {
  const { decimals } = CURRENCIES[currency];
  const match = /^(-?)(\d*)(?:\.(\d*))?$/.exec(value.trim());
  if (!match) throw new Error(`Not a decimal string: ${value}`);

  const [, sign, whole, fraction = ""] = match;
  const padded = fraction.padEnd(decimals + 1, "0");
  const kept = BigInt((whole || "0") + padded.slice(0, decimals));
  const next = BigInt(padded[decimals]);
  const rounded = next >= 5n ? kept + 1n : kept;

  return { amount: sign === "-" ? -rounded : rounded, currency };
}

export function toNumber(money: Money): number {
  return Number(money.amount) / 10 ** CURRENCIES[money.currency].decimals;
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(`Cannot combine ${a.currency} with ${b.currency}`);
  }
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amount: a.amount + b.amount, currency: a.currency };
}

export function sub(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { amount: a.amount - b.amount, currency: a.currency };
}

export function convert(money: Money, rate: number, to: CurrencyCode): Money {
  const scaledRate = BigInt(Math.round(rate * Number(RATE_SCALE)));
  const fromDecimals = CURRENCIES[money.currency].decimals;
  const toDecimals = CURRENCIES[to].decimals;

  return {
    amount: divRound(money.amount * scaledRate * pow10(toDecimals), RATE_SCALE * pow10(fromDecimals)),
    currency: to,
  };
}
