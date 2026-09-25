import { describe, expect, it } from "vitest";
import { buildDepositQuote, localCurrencyForCountry } from "./quote";
import { fromNumber } from "@/lib/money/money";

describe("buildDepositQuote", () => {
  it("converts the local amount to USDC at the locked buy rate", () => {
    const quote = buildDepositQuote(fromNumber(1080, "BRL"), 5.4, "BR");

    expect(quote.local).toEqual(fromNumber(1080, "BRL"));
    expect(quote.usdc).toEqual(fromNumber(200, "USD"));
    expect(quote.rate).toBe(5.4);
    expect(quote.country).toBe("BR");
  });

  it("receives nothing on a zero amount", () => {
    const quote = buildDepositQuote(fromNumber(0, "BRL"), 5.4, "BR");
    expect(quote.usdc.amount).toBe(0n);
  });
});

describe("localCurrencyForCountry", () => {
  it("resolves the country's own currency", () => {
    expect(localCurrencyForCountry("BR")).toBe("BRL");
  });

  it("falls back to USD for an unmapped country", () => {
    expect(localCurrencyForCountry("ZZ")).toBe("USD");
  });
});
