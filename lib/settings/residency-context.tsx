"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { currencyForCountry } from "@/lib/money/currencies";
import { useMoney } from "@/lib/money/money-context";

const RESIDENCY_KEY = "ruma-residency-country";

interface ResidencyContextType {
  /** ISO country code chosen during onboarding (or later in Settings), e.g. "EC". Null until set. */
  country: string | null;
  /** Sets the residency country and, since it implies a currency, updates the display currency to match. */
  setCountry: (country: string) => void;
  /** False until localStorage has been read, so onboarding doesn't redirect before it knows the answer. */
  loaded: boolean;
}

const ResidencyContext = createContext<ResidencyContextType | undefined>(undefined);

export function ResidencyProvider({ children }: { children: ReactNode }) {
  const { setDisplayCurrency } = useMoney();
  const [country, setCountryState] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect --
       localStorage only exists after mount. */
    setCountryState(localStorage.getItem(RESIDENCY_KEY));
    setLoaded(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const setCountry = useCallback(
    (next: string) => {
      localStorage.setItem(RESIDENCY_KEY, next);
      setCountryState(next);
      // Country of residence is the whole reason to pick a currency in the
      // first place — defaulting it here means Settings' currency picker
      // only has to be touched to override, not to get started.
      setDisplayCurrency(currencyForCountry(next) ?? "USD");
    },
    [setDisplayCurrency]
  );

  const value = useMemo(() => ({ country, setCountry, loaded }), [country, setCountry, loaded]);

  return <ResidencyContext.Provider value={value}>{children}</ResidencyContext.Provider>;
}

export function useResidency() {
  const context = useContext(ResidencyContext);
  if (!context) {
    throw new Error("useResidency must be used within ResidencyProvider");
  }
  return context;
}
