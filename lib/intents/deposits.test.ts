import { describe, expect, it } from "vitest";
import { depositFromQuote, getDeposit, saveDeposit, updateDeposit, type DepositStorage } from "./deposits";
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
});
