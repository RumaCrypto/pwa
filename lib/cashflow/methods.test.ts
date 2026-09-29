import { describe, expect, it } from "vitest";
import {
  ADD_METHODS,
  OUT_METHODS,
  WITHDRAW_FEE,
  defaultMethod,
  enabledMethods,
  isAdvanced,
  isAvailable,
  withdrawTotal,
} from "./methods";
import { fromNumber } from "@/lib/money/money";
import type { Flags } from "@/lib/flags";

describe("method catalogues", () => {
  it("offers the three ways in the order the designs show them", () => {
    expect(ADD_METHODS).toEqual(["bank", "cash", "wallet"]);
    expect(OUT_METHODS).toEqual(["bank", "cash", "wallet"]);
  });

  it("marks only the wallet route as advanced", () => {
    expect(ADD_METHODS.filter(isAdvanced)).toEqual(["wallet"]);
  });

  it("preselects the bank, as the designs do", () => {
    expect(defaultMethod(ADD_METHODS, on)).toBe("bank");
    expect(defaultMethod(OUT_METHODS, off)).toBe("bank");
  });
});

// Typed so a new flag has to be accounted for here rather than defaulting
// silently; these suites only vary cashPoints.
const on: Flags = { cashPoints: true, card: false };
const off: Flags = { cashPoints: false, card: false };

describe("enabledMethods", () => {
  it("hides cash while no Ruma points exist", () => {
    expect(enabledMethods(ADD_METHODS, off)).toEqual(["bank", "wallet"]);
    expect(enabledMethods(OUT_METHODS, off)).toEqual(["bank", "wallet"]);
  });

  it("shows cash once the flag is on", () => {
    expect(enabledMethods(ADD_METHODS, on)).toEqual(["bank", "cash", "wallet"]);
  });

  it("never preselects a hidden route", () => {
    expect(enabledMethods(ADD_METHODS, off)).toContain(defaultMethod(ADD_METHODS, off));
  });

  it("leaves the catalogue itself untouched", () => {
    enabledMethods(ADD_METHODS, off);
    expect(ADD_METHODS).toEqual(["bank", "cash", "wallet"]);
  });
});

describe("isAvailable", () => {
  it("bank and wallet work; cash still needs a Ruma point", () => {
    expect(isAvailable("wallet")).toBe(true);
    expect(isAvailable("bank")).toBe(true);
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
