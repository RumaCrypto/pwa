import { describe, expect, it } from "vitest";
import { resolveLanguage } from "./languages";

describe("resolveLanguage", () => {
  it("matches on the primary subtag, ignoring region and case", () => {
    expect(resolveLanguage(["pt-PT"])).toBe("pt");
    expect(resolveLanguage(["es-AR"])).toBe("es");
    expect(resolveLanguage(["EN-gb"])).toBe("en");
  });

  it("skips unsupported languages and uses the next preference", () => {
    expect(resolveLanguage(["fr-FR", "pt-BR", "en"])).toBe("pt");
  });

  it("falls back to English when nothing is supported or the list is empty", () => {
    expect(resolveLanguage(["fr", "de"])).toBe("en");
    expect(resolveLanguage([])).toBe("en");
  });
});
