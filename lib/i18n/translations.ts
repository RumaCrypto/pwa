import en from "./dictionaries/en.json";
import esJson from "./dictionaries/es.json";
import ptJson from "./dictionaries/pt.json";
import type { Language } from "./languages";

/**
 * English is the source of truth for the key set. Typing the other dictionaries
 * against it turns a missing translation into a build failure rather than a
 * string that silently falls back in production.
 */
type Dictionary = Record<keyof typeof en, string>;

const es: Dictionary = esJson;
const pt: Dictionary = ptJson;

export const translations: Record<Language, Dictionary> = { en, es, pt };

type PluralCategorySuffix = "zero" | "one" | "two" | "few" | "many" | "other";

/** Hides `foo_one` / `foo_other` from autocomplete; callers pass `foo` plus a count. */
type BaseKey<K extends string> = K extends `${infer Base}_${PluralCategorySuffix}` ? Base : K;

export type TranslationKey = BaseKey<keyof typeof en & string>;

export type { Language };
