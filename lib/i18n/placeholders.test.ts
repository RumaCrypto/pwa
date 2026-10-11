import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import en from "./dictionaries/en.json";

const ROOT = join(__dirname, "..", "..");
const SOURCE_DIRS = ["app", "components", "lib", "hooks"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("translation placeholders", () => {
  // Two flows once shared a key; a merge kept the copy with {amount} and the
  // wallet screen, which passed no params, showed "Withdraw {amount}" verbatim.
  it("never calls a key whose copy has {placeholders} without passing params", () => {
    const withPlaceholders = new Set(
      Object.entries(en as Record<string, string>)
        .filter(([, copy]) => /\{\w+\}/.test(copy))
        .map(([key]) => key)
    );
    const offenders = SOURCE_DIRS.flatMap((dir) => sourceFiles(join(ROOT, dir))).flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(/\bt\("([\w.]+)"\)/g)]
        .filter((match) => withPlaceholders.has(match[1]))
        .map((match) => `${file.slice(ROOT.length + 1)}: ${match[1]}`)
    );
    expect(offenders).toEqual([]);
  });
});
