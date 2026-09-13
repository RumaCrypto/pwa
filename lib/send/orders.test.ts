import { describe, expect, it } from "vitest";
import { STAGES, isTerminal, progressFor, stageFor, stageState, type Order } from "./orders";
import { buildQuote } from "./quote";
import { fromNumber } from "@/lib/money/money";

const START = new Date("2026-09-12T12:00:00Z");

const base: Order = {
  id: "RM-000001",
  contactId: "rosa",
  quote: buildQuote(fromNumber(200, "USD"), 5.4, "BRL", START),
  createdAt: START,
  p2pOrderId: 42n,
  placeTxHash: "0xabc",
  phase: "awaiting_merchant",
};

describe("stageFor", () => {
  it("sits at funded while no merchant has accepted", () => {
    expect(stageFor(base)).toBe("funded");
  });

  it("moves to converted once a merchant is seen, even before payout details are sent", () => {
    expect(stageFor({ ...base, acceptedMerchant: "0xmerchant" })).toBe("converted");
  });

  it("moves to paying once payout details are on their way", () => {
    expect(stageFor({ ...base, phase: "awaiting_completion", acceptedMerchant: "0xmerchant" })).toBe("paying");
  });

  it("reaches delivered only once completed", () => {
    expect(stageFor({ ...base, phase: "completed", acceptedMerchant: "0xmerchant" })).toBe("delivered");
  });

  it("freezes a failed order at whatever stage it last reached", () => {
    expect(stageFor({ ...base, phase: "failed", failureReason: "cancelled" })).toBe("funded");
    expect(
      stageFor({ ...base, phase: "failed", failureReason: "error", acceptedMerchant: "0xmerchant" })
    ).toBe("converted");
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
    expect(isTerminal({ ...base, phase: "awaiting_completion" })).toBe(false);
  });

  it("is true once completed or failed", () => {
    expect(isTerminal({ ...base, phase: "completed" })).toBe(true);
    expect(isTerminal({ ...base, phase: "failed", failureReason: "cancelled" })).toBe(true);
  });
});
