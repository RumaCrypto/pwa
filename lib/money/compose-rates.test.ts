import { describe, expect, it, vi } from "vitest";
import { routeByCoverage } from "./compose-rates";
import type { CurrencyCode } from "./currencies";
import type { RateProvider } from "./rates";

const stub = (value: number): RateProvider => ({ getRate: vi.fn(async () => value) });

// Stands in for CoinGecko, which quotes neither COP nor PEN.
const covers = (currency: CurrencyCode) => currency !== "COP" && currency !== "PEN";

describe("routeByCoverage", () => {
  it("uses the preferred provider when it covers both currencies", async () => {
    const preferred = stub(5.4);
    const fallback = stub(999);

    expect(await routeByCoverage(preferred, fallback, covers).getRate("USD", "BRL")).toBe(5.4);
    expect(fallback.getRate).not.toHaveBeenCalled();
  });

  it("falls back when the target currency is not covered", async () => {
    const preferred = stub(5.4);
    const fallback = stub(3105.8);

    expect(await routeByCoverage(preferred, fallback, covers).getRate("USD", "COP")).toBe(3105.8);
    expect(preferred.getRate).not.toHaveBeenCalled();
  });

  it("falls back when the source currency is not covered", async () => {
    const preferred = stub(5.4);
    const fallback = stub(0.00032);

    expect(await routeByCoverage(preferred, fallback, covers).getRate("COP", "USD")).toBe(0.00032);
    expect(preferred.getRate).not.toHaveBeenCalled();
  });

  it("routes a pair that neither side covers to the fallback", async () => {
    const preferred = stub(1);
    const fallback = stub(0.00108);

    expect(await routeByCoverage(preferred, fallback, covers).getRate("COP", "PEN")).toBe(0.00108);
    expect(preferred.getRate).not.toHaveBeenCalled();
  });

  it("short-circuits an identical pair without asking anyone", async () => {
    const preferred = stub(5.4);
    const fallback = stub(999);

    expect(await routeByCoverage(preferred, fallback, covers).getRate("COP", "COP")).toBe(1);
    expect(preferred.getRate).not.toHaveBeenCalled();
    expect(fallback.getRate).not.toHaveBeenCalled();
  });
});
