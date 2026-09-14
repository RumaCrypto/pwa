"use client";

import { createContext, useCallback, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import { translations, type TranslationKey } from "./translations";
import { LOCALES, isLanguage, type Language } from "./languages";
import { interpolate, pluralSuffix, type InterpolationValues } from "./interpolate";

const LANGUAGE_KEY = "ruma-language";

type Translate = (key: TranslationKey, values?: InterpolationValues) => string;

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translate;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

function detectBrowserLanguage(): Language {
  if (typeof navigator === "undefined") return "en";
  const tag = navigator.language?.slice(0, 2).toLowerCase() ?? "";
  return isLanguage(tag) ? tag : "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("es");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect --
       localStorage isn't available during SSR, so the initial language can
       only be resolved after mount — not a candidate for lazy useState init. */
    const stored = localStorage.getItem(LANGUAGE_KEY);
    setLanguage(stored && isLanguage(stored) ? stored : detectBrowserLanguage());
    setLoaded(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(LANGUAGE_KEY, language);
  }, [language, loaded]);

  const t = useCallback<Translate>(
    (key, values) => {
      const dictionary: Record<string, string> = translations[language];
      const fallback: Record<string, string> = translations.en;

      let lookup: string = key;
      if (typeof values?.count === "number") {
        const suffixed = `${key}_${pluralSuffix(LOCALES[language], values.count)}`;
        lookup = suffixed in fallback ? suffixed : `${key}_other` in fallback ? `${key}_other` : key;
      }

      return interpolate(dictionary[lookup] ?? fallback[lookup] ?? key, values);
    },
    [language]
  );

  const value = useMemo(() => ({ language, setLanguage, t }), [language, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}
