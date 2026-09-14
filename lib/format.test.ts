import { describe, expect, it } from "vitest";
import { initialsFrom, truncateAddress } from "./format";

describe("initialsFrom", () => {
  it("gives one letter for a single-word name", () => {
    expect(initialsFrom("Rosa")).toBe("R");
    expect(initialsFrom("Diego")).toBe("D");
  });

  it("keeps accented letters", () => {
    expect(initialsFrom("Mamá")).toBe("M");
    expect(initialsFrom("Ángela")).toBe("Á");
  });

  it("skips punctuation so an abbreviated name still reads right", () => {
    expect(initialsFrom("J. Carlos")).toBe("JC");
  });

  it("uses at most two letters", () => {
    expect(initialsFrom("Juan Carlos Vera")).toBe("JC");
  });

  it("falls back when there is nothing to take", () => {
    expect(initialsFrom("")).toBe("?");
    expect(initialsFrom("   ")).toBe("?");
    expect(initialsFrom("!!!")).toBe("?");
  });
});

describe("truncateAddress", () => {
  it("keeps the ends and elides the middle", () => {
    expect(truncateAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913")).toBe("0x8335…2913");
  });
});
