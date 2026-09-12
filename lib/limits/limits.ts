import { fromNumber, type Money } from "@/lib/money/money";

export interface Limits {
  level: number;
  maxLevel: number;
  perSend: Money;
  perDay: Money;
  sendsPerDay: number;
}

/**
 * In memory until the verification flows exist. The level is what drives the
 * home banner and the whole "raise your limit" screen.
 */
export function currentLimits(): Limits {
  return {
    level: 1,
    maxLevel: 4,
    perSend: fromNumber(100, "USD"),
    perDay: fromNumber(1000, "USD"),
    sendsPerDay: 10,
  };
}
