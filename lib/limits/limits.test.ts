import { describe, expect, it } from "vitest";
import { LEVEL_THRESHOLDS, MAX_LEVEL, MAX_RP, levelForRp, rpFromBuyLimit } from "./limits";

describe("levelForRp", () => {
  it("is level 0 with no reputation", () => {
    expect(levelForRp(0)).toBe(0);
  });

  it("is level 1 with any reputation", () => {
    expect(levelForRp(1)).toBe(1);
    expect(levelForRp(LEVEL_THRESHOLDS[1] - 1)).toBe(1);
  });

  it("climbs one level at each threshold", () => {
    LEVEL_THRESHOLDS.forEach((threshold, index) => {
      expect(levelForRp(threshold)).toBe(index + 1);
    });
  });

  it("tops out at the max level", () => {
    expect(levelForRp(MAX_RP)).toBe(MAX_LEVEL);
    expect(levelForRp(MAX_RP * 10)).toBe(MAX_LEVEL);
  });
});

describe("rpFromBuyLimit", () => {
  it("divides the buy limit by the USDC granted per point", () => {
    expect(rpFromBuyLimit(600, 2)).toBe(300);
    expect(rpFromBuyLimit(0, 2)).toBe(0);
  });

  it("is zero for a missing or broken multiplier", () => {
    expect(rpFromBuyLimit(600, 0)).toBe(0);
    expect(rpFromBuyLimit(600, Number.NaN)).toBe(0);
  });
});
