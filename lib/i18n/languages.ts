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

/** Each language in its own tongue, so it stays findable when the UI is in one the user can't read. */
export const NATIVE_NAMES: Record<Language, string> = {
  en: "English",
  es: "Español",
  pt: "Português",
};

/**
 * Picks the first supported language from a preference list (e.g. `navigator.languages`),
 * matching on the primary subtag so `pt-PT` and `es-AR` resolve to `pt` and `es`.
 */
export function resolveLanguage(preferences: readonly string[]): Language {
  for (const tag of preferences) {
    const primary = tag.split("-")[0].toLowerCase();
    if (isLanguage(primary)) return primary;
  }
  return "en";
}
