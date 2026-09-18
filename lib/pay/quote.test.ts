import { describe, expect, it } from "vitest";
import { buildPayQuote, PAY_FEE_RATE } from "./quote";
import { fromNumber } from "@/lib/money/money";

describe("buildPayQuote", () => {
  it("converts the local amount to pay into USDC at the given rate", () => {
    // 1 USDC = 5.4 BRL, so paying R$108 costs 20 USDC.
    const quote = buildPayQuote(fromNumber(108, "BRL"), 5.4, "BR");

    expect(quote.local).toEqual(fromNumber(108, "BRL"));
    expect(quote.usdc).toEqual(fromNumber(20, "USD"));
    expect(quote.fee).toEqual(fromNumber(0.2, "USD"));
    expect(quote.total).toEqual(fromNumber(20.2, "USD"));
    expect(quote.country).toBe("BR");
  });

  it("takes no fee on a zero amount", () => {
    const quote = buildPayQuote(fromNumber(0, "BRL"), 5.4, "BR");
    expect(quote.fee.amount).toBe(0n);
    expect(quote.total.amount).toBe(0n);
  });

  it("uses the agreed fee rate", () => {
    expect(PAY_FEE_RATE).toBeCloseTo(0.01, 10);
  });
});
