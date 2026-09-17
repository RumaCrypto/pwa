import { describe, expect, it } from "vitest";
import { appendDecimal, appendDigit, backspace, toMoney } from "./amount-input";

describe("appendDigit", () => {
  it("builds a number left to right", () => {
    expect(appendDigit("", "2")).toBe("2");
    expect(appendDigit("2", "0")).toBe("20");
    expect(appendDigit("20", "0")).toBe("200");
  });

  it("does not keep a leading zero", () => {
    expect(appendDigit("0", "5")).toBe("5");
    expect(appendDigit("", "0")).toBe("0");
    expect(appendDigit("0", "0")).toBe("0");
  });

  it("stops at the currency's precision", () => {
    expect(appendDigit("1.23", "4", 2)).toBe("1.23");
    expect(appendDigit("1.2", "3", 2)).toBe("1.23");
  });

  it("refuses absurd amounts rather than overflowing the display", () => {
    expect(appendDigit("123456789", "0")).toBe("123456789");
  });
});

describe("appendDecimal", () => {
  it("starts the fraction, seeding a zero when empty", () => {
    expect(appendDecimal("20")).toBe("20.");
    expect(appendDecimal("")).toBe("0.");
  });

  it("ignores a second separator", () => {
    expect(appendDecimal("20.5")).toBe("20.5");
  });
});

describe("backspace", () => {
  it("removes the last character", () => {
    expect(backspace("200")).toBe("20");
    expect(backspace("20.")).toBe("20");
  });

  it("bottoms out at empty", () => {
    expect(backspace("2")).toBe("");
    expect(backspace("")).toBe("");
  });
});

describe("toMoney", () => {
  it("reads a partially typed amount", () => {
    expect(toMoney("200", "USD").amount).toBe(20000n);
    expect(toMoney("20.", "USD").amount).toBe(2000n);
    expect(toMoney("20.5", "USD").amount).toBe(2050n);
    expect(toMoney("", "USD").amount).toBe(0n);
  });
});
