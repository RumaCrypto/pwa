import { LOCALES, type Language } from "./i18n/languages";

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

const DAY_MS = 86_400_000;

/** "today" / "yesterday" when applicable, otherwise a short date. */
export function relativeDay(date: Date, language: Language, now = new Date()): string {
  const locale = LOCALES[language];
  const days = Math.round((startOfDay(date) - startOfDay(now)) / DAY_MS);

  if (days === 0 || days === -1) {
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(days, "day");
  }

  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(date);
}

/**
 * es-CO defaults to a 12-hour clock ("6:42 p. m."), but the designs show 18:42,
 * so the clock is pinned per language rather than left to the locale.
 */
const HOUR12: Record<Language, boolean> = { en: true, es: false, pt: false };

export function formatTime(date: Date, language: Language): string {
  return new Intl.DateTimeFormat(LOCALES[language], {
    hour: "numeric",
    minute: "2-digit",
    hour12: HOUR12[language],
  }).format(date);
}

export function formatDayAndTime(date: Date, language: Language, now = new Date()): string {
  return `${relativeDay(date, language, now)}, ${formatTime(date, language)}`;
}
