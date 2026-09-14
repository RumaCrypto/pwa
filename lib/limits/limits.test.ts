import { describe, expect, it } from "vitest";
import { LEVELS, MAX_LEVEL, levelFor, limitsFor, nextStepFor, SENDS_FOR_TOP_LEVEL } from "./limits";
import { fromNumber } from "@/lib/money/money";

const none = { socials: [], document: false, completedSends: 0 };

describe("levelFor", () => {
  it("starts at one, with nothing handed over", () => {
    expect(levelFor(none)).toBe(1);
  });

  it("reaches two with any single social account", () => {
    expect(levelFor({ ...none, socials: ["github"] })).toBe(2);
    expect(levelFor({ ...none, socials: ["github", "x"] })).toBe(2);
  });

  it("reaches three with a verified document, social or not", () => {
    expect(levelFor({ ...none, document: true })).toBe(3);
    expect(levelFor({ ...none, socials: ["x"], document: true })).toBe(3);
  });

  it("reaches four only with a document and a record of use", () => {
    expect(levelFor({ ...none, document: true, completedSends: SENDS_FOR_TOP_LEVEL })).toBe(4);
    // Use alone does not substitute for the document.
    expect(levelFor({ ...none, completedSends: 500 })).toBe(1);
    expect(levelFor({ ...none, document: true, completedSends: SENDS_FOR_TOP_LEVEL - 1 })).toBe(3);
  });

  it("never exceeds the top level", () => {
    expect(levelFor({ socials: ["x", "github"], document: true, completedSends: 9999 })).toBe(MAX_LEVEL);
  });
});

describe("limitsFor", () => {
  it("matches the figures on the home banner and the limits screen", () => {
    const level1 = limitsFor(1);
    expect(level1.perSend).toEqual(fromNumber(100, "USD"));
    expect(level1.perDay).toEqual(fromNumber(1000, "USD"));
    expect(level1.sendsPerDay).toBe(10);
  });

  it("raises every ceiling as the level climbs", () => {
    for (let level = 2; level <= MAX_LEVEL; level += 1) {
      const lower = limitsFor(level - 1);
      const higher = limitsFor(level);
      expect(higher.perSend.amount).toBeGreaterThan(lower.perSend.amount);
      expect(higher.perDay.amount).toBeGreaterThan(lower.perDay.amount);
      expect(higher.sendsPerDay).toBeGreaterThan(lower.sendsPerDay);
    }
  });

  it("defines one entry per level", () => {
    expect(LEVELS).toHaveLength(MAX_LEVEL);
  });
});

describe("nextStepFor", () => {
  it("points at a social account first", () => {
    expect(nextStepFor(none)).toBe("social");
  });

  it("points at the document once a social is connected", () => {
    expect(nextStepFor({ ...none, socials: ["x"] })).toBe("document");
  });

  it("points at usage once the document is verified", () => {
    expect(nextStepFor({ ...none, document: true })).toBe("usage");
  });

  it("has nothing left to suggest at the top", () => {
    expect(nextStepFor({ socials: ["x"], document: true, completedSends: 99 })).toBeNull();
  });
});
