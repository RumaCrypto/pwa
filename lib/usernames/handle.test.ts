import { describe, expect, it } from "vitest";
import { formatHandle, fullEnsName, handleProblem, parseHandle, suggestHandle } from "./handle";

describe("parseHandle", () => {
  it("accepts the bare label, an @ prefix, or the full ENS name", () => {
    expect(parseHandle("daniel")).toBe("daniel");
    expect(parseHandle("@daniel")).toBe("daniel");
    expect(parseHandle("daniel.rumalatam.eth")).toBe("daniel");
  });

  it("ignores case and surrounding spaces", () => {
    expect(parseHandle("  Daniel.RumaLatam.ETH ")).toBe("daniel");
  });

  it("leaves other ENS names alone, so validation rejects them", () => {
    expect(parseHandle("vitalik.eth")).toBe("vitalik.eth");
    expect(handleProblem(parseHandle("vitalik.eth"))).toBe("invalidCharacters");
  });
});

describe("handleProblem", () => {
  it("accepts 3-20 lowercase letters and digits", () => {
    expect(handleProblem("dan")).toBeNull();
    expect(handleProblem("daniel2026")).toBeNull();
    expect(handleProblem("a".repeat(20))).toBeNull();
  });

  it("rejects names outside the length limits", () => {
    expect(handleProblem("da")).toBe("tooShort");
    expect(handleProblem("a".repeat(21))).toBe("tooLong");
  });

  it("rejects anything but a-z and 0-9, including lookalike letters", () => {
    expect(handleProblem("dan-iel")).toBe("invalidCharacters");
    expect(handleProblem("dan_iel")).toBe("invalidCharacters");
    expect(handleProblem("josé")).toBe("invalidCharacters");
    expect(handleProblem("dаniel")).toBe("invalidCharacters"); // Cyrillic "а"
  });

  it("rejects names that could pose as Ruma", () => {
    expect(handleProblem("soporte")).toBe("reserved");
    expect(handleProblem("ruma")).toBe("reserved");
  });
});

describe("fullEnsName and formatHandle", () => {
  it("adds the parent for resolution and an @ for display", () => {
    expect(fullEnsName("daniel")).toBe("daniel.rumalatam.eth");
    expect(formatHandle("daniel")).toBe("@daniel");
  });
});

describe("suggestHandle", () => {
  it("uses the email's local part without symbols or a + tag", () => {
    expect(suggestHandle("Daniel.Ruiz+ruma@mail.com")).toBe("danielruiz");
  });

  it("gives nothing when too little is left or the name is reserved", () => {
    expect(suggestHandle("d.@mail.com")).toBeNull();
    expect(suggestHandle("soporte@mail.com")).toBeNull();
    expect(suggestHandle(undefined)).toBeNull();
  });

  it("cuts long names to the limit", () => {
    expect(suggestHandle(`${"a".repeat(30)}@mail.com`)).toBe("a".repeat(20));
  });
});
