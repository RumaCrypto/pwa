import en from "./dictionaries/en.json";
import es from "./dictionaries/es.json";

export const translations = {
  en,
  es,
} as const;

export type Language = keyof typeof translations;
export type TranslationKey = keyof typeof translations.en;
