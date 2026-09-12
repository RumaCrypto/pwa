import { add, fromNumber, type Money } from "@/lib/money/money";

export const ADD_METHODS = ["bank", "cash", "wallet"] as const;
export const OUT_METHODS = ["bank", "cash", "wallet"] as const;

export type CashflowMethod = (typeof ADD_METHODS)[number];

/** Flat cost of taking money out, per the designs. Adding money is free. */
export const WITHDRAW_FEE: Money = fromNumber(0.5, "USD");

/** Shown behind an "advanced" tag: it assumes the user already holds stablecoins. */
export function isAdvanced(method: CashflowMethod): boolean {
  return method === "wallet";
}

/**
 * Bank transfers route through p2p.me and cash through a Ruma point; neither is
 * connected yet. Moving stablecoins in or out of the wallet needs no provider,
 * so it is the one route that actually works today.
 */
export function isAvailable(method: CashflowMethod): boolean {
  return method === "wallet";
}

export function defaultMethod(methods: readonly CashflowMethod[]): CashflowMethod {
  return methods[0];
}

export function withdrawTotal(amount: Money): Money {
  return add(amount, WITHDRAW_FEE);
}
