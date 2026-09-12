import { describe, expect, it } from "vitest";
import { formatMoney, formatMoneyParts } from "./format";
import { fromNumber } from "./money";

// Intl separates the symbol from the number with U+00A0, which keeps the two
// from being split across a line break.
const NBSP = " ";

describe("formatMoney", () => {
  it("uses a comma decimal in Spanish and Portuguese, a period in English", () => {
    const amount = fromNumber(1080.5, "BRL");
    expect(formatMoney(amount, "es")).toBe(`R$${NBSP}1.080,50`);
    expect(formatMoney(amount, "pt")).toBe(`R$${NBSP}1.080,50`);
    expect(formatMoney(amount, "en")).toBe("R$1,080.50");
  });

  it("matches the balance shown in the home mockup", () => {
    expect(formatMoney(fromNumber(328.35, "USD"), "es")).toBe(`$${NBSP}328,35`);
  });

  it("follows the reader's language, not the currency's country", () => {
    // An English speaker sending to Brazil reads Brazilian reais in English form.
    expect(formatMoney(fromNumber(1080, "BRL"), "en")).toBe("R$1,080.00");
  });

  it("can omit the currency symbol", () => {
    expect(formatMoney(fromNumber(1080, "BRL"), "es", { symbol: false })).toBe("1.080,00");
  });
});

describe("formatMoneyParts", () => {
  it("splits the amount so the whole and the cents can be styled apart", () => {
    expect(formatMoneyParts(fromNumber(328.35, "USD"), "es")).toEqual({
      symbol: "$",
      integer: "328",
      decimal: ",",
      fraction: "35",
    });
  });

  it("keeps group separators in the integer part", () => {
    expect(formatMoneyParts(fromNumber(1080.5, "BRL"), "pt")).toEqual({
      symbol: "R$",
      integer: "1.080",
      decimal: ",",
      fraction: "50",
    });
  });

  it("uses the English separators when the language is English", () => {
    expect(formatMoneyParts(fromNumber(1080.5, "USD"), "en")).toEqual({
      symbol: "$",
      integer: "1,080",
      decimal: ".",
      fraction: "50",
    });
  });
});
