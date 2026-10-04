import { describe, expect, it } from "vitest";
import {
  EXPIRY_GRACE_MS,
  depositFromQuote,
  getDeposit,
  isExpired,
  saveDeposit,
  updateDeposit,
  type DepositStorage,
} from "./deposits";
import type { QuoteResult } from "./quote";

function memoryStorage(): DepositStorage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
}

const QUOTE: QuoteResult = {
  depositAddress: "TXyz",
  amountInFormatted: "25",
  minAmountIn: "24750000",
  amountOutFormatted: "24.9",
  minAmountOut: "24651000",
  deadline: "2026-10-04T13:00:00.000Z",
  timeEstimate: 120,
};
const NOW = new Date("2026-10-04T12:00:00Z");

describe("depositFromQuote", () => {
  it("starts waiting for the user's transfer", () => {
    expect(depositFromQuote(QUOTE, "tron", "USDT", NOW)).toEqual({
      depositAddress: "TXyz",
      depositMemo: undefined,
      network: "tron",
      assetSymbol: "USDT",
      amountInFormatted: "25",
      amountOutFormatted: "24.9",
      createdAt: NOW,
      deadline: new Date("2026-10-04T13:00:00.000Z"),
      phase: "awaiting_deposit",
    });
  });
});

describe("deposit storage", () => {
  it("round-trips a deposit, dates included, after a reload", () => {
    const storage = memoryStorage();
    const deposit = depositFromQuote(QUOTE, "tron", "USDT", NOW);
    saveDeposit(storage, deposit);

    expect(getDeposit(storage, "TXyz")).toEqual(deposit);
  });

  it("returns undefined for an address it never saw", () => {
    expect(getDeposit(memoryStorage(), "nope")).toBeUndefined();
  });

  it("merges a patch and persists it", () => {
    const storage = memoryStorage();
    saveDeposit(storage, depositFromQuote(QUOTE, "tron", "USDT", NOW));
    const done = new Date("2026-10-04T12:04:00Z");

    const updated = updateDeposit(storage, "TXyz", { phase: "completed", receivedFormatted: "24.91", completedAt: done });

    expect(updated).toMatchObject({ phase: "completed", receivedFormatted: "24.91", completedAt: done });
    expect(getDeposit(storage, "TXyz")).toEqual(updated);
  });

  it("survives corrupt storage instead of crashing the screen", () => {
    const storage = memoryStorage();
    storage.setItem("ruma-intent-deposits", "{not json");
    expect(getDeposit(storage, "TXyz")).toBeUndefined();
  });

  it("survives valid JSON that is not an object (null, array, string, etc.)", () => {
    const storage = memoryStorage();
    storage.setItem("ruma-intent-deposits", "null");
    expect(getDeposit(storage, "TXyz")).toBeUndefined();
  });

  it("can save a deposit after storage held non-object JSON", () => {
    const storage = memoryStorage();
    storage.setItem("ruma-intent-deposits", "null");
    const deposit = depositFromQuote(QUOTE, "tron", "USDT", NOW);
    saveDeposit(storage, deposit);
    expect(getDeposit(storage, "TXyz")).toEqual(deposit);
  });
});

describe("isExpired", () => {
  const deposit = depositFromQuote(QUOTE, "tron", "USDT", NOW);
  const deadline = deposit.deadline.getTime();

  it("keeps the address active until the deadline plus a grace period", () => {
    expect(isExpired(deposit, NOW)).toBe(false);
    expect(isExpired(deposit, new Date(deadline + EXPIRY_GRACE_MS))).toBe(false);
  });

  it("expires a waiting or incomplete deposit once the grace period is over", () => {
    const after = new Date(deadline + EXPIRY_GRACE_MS + 1);
    expect(isExpired(deposit, after)).toBe(true);
    expect(isExpired({ ...deposit, phase: "incomplete" }, after)).toBe(true);
  });

  it("never expires a deposit that already arrived or ended", () => {
    const after = new Date(deadline + EXPIRY_GRACE_MS + 1);
    for (const phase of ["processing", "completed", "refunded", "failed"] as const) {
      expect(isExpired({ ...deposit, phase }, after)).toBe(false);
    }
  });

  it("gives a two-minute grace so a transfer sent just before the deadline is still tracked", () => {
    expect(EXPIRY_GRACE_MS).toBe(2 * 60 * 1000);
  });
});
