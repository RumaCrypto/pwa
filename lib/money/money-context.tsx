"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n/i18n-context";
import { currencyForCountry, isCurrencyCode, type CurrencyCode } from "./currencies";
import { formatMoney, formatMoneyParts, type FormatOptions, type MoneyParts } from "./format";
import { convert, type Money } from "./money";
import { useRate } from "./rates";

const CURRENCY_KEY = "ruma-currency";

interface MoneyContextType {
  displayCurrency: CurrencyCode;
  setDisplayCurrency: (currency: CurrencyCode) => void;
  format: (money: Money, options?: FormatOptions) => string;
  formatParts: (money: Money) => MoneyParts;
}

const MoneyContext = createContext<MoneyContextType | undefined>(undefined);

function detectCurrency(): CurrencyCode {
  if (typeof navigator === "undefined") return "USD";
  const region = navigator.language?.split("-")[1];
  return (region && currencyForCountry(region)) || "USD";
}

export function MoneyProvider({ children }: { children: ReactNode }) {
  const { language } = useI18n();
  const [displayCurrency, setDisplayCurrency] = useState<CurrencyCode>("USD");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect --
       Same constraint as the language: localStorage only exists after mount. */
    const stored = localStorage.getItem(CURRENCY_KEY);
    setDisplayCurrency(stored && isCurrencyCode(stored) ? stored : detectCurrency());
    setLoaded(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(CURRENCY_KEY, displayCurrency);
  }, [displayCurrency, loaded]);

  const format = useCallback(
    (money: Money, options?: FormatOptions) => formatMoney(money, language, options),
    [language]
  );
  const formatParts = useCallback((money: Money) => formatMoneyParts(money, language), [language]);

  const value = useMemo(
    () => ({ displayCurrency, setDisplayCurrency, format, formatParts }),
    [displayCurrency, format, formatParts]
  );

  return <MoneyContext.Provider value={value}>{children}</MoneyContext.Provider>;
}

export function useMoney() {
  const context = useContext(MoneyContext);
  if (!context) {
    throw new Error("useMoney must be used within MoneyProvider");
  }
  return context;
}

/** Restates an amount in the user's display currency, fetching the rate as needed. */
export function useConverted(money: Money | null) {
  const { displayCurrency } = useMoney();
  const { rate, loading, error } = useRate(money?.currency ?? displayCurrency, displayCurrency);

  const converted = useMemo(
    () => (money && rate !== null ? convert(money, rate, displayCurrency) : null),
    [money, rate, displayCurrency]
  );

  return { money: converted, loading, error };
}
