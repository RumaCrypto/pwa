import { describe, expect, it } from "vitest";
import {
  formatLocalPayoutReference,
  localPayoutFields,
  localPayoutLabel,
  packLocalPayoutReference,
  payoutKindsFor,
  payoutReferenceDisplay,
  validateLocalPayoutFields,
  type Contact,
} from "./contacts";

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

describe("localPayoutFields", () => {
  it("is a single field for Colombia's Bre-B alias", () => {
    expect(localPayoutFields("CO").map((field) => field.key)).toEqual(["alias"]);
  });

  it("is the five fields p2p.me needs for Ecuador's bank transfer", () => {
    expect(localPayoutFields("EC").map((field) => field.key)).toEqual([
      "bank-name",
      "account-type",
      "account-number",
      "account-name",
      "cedula",
    ]);
  });

  it("is the three required fields for Venezuela's PagoMovil", () => {
    expect(localPayoutFields("VE").map((field) => field.key)).toEqual(["phone", "rif", "bank"]);
  });

  it("is two optional fields for Peru, since either Yape/Plin phone or CCI suffices", () => {
    const fields = localPayoutFields("PE");
    expect(fields.map((field) => field.key)).toEqual(["phone", "cci"]);
    expect(fields.every((field) => field.optional)).toBe(true);
  });
});

describe("validateLocalPayoutFields and packLocalPayoutReference", () => {
  it("packs and accepts a valid single-field value", () => {
    expect(validateLocalPayoutFields("CO", { alias: "3001234567" })).toBeNull();
    expect(packLocalPayoutReference("CO", { alias: "3001234567" })).toBe("3001234567");
  });

  it("rejects a blank required field with that field's message", () => {
    expect(validateLocalPayoutFields("CO", { alias: "" })).toMatch(/Colombian payment ID/);
  });

  it("accepts Ecuador's five fields once all are individually valid", () => {
    const values = {
      "bank-name": "Banco Pichincha",
      "account-type": "Savings",
      "account-number": "2100123456",
      "account-name": "Juan Perez",
      cedula: "1710034065",
    };
    expect(validateLocalPayoutFields("EC", values)).toBeNull();
    expect(packLocalPayoutReference("EC", values)).toBe(
      "Banco Pichincha|Savings|2100123456|Juan Perez|1710034065"
    );
  });

  it("flags the first invalid Ecuador field", () => {
    const error = validateLocalPayoutFields("EC", {
      "bank-name": "Banco Pichincha",
      "account-type": "Savings",
      "account-number": "2100123456",
      "account-name": "Juan Perez",
      cedula: "not-a-cedula",
    });
    expect(error).toMatch(/c.dula/i);
  });

  it("accepts Peru with only one of the two optional fields filled", () => {
    expect(validateLocalPayoutFields("PE", { phone: "987654321", cci: "" })).toBeNull();
  });

  it("rejects Peru when neither optional field is filled", () => {
    expect(validateLocalPayoutFields("PE", { phone: "", cci: "" })).not.toBeNull();
  });

  it("requires all three of Venezuela's fields", () => {
    expect(
      validateLocalPayoutFields("VE", { phone: "04121234567", rif: "V12345678", bank: "" })
    ).toMatch(/bank/i);
    expect(
      validateLocalPayoutFields("VE", { phone: "04121234567", rif: "V12345678", bank: "Banesco" })
    ).toBeNull();
  });
});

describe("formatLocalPayoutReference and payoutReferenceDisplay", () => {
  it("shows a single-field reference verbatim, without a label", () => {
    expect(formatLocalPayoutReference("CO", "3001234567")).toBe("3001234567");
  });

  it("labels each part of a multi-field reference", () => {
    const reference = "Banco Pichincha|Savings|2100123456|Juan Perez|1710034065";
    expect(formatLocalPayoutReference("EC", reference)).toBe(
      "Bank: Banco Pichincha | Account Type: Savings | Account Number: 2100123456 | Name: Juan Perez | Cédula: 1710034065"
    );
  });

  it("formats a contact's local-method reference, but leaves ruma/cash references untouched", () => {
    const local: Contact = {
      id: "1",
      name: "Juan Perez",
      country: "EC",
      payout: { kind: "local", reference: "Banco Pichincha|Savings|2100123456|Juan Perez|1710034065" },
    };
    expect(payoutReferenceDisplay(local)).toContain("Bank: Banco Pichincha");

    const ruma: Contact = { id: "2", name: "Rosa", country: "EC", payout: { kind: "ruma", reference: "rosa123" } };
    expect(payoutReferenceDisplay(ruma)).toBe("rosa123");
  });
});
