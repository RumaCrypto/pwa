import { describe, expect, it } from "vitest";
import { formatDayAndTime, relativeDay } from "./datetime";

const NOW = new Date("2026-09-12T15:00:00");
const at = (iso: string) => new Date(iso);

describe("relativeDay", () => {
  it("names today and yesterday instead of printing a date", () => {
    expect(relativeDay(at("2026-09-12T09:30:00"), "es", NOW)).toBe("hoy");
    expect(relativeDay(at("2026-09-11T18:42:00"), "es", NOW)).toBe("ayer");
    expect(relativeDay(at("2026-09-12T09:30:00"), "en", NOW)).toBe("today");
    expect(relativeDay(at("2026-09-11T18:42:00"), "pt", NOW)).toBe("ontem");
  });

  it("compares calendar days, not elapsed hours", () => {
    // Two hours apart, but on either side of midnight.
    const now = new Date("2026-09-12T01:00:00");
    expect(relativeDay(at("2026-09-11T23:00:00"), "es", now)).toBe("ayer");
  });

  it("falls back to a short date beyond yesterday", () => {
    expect(relativeDay(at("2026-09-05T12:00:00"), "en", NOW)).toMatch(/Sep/);
    expect(relativeDay(at("2026-09-05T12:00:00"), "es", NOW)).toMatch(/sept|sep/i);
  });
});

describe("formatDayAndTime", () => {
  it("joins the day and the clock time the way the activity list shows it", () => {
    expect(formatDayAndTime(at("2026-09-11T18:42:00"), "es", NOW)).toBe("ayer, 18:42");
  });

  it("uses a 12-hour clock in English", () => {
    expect(formatDayAndTime(at("2026-09-11T18:42:00"), "en", NOW)).toBe("yesterday, 6:42 PM");
  });
});
