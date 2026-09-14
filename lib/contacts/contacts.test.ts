import { describe, expect, it } from "vitest";
import { localPayoutLabel, payoutKindsFor } from "./contacts";

const on = { cashPoints: true };
const off = { cashPoints: false };

describe("payoutKindsFor", () => {
  it("hides cash payout while no Ruma points exist", () => {
    expect(payoutKindsFor("BR", off)).toEqual(["local", "ruma"]);
    expect(payoutKindsFor("CO", off)).toEqual(["local", "ruma"]);
    expect(payoutKindsFor("US", off)).toEqual(["ruma"]);
  });

  it("offers cash once the flag is on", () => {
    expect(payoutKindsFor("US", on)).toEqual(["ruma", "cash"]);
    expect(payoutKindsFor("BR", on)).toEqual(["local", "ruma", "cash"]);
  });

  it("offers the local p2p.me payout method for every supported sending country", () => {
    for (const code of ["BR", "AR", "VE", "BO", "CO", "EC", "PE"]) {
      expect(payoutKindsFor(code, off)).toEqual(["local", "ruma"]);
    }
  });

  it("has no local method for countries outside the offramp corridor", () => {
    expect(payoutKindsFor("MX", on)).not.toContain("local");
  });
});

describe("localPayoutLabel", () => {
  it("returns the p2p.me local payout method for supported countries", () => {
    expect(localPayoutLabel("CO")).toBe("Bre-B");
    expect(localPayoutLabel("EC")).toBe("Banco");
    expect(localPayoutLabel("VE")).toBe("PagoMovil");
    expect(localPayoutLabel("AR")).toBe("MercadoPago");
  });

  it("returns undefined for countries without a p2p.me corridor", () => {
    expect(localPayoutLabel("US")).toBeUndefined();
  });
});
