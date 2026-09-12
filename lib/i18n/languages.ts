export const LANGUAGES = ["en", "es", "pt"] as const;

export type Language = (typeof LANGUAGES)[number];

/**
 * Regional locales chosen so number formatting matches the product designs:
 * es-419 and es-MX render a period decimal separator, which the mockups don't use.
 */
export const LOCALES: Record<Language, string> = {
  en: "en-US",
  es: "es-CO",
  pt: "pt-BR",
};

export function isLanguage(value: string): value is Language {
  return (LANGUAGES as readonly string[]).includes(value);
}
