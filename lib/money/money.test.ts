import { describe, expect, it } from "vitest";
import { add, convert, fromDecimalString, fromMinor, fromNumber, sub, toNumber } from "./money";

describe("constructors", () => {
  it("builds from minor units", () => {
    expect(fromMinor(32835n, "USD")).toEqual({ amount: 32835n, currency: "USD" });
  });

  it("builds from a decimal number", () => {
    expect(fromNumber(328.35, "USD").amount).toBe(32835n);
    expect(fromNumber(0, "USD").amount).toBe(0n);
    expect(fromNumber(-1.5, "USD").amount).toBe(-150n);
  });

  it("builds from viem's formatUnits output", () => {
    expect(fromDecimalString("328.354900", "USD").amount).toBe(32835n);
    expect(fromDecimalString("0.1", "USD").amount).toBe(10n);
    expect(fromDecimalString("1000", "USD").amount).toBe(100000n);
  });

  it("rounds half away from zero when the string is more precise than the currency", () => {
    expect(fromDecimalString("0.005", "USD").amount).toBe(1n);
    expect(fromDecimalString("0.004", "USD").amount).toBe(0n);
  });

  it("does not lose precision on balances too large for a float", () => {
    expect(fromDecimalString("90071992547409.91", "USD").amount).toBe(9007199254740991n);
  });
});

describe("arithmetic", () => {
  it("adds without floating point drift", () => {
    // 200.00 + 1.20 is 201.20000000000002 in IEEE 754 doubles.
    const total = add(fromNumber(200, "USD"), fromNumber(1.2, "USD"));
    expect(total.amount).toBe(20120n);
    expect(toNumber(total)).toBe(201.2);
  });

  it("subtracts", () => {
    expect(sub(fromNumber(328.35, "USD"), fromNumber(201.2, "USD")).amount).toBe(12715n);
  });

  it("refuses to mix currencies", () => {
    expect(() => add(fromNumber(1, "USD"), fromNumber(1, "BRL"))).toThrow(/USD.*BRL/);
    expect(() => sub(fromNumber(1, "USD"), fromNumber(1, "BRL"))).toThrow(/USD.*BRL/);
  });
});

describe("convert", () => {
  it("matches the send mockup: $200 at 5.40 is R$1080", () => {
    const received = convert(fromNumber(200, "USD"), 5.4, "BRL");
    expect(received).toEqual({ amount: 108000n, currency: "BRL" });
  });

  it("handles a large rate without drift", () => {
    expect(convert(fromNumber(100, "USD"), 3998.5, "COP").amount).toBe(39985000n);
  });

  it("rounds to the target currency's precision", () => {
    expect(convert(fromMinor(1n, "USD"), 5.4, "BRL").amount).toBe(5n);
    expect(convert(fromMinor(1n, "USD"), 0.333, "BRL").amount).toBe(0n);
  });

  it("round-trips approximately", () => {
    const usd = fromNumber(200, "USD");
    const brl = convert(usd, 5.4, "BRL");
    expect(convert(brl, 1 / 5.4, "USD").amount).toBe(usd.amount);
  });

  it("is a no-op for the same currency at rate 1", () => {
    expect(convert(fromNumber(50, "USD"), 1, "USD").amount).toBe(5000n);
  });
});
