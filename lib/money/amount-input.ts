import { CURRENCIES, type CurrencyCode } from "./currencies";
import { fromDecimalString, type Money } from "./money";

/**
 * A keypad amount as the user typed it — digits and at most one ".", never a
 * locale separator. The display layer swaps in the locale's separator; keeping
 * the raw string canonical means parsing never depends on the active language.
 */
const MAX_INTEGER_DIGITS = 9;

function split(draft: string): [string, string | null] {
  const index = draft.indexOf(".");
  return index === -1 ? [draft, null] : [draft.slice(0, index), draft.slice(index + 1)];
}

export function appendDigit(draft: string, digit: string, decimals = 2): string {
  const [whole, fraction] = split(draft);

  if (fraction !== null) {
    return fraction.length >= decimals ? draft : `${whole}.${fraction}${digit}`;
  }

  if (whole.length >= MAX_INTEGER_DIGITS) return draft;
  if (whole === "0") return digit === "0" ? draft : digit;
  return whole + digit;
}

export function appendDecimal(draft: string): string {
  if (draft.includes(".")) return draft;
  return draft === "" ? "0." : `${draft}.`;
}

export function backspace(draft: string): string {
  return draft.slice(0, -1);
}

export function toMoney(draft: string, currency: CurrencyCode): Money {
  return fromDecimalString(draft === "" ? "0" : draft, currency);
}

/** Renders the draft with the locale's separators, for the big on-screen figure. */
export function formatDraft(draft: string, locale: string, currency: CurrencyCode): string {
  const [whole, fraction] = split(draft);
  const grouped = new Intl.NumberFormat(locale, { useGrouping: true }).format(Number(whole || 0));
  if (fraction === null) return grouped;

  const separator =
    new Intl.NumberFormat(locale).formatToParts(1.1).find((part) => part.type === "decimal")?.value ?? ".";

  return `${grouped}${separator}${fraction.slice(0, CURRENCIES[currency].decimals)}`;
}
