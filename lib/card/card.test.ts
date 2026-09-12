import { describe, expect, it } from "vitest";
import { SETUP_STEPS, canSpend, isProvisioned, nextSetupStep, type CardSetup } from "./card";

const blank: CardSetup = { kyc: "not_started", endorsement: "not_requested" };

const card = {
  id: "ic_1",
  last4: "4417",
  brand: "visa" as const,
  type: "virtual" as const,
  status: "active" as const,
  expiryMonth: 9,
  expiryYear: 2030,
  holder: "LUCIA MORALES",
};

describe("nextSetupStep", () => {
  it("asks for identity first, since Bridge gates everything on it", () => {
    expect(nextSetupStep(blank)).toBe("kyc");
    expect(nextSetupStep({ ...blank, kyc: "pending" })).toBe("kyc");
    expect(nextSetupStep({ ...blank, kyc: "rejected" })).toBe("kyc");
  });

  it("asks for the cards endorsement once identity is approved", () => {
    expect(nextSetupStep({ ...blank, kyc: "approved" })).toBe("endorsement");
    expect(nextSetupStep({ ...blank, kyc: "approved", endorsement: "pending" })).toBe("endorsement");
  });

  it("asks for the onchain approval once endorsed", () => {
    expect(nextSetupStep({ kyc: "approved", endorsement: "approved" })).toBe("approval");
  });

  it("asks to create the card once the approval is on chain", () => {
    expect(
      nextSetupStep({ kyc: "approved", endorsement: "approved", approvalTxHash: "0xabc" })
    ).toBe("create");
  });

  it("has nothing left once a card exists", () => {
    expect(
      nextSetupStep({ kyc: "approved", endorsement: "approved", approvalTxHash: "0xabc", card })
    ).toBeNull();
  });

  it("never skips a step", () => {
    // An endorsement without KYC is not a state Bridge can reach.
    expect(nextSetupStep({ ...blank, endorsement: "approved" })).toBe("kyc");
    expect(nextSetupStep({ ...blank, approvalTxHash: "0xabc" })).toBe("kyc");
  });

  it("lists the steps in the order it returns them", () => {
    expect(SETUP_STEPS).toEqual(["kyc", "endorsement", "approval", "create"]);
  });
});

describe("isProvisioned", () => {
  it("is true only when a card object exists", () => {
    expect(isProvisioned(blank)).toBe(false);
    expect(isProvisioned({ ...blank, card })).toBe(true);
  });
});

describe("canSpend", () => {
  it("requires an active card", () => {
    expect(canSpend({ ...card, status: "active" })).toBe(true);
    expect(canSpend({ ...card, status: "frozen" })).toBe(false);
    expect(canSpend({ ...card, status: "canceled" })).toBe(false);
  });
});
