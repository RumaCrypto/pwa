import type { CurrencyCode } from "@/lib/money/currencies";
import { add, convert, fromMinor, type Money } from "@/lib/money/money";

/** 0.6% — $1.20 on the $200 send shown in the designs. */
export const FEE_RATE = 0.006;

/** The designs promise the recipient a fixed amount for fifteen minutes. */
export const LOCK_MS = 15 * 60_000;

export interface Quote {
  send: Money;
  fee: Money;
  /** What leaves the balance: send plus fee. */
  total: Money;
  rate: number;
  /** What the recipient gets, in their currency. */
  receive: Money;
  lockedAt: Date;
  expiresAt: Date;
}

function feeOn(amount: Money): Money {
  const cents = BigInt(Math.round(Number(amount.amount) * FEE_RATE));
  return fromMinor(cents, amount.currency);
}

export function buildQuote(
  send: Money,
  rate: number,
  to: CurrencyCode,
  at: Date = new Date()
): Quote {
  const fee = feeOn(send);

  return {
    send,
    fee,
    total: add(send, fee),
    rate,
    // Converted from the send amount, not the total: the fee is ours, not theirs.
    receive: convert(send, rate, to),
    lockedAt: at,
    expiresAt: new Date(at.getTime() + LOCK_MS),
  };
}

export function isExpired(quote: Quote, now: Date = new Date()): boolean {
  return now.getTime() >= quote.expiresAt.getTime();
}

export function secondsLeft(quote: Quote, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((quote.expiresAt.getTime() - now.getTime()) / 1000));
}
