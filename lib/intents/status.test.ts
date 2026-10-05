import { describe, expect, it } from "vitest";
import { isPlausibleDepositAddress, isTerminal, parseStatusResponse, phaseFor } from "./status";

describe("phaseFor", () => {
  it("maps every Aurora status to a phase the screen knows how to show", () => {
    expect(phaseFor("PENDING_DEPOSIT")).toBe("awaiting_deposit");
    expect(phaseFor("INCOMPLETE_DEPOSIT")).toBe("incomplete");
    expect(phaseFor("KNOWN_DEPOSIT_TX")).toBe("processing");
    expect(phaseFor("PROCESSING")).toBe("processing");
    expect(phaseFor("SUCCESS")).toBe("completed");
    expect(phaseFor("REFUNDED")).toBe("refunded");
    expect(phaseFor("FAILED")).toBe("failed");
  });
});

describe("isTerminal", () => {
  it("stops polling only once the money has landed or gone back", () => {
    expect(isTerminal("completed")).toBe(true);
    expect(isTerminal("refunded")).toBe(true);
    expect(isTerminal("failed")).toBe(true);
    expect(isTerminal("awaiting_deposit")).toBe(false);
    expect(isTerminal("incomplete")).toBe(false);
    expect(isTerminal("processing")).toBe(false);
  });
});

describe("parseStatusResponse", () => {
  it("reads the status and, once settled, what arrived and its Base transaction", () => {
    expect(
      parseStatusResponse({
        status: "SUCCESS",
        updatedAt: "2026-10-04T12:05:00Z",
        swapDetails: {
          amountOutFormatted: "24.91",
          destinationChainTxHashes: [{ hash: "0xbase", explorerUrl: "https://basescan.org/tx/0xbase" }],
        },
      })
    ).toEqual({ status: "SUCCESS", receivedFormatted: "24.91", destinationTxHash: "0xbase" });
  });

  it("accepts the bare shape Aurora returns before anything is deposited", () => {
    expect(parseStatusResponse({ status: "PENDING_DEPOSIT" })).toEqual({ status: "PENDING_DEPOSIT" });
  });

  it("rejects an unknown status instead of guessing", () => {
    expect(() => parseStatusResponse({ status: "WAT" })).toThrow(/status/);
  });
});

describe("isPlausibleDepositAddress", () => {
  it("accepts addresses of every supported chain and refuses junk", () => {
    expect(isPlausibleDepositAddress("0x9f3a00000000000000000000000000000000c21e")).toBe(true);
    expect(isPlausibleDepositAddress("bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4")).toBe(true);
    expect(isPlausibleDepositAddress("a".repeat(64))).toBe(true);
    expect(isPlausibleDepositAddress("short")).toBe(false);
    expect(isPlausibleDepositAddress("x/../../admin?y=1")).toBe(false);
  });
});
