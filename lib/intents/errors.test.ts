import { describe, expect, it } from "vitest";
import { IntentsApiError } from "./api";
import { errorKey, withdrawErrorKey } from "./errors";
import { WithdrawError } from "./withdraw-errors";

const api = (status: number, message = "x") => new IntentsApiError(message, status);

describe("errorKey", () => {
  it("translates the statuses our own routes answer with", () => {
    expect(errorKey(api(401, "Sign in required"))).toBe("intents.errors.session");
    expect(errorKey(api(403, "Recipient must be your own wallet"))).toBe("intents.errors.wallet");
    expect(errorKey(api(429, "Too many requests, try again in a minute"))).toBe("intents.errors.rateLimit");
    expect(errorKey(api(503, "Deposits from other networks are not configured"))).toBe("intents.errors.unavailable");
    expect(errorKey(api(404, "Not found"))).toBe("intents.errors.unavailable");
  });

  it("treats our own validation failure as a generic error, since the user cannot fix it", () => {
    expect(errorKey(api(400, "Invalid quote request"))).toBe("intents.errors.generic");
  });

  it("shows Aurora's own 4xx message as-is, e.g. an amount below its minimum", () => {
    expect(errorKey(api(400, "Amount is too low for bridge, try at least 1.5"))).toBeNull();
    expect(errorKey(api(409, "Unsupported asset"))).toBeNull();
  });

  it("hides server failures and anything that is not an API answer behind a generic error", () => {
    expect(errorKey(api(500, "Internal error"))).toBe("intents.errors.generic");
    expect(errorKey(api(502, "fetch failed"))).toBe("intents.errors.generic");
    expect(errorKey(new TypeError("Failed to fetch"))).toBe("intents.errors.generic");
    expect(errorKey(new Error("Aurora returned no deposit address"))).toBe("intents.errors.generic");
    expect(errorKey(new RangeError("Invalid time value"))).toBe("intents.errors.generic");
    expect(errorKey("boom")).toBe("intents.errors.generic");
  });
});

describe("withdrawal errors", () => {
  it("maps each of our recipient refusals to its own copy", () => {
    for (const message of ["Recipient is your own wallet", "Recipient is a token contract", "Recipient account does not exist"]) {
      expect(errorKey(new IntentsApiError(message, 422))).toBe("withdrawFlow.errors.recipient");
    }
  });

  it("shows an Aurora-style 422 as-is", () => {
    expect(errorKey(new IntentsApiError("Unsupported asset", 422))).toBeNull();
  });

  it("maps each WithdrawError code, and leaves others to errorKey", () => {
    expect(withdrawErrorKey(new WithdrawError("mismatch"))).toBe("withdrawFlow.errors.mismatch");
    expect(withdrawErrorKey(new WithdrawError("expired"))).toBe("withdrawFlow.errors.expired");
    expect(withdrawErrorKey(new WithdrawError("balance"))).toBe("withdrawFlow.errors.balance");
    expect(withdrawErrorKey(new WithdrawError("rejected"))).toBe("withdrawFlow.errors.rejected");
    expect(withdrawErrorKey(new WithdrawError("reverted"))).toBe("withdrawFlow.errors.reverted");
    expect(withdrawErrorKey(new WithdrawError("gas"))).toBe("withdrawFlow.errors.gas");
    expect(withdrawErrorKey(new WithdrawError("unconfirmed"))).toBeNull();
    expect(withdrawErrorKey(new Error("x"))).toBeNull();
  });
});
