import { describe, expect, it } from "vitest";
import { STAGES, isTerminal, progressFor, stageFor, stageState, type Order } from "./orders";
import { buildDepositQuote } from "./quote";
import { fromNumber } from "@/lib/money/money";

const START = new Date("2026-09-12T12:00:00Z");

const base: Order = {
  id: "42",
  quote: buildDepositQuote(fromNumber(1080, "BRL"), 5.4, "BR"),
  createdAt: START,
  p2pOrderId: 42n,
  placeTxHash: "0xabc",
  phase: "awaiting_merchant",
};

describe("stageFor", () => {
  it("sits at placed while no seller has accepted", () => {
    expect(stageFor(base)).toBe("placed");
  });

  it("moves to matched once a seller is seen, even before the address is decrypted", () => {
    expect(stageFor({ ...base, acceptedMerchant: "0xmerchant" })).toBe("matched");
  });

  it("moves to paying once the user has confirmed they sent the fiat", () => {
    expect(stageFor({ ...base, phase: "awaiting_completion", acceptedMerchant: "0xmerchant" })).toBe("paying");
  });

  it("reaches received only once completed", () => {
    expect(stageFor({ ...base, phase: "completed", acceptedMerchant: "0xmerchant" })).toBe("received");
  });

  it("freezes a failed order at whatever stage it last reached", () => {
    expect(stageFor({ ...base, phase: "failed", failureReason: "cancelled" })).toBe("placed");
    expect(
      stageFor({ ...base, phase: "failed", failureReason: "error", acceptedMerchant: "0xmerchant" })
    ).toBe("matched");
  });
});

describe("stageState", () => {
  it("marks earlier stages done, the current one current, the rest pending", () => {
    const order: Order = { ...base, phase: "awaiting_completion", acceptedMerchant: "0xmerchant" };
    expect(STAGES.map((stage) => stageState(stage, order))).toEqual(["done", "done", "current", "pending"]);
  });

  it("marks every stage done once completed", () => {
    const order: Order = { ...base, phase: "completed", acceptedMerchant: "0xmerchant" };
    expect(STAGES.map((stage) => stageState(stage, order))).toEqual(["done", "done", "done", "done"]);
  });
});

describe("progressFor", () => {
  it("runs from a visible sliver to full across the real stages", () => {
    expect(progressFor(base)).toBeCloseTo(0.25, 10);
    expect(progressFor({ ...base, phase: "completed", acceptedMerchant: "0xmerchant" })).toBe(1);
  });
});

describe("isTerminal", () => {
  it("is false while an order is still moving", () => {
    expect(isTerminal(base)).toBe(false);
    expect(isTerminal({ ...base, phase: "awaiting_payment" })).toBe(false);
    expect(isTerminal({ ...base, phase: "awaiting_completion" })).toBe(false);
  });

  it("is true once completed or failed", () => {
    expect(isTerminal({ ...base, phase: "completed" })).toBe(true);
    expect(isTerminal({ ...base, phase: "failed", failureReason: "cancelled" })).toBe(true);
  });
});
