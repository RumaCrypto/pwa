export const CURRENCIES = {
  USD: { code: "USD", symbol: "$", decimals: 2, countries: ["US", "EC", "PA", "SV"] },
  BRL: { code: "BRL", symbol: "R$", decimals: 2, countries: ["BR"] },
  COP: { code: "COP", symbol: "$", decimals: 2, countries: ["CO"] },
  MXN: { code: "MXN", symbol: "$", decimals: 2, countries: ["MX"] },
  ARS: { code: "ARS", symbol: "$", decimals: 2, countries: ["AR"] },
  PEN: { code: "PEN", symbol: "S/", decimals: 2, countries: ["PE"] },
  VES: { code: "VES", symbol: "Bs.", decimals: 2, countries: ["VE"] },
  BOB: { code: "BOB", symbol: "Bs.", decimals: 2, countries: ["BO"] },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[];

export function isCurrencyCode(value: string): value is CurrencyCode {
  return value in CURRENCIES;
}

export function currencyForCountry(country: string): CurrencyCode | undefined {
  const upper = country.toUpperCase();
  return CURRENCY_CODES.find((code) =>
    (CURRENCIES[code].countries as readonly string[]).includes(upper)
  );
}
