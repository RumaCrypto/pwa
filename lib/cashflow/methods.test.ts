import { describe, expect, it } from "vitest";
import {
  ADD_METHODS,
  OUT_METHODS,
  WITHDRAW_FEE,
  defaultMethod,
  isAdvanced,
  isAvailable,
  withdrawTotal,
} from "./methods";
import { fromNumber } from "@/lib/money/money";

describe("method catalogues", () => {
  it("offers the three ways in the order the designs show them", () => {
    expect(ADD_METHODS).toEqual(["bank", "cash", "wallet"]);
    expect(OUT_METHODS).toEqual(["bank", "cash", "wallet"]);
  });

  it("marks only the wallet route as advanced", () => {
    expect(ADD_METHODS.filter(isAdvanced)).toEqual(["wallet"]);
  });

  it("preselects the bank, as the designs do", () => {
    expect(defaultMethod(ADD_METHODS)).toBe("bank");
    expect(defaultMethod(OUT_METHODS)).toBe("bank");
  });
});

describe("isAvailable", () => {
  it("only the wallet route works without an external provider", () => {
    // Bank and cash both need p2p.me or a Ruma point behind them.
    expect(isAvailable("wallet")).toBe(true);
    expect(isAvailable("bank")).toBe(false);
    expect(isAvailable("cash")).toBe(false);
  });
});

describe("withdrawTotal", () => {
  it("adds the flat fee from the designs", () => {
    expect(WITHDRAW_FEE).toEqual(fromNumber(0.5, "USD"));
    expect(withdrawTotal(fromNumber(100, "USD"))).toEqual(fromNumber(100.5, "USD"));
  });

  it("charges nothing on nothing", () => {
    expect(withdrawTotal(fromNumber(0, "USD")).amount).toBe(50n);
  });
});
