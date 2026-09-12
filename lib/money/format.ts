import { LOCALES, type Language } from "@/lib/i18n/languages";
import { CURRENCIES } from "./currencies";
import { toNumber, type Money } from "./money";

export type FormatOptions = { symbol?: boolean };

export type MoneyParts = {
  symbol: string;
  integer: string;
  decimal: string;
  fraction: string;
};

function formatter(money: Money, language: Language, { symbol = true }: FormatOptions = {}) {
  const { decimals } = CURRENCIES[money.currency];
  return new Intl.NumberFormat(LOCALES[language], {
    ...(symbol
      ? { style: "currency" as const, currency: money.currency, currencyDisplay: "narrowSymbol" as const }
      : { style: "decimal" as const }),
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** An ISO code, shown when the locale has no symbol for the currency (PEN, COP). */
const IS_ISO_CODE = /^[A-Z]{3}$/;

/**
 * es-CO renders "$ 1.080,50" with a non-breaking space after the symbol, but the
 * designs set the symbol tight against the digits — and `formatMoneyParts`
 * already drops it, so leaving it here made the same amount render two ways.
 *
 * The space stays when the locale falls back to an ISO code, since "PEN672,32"
 * does not read as an amount.
 */
export function formatMoney(money: Money, language: Language, options?: FormatOptions): string {
  const parts = formatter(money, language, options).formatToParts(toNumber(money));
  const currency = parts.find((part) => part.type === "currency")?.value ?? "";
  if (IS_ISO_CODE.test(currency)) {
    return parts.map((part) => part.value).join("");
  }

  return parts
    .filter((part, index) => {
      if (part.type !== "literal") return true;
      const neighbours = [parts[index - 1]?.type, parts[index + 1]?.type];
      return !neighbours.includes("currency");
    })
    .map((part) => part.value)
    .join("");
}

/**
 * The balance card renders the whole amount large and the cents small, so the
 * pieces have to stay separate — slicing the formatted string breaks as soon as
 * the locale moves the symbol or changes the separators.
 */
export function formatMoneyParts(money: Money, language: Language): MoneyParts {
  const parts = formatter(money, language).formatToParts(toNumber(money));
  const find = (type: Intl.NumberFormatPartTypes) =>
    parts.filter((part) => part.type === type).map((part) => part.value).join("");

  return {
    symbol: find("currency"),
    integer: parts
      .filter((part) => part.type === "integer" || part.type === "group")
      .map((part) => part.value)
      .join(""),
    decimal: find("decimal"),
    fraction: find("fraction"),
  };
}
