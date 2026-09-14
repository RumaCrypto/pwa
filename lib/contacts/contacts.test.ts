import { describe, expect, it } from "vitest";
import { payoutKindsFor } from "./contacts";

const on = { cashPoints: true };
const off = { cashPoints: false };

describe("payoutKindsFor", () => {
  it("hides cash payout while no Ruma points exist", () => {
    expect(payoutKindsFor("BR", off)).toEqual(["pix", "ruma"]);
    expect(payoutKindsFor("CO", off)).toEqual(["nequi", "ruma"]);
    expect(payoutKindsFor("US", off)).toEqual(["ruma"]);
  });

  it("offers cash once the flag is on", () => {
    expect(payoutKindsFor("US", on)).toEqual(["ruma", "cash"]);
    expect(payoutKindsFor("BR", on)).toEqual(["pix", "ruma", "cash"]);
  });

  it("keeps Pix to Brazil and Nequi to Colombia either way", () => {
    expect(payoutKindsFor("MX", on)).not.toContain("pix");
    expect(payoutKindsFor("MX", on)).not.toContain("nequi");
  });
});
