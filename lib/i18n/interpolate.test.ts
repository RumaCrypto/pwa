import { describe, expect, it } from "vitest";
import { interpolate, pluralSuffix } from "./interpolate";

describe("interpolate", () => {
  it("substitutes a single variable", () => {
    expect(interpolate("Hola {name}", { name: "Rosa" })).toBe("Hola Rosa");
  });

  it("substitutes several variables, including repeats", () => {
    expect(interpolate("Paso {current} de {total} ({current}/{total})", { current: 1, total: 3 })).toBe(
      "Paso 1 de 3 (1/3)"
    );
  });

  it("returns the template untouched when there are no variables", () => {
    expect(interpolate("Sin variables", {})).toBe("Sin variables");
    expect(interpolate("Sin variables")).toBe("Sin variables");
  });

  it("leaves the marker visible when a variable is missing", () => {
    expect(interpolate("Recibes en {currency}", {})).toBe("Recibes en {currency}");
  });

  it("stringifies numbers", () => {
    expect(interpolate("{count}", { count: 0 })).toBe("0");
  });

  it("does not treat a substituted value as a further template", () => {
    expect(interpolate("{a}", { a: "{b}", b: "boom" })).toBe("{b}");
  });
});

describe("pluralSuffix", () => {
  it("picks one/other in English", () => {
    expect(pluralSuffix("en", 1)).toBe("one");
    expect(pluralSuffix("en", 2)).toBe("other");
    expect(pluralSuffix("en", 0)).toBe("other");
  });

  it("picks one/other in Spanish", () => {
    expect(pluralSuffix("es", 1)).toBe("one");
    expect(pluralSuffix("es", 2)).toBe("other");
  });

  it("treats zero as singular in Portuguese", () => {
    expect(pluralSuffix("pt", 0)).toBe("one");
    expect(pluralSuffix("pt", 1)).toBe("one");
    expect(pluralSuffix("pt", 2)).toBe("other");
  });
});
