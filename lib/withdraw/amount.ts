import { CURRENCIES } from "@/lib/money/currencies";
import { add, fromMinor, type Money } from "@/lib/money/money";
import { feeOn } from "@/lib/send/quote";

/**
 * The USDC balance in cents, truncated. fromDecimalString rounds half up, which
 * would turn 9.995 USDC into $10.00 and offer more than is there.
 */
export function balanceToMoney(balance: string): Money {
  const [whole, fraction = ""] = balance.trim().split(".");
  const cents = BigInt((whole || "0") + fraction.padEnd(2, "0").slice(0, 2));
  return fromMinor(cents, "USD");
}

/** Whether a send and its fee, together, fit in the balance. */
export function fitsBalance(send: Money, balance: Money): boolean {
  return add(send, feeOn(send)).amount <= balance.amount;
}

/**
 * The largest send whose total (send plus the 0.6% fee) still fits. Starts from
 * balance / 1.006 and steps a cent either way, since the fee rounds to cents.
 */
export function maxSend(balance: Money): Money {
  if (balance.amount <= 0n) return fromMinor(0n, balance.currency);
  let cents = (balance.amount * 1000n) / 1006n;
  const fits = (c: bigint) => fitsBalance(fromMinor(c, balance.currency), balance);
  while (fits(cents + 1n)) cents += 1n;
  while (cents > 0n && !fits(cents)) cents -= 1n;
  return fromMinor(cents, balance.currency);
}

/** A share of the max send, rounded down to the cent so it always fits too. */
export function shareOfMax(balance: Money, percent: number): Money {
  const max = maxSend(balance);
  return fromMinor((max.amount * BigInt(percent)) / 100n, balance.currency);
}

/** Money as the keypad's draft: "." separator, no trailing zeros ("12.5", "25"). */
export function toDraft(money: Money): string {
  const decimals = CURRENCIES[money.currency].decimals;
  const padded = money.amount.toString().padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals);
  const fraction = padded.slice(-decimals).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}
