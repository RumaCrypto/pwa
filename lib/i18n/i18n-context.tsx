"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { translations, Language, TranslationKey } from "./translations";

const LANGUAGE_KEY = "ruma-language";

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

function detectBrowserLanguage(): Language {
  if (typeof navigator === "undefined") return "en";
  if (navigator.language?.startsWith("es")) return "es";
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("es");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect --
       localStorage isn't available during SSR, so the initial language can
       only be resolved after mount — not a candidate for lazy useState init. */
    const stored = localStorage.getItem(LANGUAGE_KEY);
    if (stored === "en" || stored === "es") {
      setLanguage(stored);
    } else {
      setLanguage(detectBrowserLanguage());
    }
    setLoaded(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(LANGUAGE_KEY, language);
  }, [language, loaded]);

  const t = (key: TranslationKey): string => {
    return translations[language][key] || translations.en[key] || key;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>{children}</I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}
