import { add, fromNumber, type Money } from "@/lib/money/money";
import { FLAGS, type Flags } from "@/lib/flags";

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
 * Bank transfers route through p2p.me, the same protocol behind send and pay.
 * Cash routes through a Ruma point, which does not exist yet. Moving
 * stablecoins in or out of the wallet needs no provider either.
 */
export function isAvailable(method: CashflowMethod): boolean {
  return method === "wallet" || method === "bank";
}

/** Drops routes whose flag is off, so nothing unreachable is ever offered. */
export function enabledMethods(
  methods: readonly CashflowMethod[],
  flags: Flags = FLAGS
): CashflowMethod[] {
  return methods.filter((method) => method !== "cash" || flags.cashPoints);
}

export function defaultMethod(
  methods: readonly CashflowMethod[],
  flags: Flags = FLAGS
): CashflowMethod {
  return enabledMethods(methods, flags)[0];
}

export function withdrawTotal(amount: Money): Money {
  return add(amount, WITHDRAW_FEE);
}
