import { describe, expect, it } from "vitest";
import { buildQuote, isExpired, secondsLeft, FEE_RATE, LOCK_MS } from "./quote";
import { fromNumber } from "@/lib/money/money";

const AT = new Date("2026-09-12T12:00:00Z");

describe("buildQuote", () => {
  it("reproduces the review screen from the designs", () => {
    const quote = buildQuote(fromNumber(200, "USD"), 5.4, "BRL", AT);

    expect(quote.send).toEqual(fromNumber(200, "USD"));
    expect(quote.fee).toEqual(fromNumber(1.2, "USD"));
    expect(quote.total).toEqual(fromNumber(201.2, "USD"));
    expect(quote.receive).toEqual(fromNumber(1080, "BRL"));
  });

  it("charges the fee on top, so the recipient still gets the full amount", () => {
    const quote = buildQuote(fromNumber(200, "USD"), 5.4, "BRL", AT);
    expect(quote.receive.amount).toBe(fromNumber(200, "USD").amount * 54n / 10n);
  });

  it("rounds the fee to whole cents", () => {
    // 0.6% of 33.33 is 0.19998
    expect(buildQuote(fromNumber(33.33, "USD"), 1, "USD", AT).fee).toEqual(fromNumber(0.2, "USD"));
  });

  it("takes no fee on a zero amount", () => {
    const quote = buildQuote(fromNumber(0, "USD"), 5.4, "BRL", AT);
    expect(quote.fee.amount).toBe(0n);
    expect(quote.total.amount).toBe(0n);
  });

  it("locks the rate for fifteen minutes", () => {
    const quote = buildQuote(fromNumber(200, "USD"), 5.4, "BRL", AT);
    expect(quote.expiresAt.getTime()).toBe(AT.getTime() + LOCK_MS);
    expect(LOCK_MS).toBe(15 * 60_000);
  });

  it("uses the agreed fee rate", () => {
    expect(FEE_RATE).toBeCloseTo(0.006, 10);
  });
});

describe("expiry", () => {
  const quote = buildQuote(fromNumber(200, "USD"), 5.4, "BRL", AT);

  it("is live inside the window and dead after it", () => {
    expect(isExpired(quote, new Date(AT.getTime() + LOCK_MS - 1))).toBe(false);
    expect(isExpired(quote, new Date(AT.getTime() + LOCK_MS))).toBe(true);
  });

  it("counts down, never below zero", () => {
    expect(secondsLeft(quote, AT)).toBe(900);
    expect(secondsLeft(quote, new Date(AT.getTime() + 60_000))).toBe(840);
    expect(secondsLeft(quote, new Date(AT.getTime() + LOCK_MS + 99_000))).toBe(0);
  });
});
