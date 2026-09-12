import { describe, expect, it } from "vitest";
import { STAGES, stageAt, stageIndex, stageStateAt, progressAt } from "./orders";

const START = new Date("2026-09-12T12:00:00Z");
const after = (seconds: number) => new Date(START.getTime() + seconds * 1000);

describe("stageAt", () => {
  it("walks the four stages the tracking screen shows", () => {
    expect(stageAt(START, START)).toBe("funded");
    expect(stageAt(START, after(6))).toBe("converted");
    expect(stageAt(START, after(15))).toBe("paying");
    expect(stageAt(START, after(60))).toBe("delivered");
  });

  it("never moves backwards", () => {
    let previous = -1;
    for (let second = 0; second <= 120; second += 1) {
      const index = stageIndex(stageAt(START, after(second)));
      expect(index).toBeGreaterThanOrEqual(previous);
      previous = index;
    }
  });

  it("stays delivered once it arrives", () => {
    expect(stageAt(START, after(10_000))).toBe("delivered");
  });
});

describe("stageStateAt", () => {
  it("marks earlier stages done, the current one current, the rest pending", () => {
    const at = after(15); // paying
    expect(STAGES.map((stage) => stageStateAt(stage, START, at))).toEqual([
      "done",
      "done",
      "current",
      "pending",
    ]);
  });

  it("marks every stage done once delivered", () => {
    const at = after(60);
    expect(STAGES.map((stage) => stageStateAt(stage, START, at))).toEqual([
      "done",
      "done",
      "done",
      "done",
    ]);
  });
});

describe("progressAt", () => {
  it("runs from a visible sliver to full", () => {
    expect(progressAt(START, START)).toBeGreaterThan(0);
    expect(progressAt(START, after(60))).toBe(1);
  });

  it("increases over time and stays within bounds", () => {
    const samples = [0, 5, 12, 20, 40, 60].map((s) => progressAt(START, after(s)));
    for (let i = 1; i < samples.length; i += 1) {
      expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1]);
    }
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...samples)).toBeLessThanOrEqual(1);
  });
});
