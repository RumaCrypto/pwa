import { describe, expect, it } from "vitest";
import { claimFailure, isNonceClash } from "./claim-errors";

/** The shape viem produces: the decoded revert sits on a nested cause. */
function revert(errorName: string) {
  return { message: "simulation failed", cause: { message: "reverted", cause: { data: { errorName } } } };
}

describe("claimFailure", () => {
  it("reports a name someone already has as taken", () => {
    expect(claimFailure(revert("LabelAlreadyRegistered"))).toBe("taken");
    expect(claimFailure(revert("LabelAlreadyReserved"))).toBe("taken");
    expect(claimFailure(revert("LabelUsed"))).toBe("taken");
  });

  it("reports an address that already has a name", () => {
    expect(claimFailure(revert("AlreadyHasName"))).toBe("hasName");
  });

  it("reports labels the contract refuses", () => {
    expect(claimFailure(revert("InvalidLabel"))).toBe("invalid");
  });

  it("treats setup problems and unknown errors as unavailable", () => {
    expect(claimFailure(revert("Unauthorized"))).toBe("unavailable");
    expect(claimFailure(revert("SomethingNew"))).toBe("unavailable");
    expect(claimFailure(new Error("fetch failed"))).toBe("unavailable");
    expect(claimFailure(null)).toBe("unavailable");
  });
});

describe("isNonceClash", () => {
  it("recognises the errors a duplicate nonce produces", () => {
    expect(isNonceClash(new Error("Nonce too low. Expected nonce to be 5"))).toBe(true);
    expect(isNonceClash(new Error("replacement transaction underpriced"))).toBe(true);
    expect(isNonceClash(new Error("insufficient funds for gas"))).toBe(false);
  });
});
