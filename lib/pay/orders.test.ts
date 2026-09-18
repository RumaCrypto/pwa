import { describe, expect, it } from "vitest";
import { STAGES, isTerminal, progressFor, stageFor, stageState, type Order } from "./orders";
import { buildPayQuote } from "./quote";
import { fromNumber } from "@/lib/money/money";

const START = new Date("2026-09-12T12:00:00Z");

const base: Order = {
  id: "42",
  quote: buildPayQuote(fromNumber(108, "BRL"), 5.4, "BR"),
  createdAt: START,
  p2pOrderId: 42n,
  placeTxHash: "0xabc",
  phase: "awaiting_merchant",
};

describe("stageFor", () => {
  it("sits at funded while no merchant has accepted", () => {
    expect(stageFor(base)).toBe("funded");
  });

  it("moves to matched once a merchant is seen, even before the QR is scanned", () => {
    expect(stageFor({ ...base, acceptedMerchant: "0xmerchant" })).toBe("matched");
  });

  it("stays matched while waiting on the user to scan the QR", () => {
    expect(stageFor({ ...base, phase: "awaiting_scan", acceptedMerchant: "0xmerchant" })).toBe("matched");
  });

  it("moves to paying once the payment address is on its way", () => {
    expect(stageFor({ ...base, phase: "awaiting_completion", acceptedMerchant: "0xmerchant" })).toBe("paying");
  });

  it("settles once the order completes", () => {
    expect(stageFor({ ...base, phase: "completed", acceptedMerchant: "0xmerchant" })).toBe("settled");
  });
});

describe("stageState", () => {
  it("marks earlier stages done and later ones pending relative to the current stage", () => {
    const order: Order = { ...base, phase: "awaiting_completion", acceptedMerchant: "0xmerchant" };
    expect(stageState("funded", order)).toBe("done");
    expect(stageState("matched", order)).toBe("done");
    expect(stageState("paying", order)).toBe("current");
    expect(stageState("settled", order)).toBe("pending");
  });
});

describe("progressFor", () => {
  it("fills one step per stage", () => {
    expect(progressFor(base)).toBe(1 / STAGES.length);
    expect(progressFor({ ...base, phase: "completed", acceptedMerchant: "0xmerchant" })).toBe(1);
  });
});

describe("isTerminal", () => {
  it("is true only once completed or failed", () => {
    expect(isTerminal(base)).toBe(false);
    expect(isTerminal({ ...base, phase: "completed" })).toBe(true);
    expect(isTerminal({ ...base, phase: "failed", failureReason: "timeout" })).toBe(true);
  });
});
