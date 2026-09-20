import { describe, expect, it } from "vitest";
import { isSupportedCountry, isoCurrencyForMarket, marketForCountry, P2P_MARKETS } from "./markets";
import { CATALOGUE_COUNTRIES, COUNTRIES } from "@/lib/contacts/contacts";

describe("marketForCountry", () => {
  it("maps the countries this app already offers", () => {
    expect(marketForCountry("BR")).toBe("BRL");
    expect(marketForCountry("CO")).toBe("COP");
    expect(marketForCountry("PE")).toBe("PEN");
    expect(marketForCountry("AR")).toBe("ARS");
  });

  it("uses the non-ISO spellings the SDK expects", () => {
    expect(marketForCountry("MX")).toBe("MEX");
    expect(marketForCountry("VE")).toBe("VEN");
  });

  it("routes Ecuador to its own market even though it settles in dollars", () => {
    expect(marketForCountry("EC")).toBe("ECU");
    expect(marketForCountry("US")).toBe("USD");
  });

  it("is case insensitive", () => {
    expect(marketForCountry("br")).toBe("BRL");
  });

  it("returns null rather than guessing for a country with no market", () => {
    expect(marketForCountry("PA")).toBeNull();
    expect(marketForCountry("ZZ")).toBeNull();
  });
});

describe("isoCurrencyForMarket", () => {
  it("translates the market codes that are not ISO currencies", () => {
    expect(isoCurrencyForMarket("MEX")).toBe("MXN");
    expect(isoCurrencyForMarket("ECU")).toBe("USD");
  });

  it("passes through the ones that already are", () => {
    expect(isoCurrencyForMarket("BRL")).toBe("BRL");
    expect(isoCurrencyForMarket("COP")).toBe("COP");
    expect(isoCurrencyForMarket("PEN")).toBe("PEN");
  });

  it("never returns a code Intl would reject", () => {
    for (const market of P2P_MARKETS) {
      expect(isoCurrencyForMarket(market)).toMatch(/^[A-Z]{3}$/);
      // Throws on an unknown currency, which is the failure being guarded against.
      expect(() =>
        new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: isoCurrencyForMarket(market),
        }).format(1)
      ).not.toThrow();
    }
  });
});

describe("coverage of this app's countries", () => {
  // Panama and El Salvador use the dollar but p2p.me has no market for them.
  // This pins which catalogue entries are unreachable, and fails if either the
  // catalogue or the market list changes without the other.
  const UNREACHABLE = ["PA", "SV"];

  it("knows exactly which catalogue countries cannot be paid", () => {
    const missing = CATALOGUE_COUNTRIES.filter((country) => !isSupportedCountry(country));
    expect(missing.sort()).toEqual([...UNREACHABLE].sort());
  });

  it("keeps the unreachable ones out of the contact picker", () => {
    for (const country of UNREACHABLE) {
      expect(COUNTRIES).not.toContain(country);
    }
  });

  it("maps every country the picker does offer", () => {
    expect(COUNTRIES.length).toBeGreaterThan(0);
    for (const country of COUNTRIES) {
      expect(marketForCountry(country)).not.toBeNull();
    }
  });
});
