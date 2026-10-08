import { describe, expect, it } from "vitest";
import { validateSubmission } from "./submit";

const HASH = `0x${"ab".repeat(32)}`;
const ADDRESS = "0x9f3a00000000000000000000000000000000c21e";

describe("validateSubmission", () => {
  it("keeps only the tx hash and the Base deposit address", () => {
    expect(validateSubmission({ txHash: HASH, depositAddress: ADDRESS, extra: 1 })).toEqual({ txHash: HASH, depositAddress: ADDRESS });
  });

  it("refuses anything else", () => {
    expect(validateSubmission({ txHash: "0x12", depositAddress: ADDRESS })).toBeNull();
    expect(validateSubmission({ txHash: HASH, depositAddress: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t" })).toBeNull();
    expect(validateSubmission(null)).toBeNull();
  });
});
