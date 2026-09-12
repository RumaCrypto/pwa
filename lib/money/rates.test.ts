import { describe, expect, it } from "vitest";
import { mockRateProvider } from "./rates";
import { convert, fromNumber } from "./money";

describe("mockRateProvider", () => {
  it("is the identity for a currency against itself", async () => {
    expect(await mockRateProvider.getRate("USD", "USD")).toBe(1);
    expect(await mockRateProvider.getRate("COP", "COP")).toBe(1);
  });

  it("uses the rate the send mockup shows", async () => {
    expect(await mockRateProvider.getRate("USD", "BRL")).toBe(5.4);
  });

  it("derives cross rates that are not routed through USD twice", async () => {
    const brlPerCop = await mockRateProvider.getRate("COP", "BRL");
    const usdPerCop = await mockRateProvider.getRate("COP", "USD");
    const brlPerUsd = await mockRateProvider.getRate("USD", "BRL");
    expect(brlPerCop).toBeCloseTo(usdPerCop * brlPerUsd, 10);
  });

  it("inverts", async () => {
    const forward = await mockRateProvider.getRate("USD", "BRL");
    const back = await mockRateProvider.getRate("BRL", "USD");
    expect(forward * back).toBeCloseTo(1, 10);
  });

  it("reproduces the mockup end to end: $200 becomes R$1.080,00", async () => {
    const rate = await mockRateProvider.getRate("USD", "BRL");
    expect(convert(fromNumber(200, "USD"), rate, "BRL").amount).toBe(108000n);
  });
});
