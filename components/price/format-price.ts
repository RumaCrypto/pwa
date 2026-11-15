import { LOCALES, type Language } from "@/lib/i18n/languages";

/** "3,950.12 COP"; prices near one dollar keep a third decimal so 0.985 doesn't read as 0.99. */
export function formatPrice(value: number, currency: string, language: Language): string {
  const digits = value < 10 ? 3 : 2;
  const number = new Intl.NumberFormat(LOCALES[language], {
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  }).format(value);
  return `${number} ${currency}`;
}
