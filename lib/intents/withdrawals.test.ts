import { describe, expect, it } from "vitest";
import {
  findActiveWithdrawal,
  getWithdrawal,
  isWithdrawalSettled,
  saveWithdrawal,
  updateWithdrawal,
  withdrawalFromQuote,
  withdrawalPhaseFor,
  type IntentWithdrawal,
} from "./withdrawals";
import type { WithdrawAsset } from "./networks";
import type { WithdrawQuote } from "./quote";

function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

const ASSET: WithdrawAsset = { assetId: "a", symbol: "USDT", decimals: 6, priceUsd: 1, network: "tron", contractAddress: null };
const QUOTE: WithdrawQuote = {
  depositAddress: "0x9f3a00000000000000000000000000000000c21e",
  amountIn: "50000000",
  amountInFormatted: "50.0",
  amountOut: "49820000",
  amountOutFormatted: "49.82",
  minAmountOut: "49321800",
  timeEstimate: 60,
  deadline: "2026-10-04T12:30:00.000Z",
};
const NOW = new Date("2026-10-04T12:00:00Z");

describe("withdrawalFromQuote", () => {
  it("starts before the transfer, with the minimum formatted in the destination asset", () => {
    expect(withdrawalFromQuote(QUOTE, ASSET, "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", NOW)).toEqual({
      depositAddress: QUOTE.depositAddress,
      network: "tron",
      assetSymbol: "USDT",
      recipient: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
      amountInFormatted: "50.0",
      amountOutFormatted: "49.82",
      minAmountOutFormatted: "49.3218",
      createdAt: NOW,
      deadline: new Date(QUOTE.deadline),
      phase: "awaiting_transfer",
    });
  });
});

describe("withdrawal storage", () => {
  it("round-trips dates and applies patches", () => {
    const storage = memoryStorage();
    const withdrawal = withdrawalFromQuote(QUOTE, ASSET, "T…", NOW);
    saveWithdrawal(storage, withdrawal);
    expect(getWithdrawal(storage, QUOTE.depositAddress)).toEqual(withdrawal);
    expect(updateWithdrawal(storage, QUOTE.depositAddress, { phase: "processing" })?.phase).toBe("processing");
    expect(getWithdrawal(storage, "missing")).toBeUndefined();
  });

  it("survives garbage in storage", () => {
    const storage = memoryStorage();
    storage.setItem("ruma-intent-withdrawals", "[1,2]");
    expect(getWithdrawal(storage, "x")).toBeUndefined();
  });
});

describe("findActiveWithdrawal", () => {
  const at = (phase: IntentWithdrawal["phase"], minutesAgo: number) => ({
    ...withdrawalFromQuote({ ...QUOTE, depositAddress: `0x${phase.padEnd(40, "0").slice(0, 40)}` }, ASSET, "T…", new Date(NOW.getTime() - minutesAgo * 60_000)),
    phase,
  });

  it("finds a recent withdrawal still in flight, so a second tap does not start another", () => {
    const storage = memoryStorage();
    saveWithdrawal(storage, at("processing", 10));
    expect(findActiveWithdrawal(storage, NOW)?.phase).toBe("processing");
  });

  it("finds a 5-minute-old awaiting_transfer (crash mid-signature case)", () => {
    const storage = memoryStorage();
    saveWithdrawal(storage, at("awaiting_transfer", 5));
    expect(findActiveWithdrawal(storage, NOW)?.phase).toBe("awaiting_transfer");
  });

  it("ignores a withdrawal exactly 30 minutes old (window is < 30 min)", () => {
    const storage = memoryStorage();
    saveWithdrawal(storage, at("awaiting_transfer", 30));
    expect(findActiveWithdrawal(storage, NOW)).toBeUndefined();
  });

  it("ignores settled, failed-to-send and old ones", () => {
    const storage = memoryStorage();
    saveWithdrawal(storage, at("completed", 1));
    saveWithdrawal(storage, at("transfer_failed", 1));
    saveWithdrawal(storage, at("awaiting_transfer", 31));
    expect(findActiveWithdrawal(storage, NOW)).toBeUndefined();
  });

  it("skips null and non-object entries in storage", () => {
    const storage = memoryStorage();
    const all = {
      "0x0000000000000000000000000000000000000001": null,
      "0x0000000000000000000000000000000000000002": { ...withdrawalFromQuote(QUOTE, ASSET, "T…", new Date(NOW.getTime() - 5 * 60_000)), phase: "awaiting_transfer" as const },
    };
    storage.setItem("ruma-intent-withdrawals", JSON.stringify(all));
    expect(findActiveWithdrawal(storage, NOW)?.phase).toBe("awaiting_transfer");
  });
});

describe("withdrawalPhaseFor", () => {
  it("does not claim the transfer was sent just because Aurora is still waiting", () => {
    expect(withdrawalPhaseFor("awaiting_transfer", "PENDING_DEPOSIT")).toBe("awaiting_transfer");
  });

  it("follows Aurora once it has seen the deposit", () => {
    expect(withdrawalPhaseFor("awaiting_transfer", "PROCESSING")).toBe("processing");
    expect(withdrawalPhaseFor("awaiting_deposit", "PENDING_DEPOSIT")).toBe("awaiting_deposit");
    expect(withdrawalPhaseFor("processing", "SUCCESS")).toBe("completed");
    expect(withdrawalPhaseFor("processing", "REFUNDED")).toBe("refunded");
  });

  it("treats transfer_failed as final regardless of Aurora status", () => {
    expect(withdrawalPhaseFor("transfer_failed", "PENDING_DEPOSIT")).toBe("transfer_failed");
    expect(withdrawalPhaseFor("transfer_failed", "PROCESSING")).toBe("transfer_failed");
  });
});

describe("isWithdrawalSettled", () => {
  it("is settled when Aurora is done or nothing was sent", () => {
    expect(["completed", "refunded", "failed", "transfer_failed"].every((p) => isWithdrawalSettled(p as never))).toBe(true);
    expect(["awaiting_transfer", "awaiting_deposit", "processing"].some((p) => isWithdrawalSettled(p as never))).toBe(false);
  });
});
