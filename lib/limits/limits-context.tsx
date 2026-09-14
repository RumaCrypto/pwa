"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { levelFor, limitsFor, nextStepFor, type Limits, type SocialNetwork, type Verifications } from "./limits";

const VERIFICATIONS_KEY = "ruma-verifications";

const EMPTY: Verifications = { socials: [], document: false, completedSends: 0 };

interface LimitsContextType {
  verifications: Verifications;
  level: number;
  limits: Limits;
  nextStep: ReturnType<typeof nextStepFor>;
  connectSocial: (network: SocialNetwork) => void;
  verifyDocument: () => void;
  /** Called when a send completes; usage is what earns the top level. */
  recordCompletedSend: () => void;
}

const LimitsContext = createContext<LimitsContextType | undefined>(undefined);

function read(): Verifications {
  try {
    const raw = localStorage.getItem(VERIFICATIONS_KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Verifications) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

export function LimitsProvider({ children }: { children: ReactNode }) {
  const [verifications, setVerifications] = useState<Verifications>(EMPTY);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect --
       localStorage is unavailable until after mount. */
    setVerifications(read());
    setLoaded(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(VERIFICATIONS_KEY, JSON.stringify(verifications));
  }, [verifications, loaded]);

  const connectSocial = useCallback((network: SocialNetwork) => {
    setVerifications((current) =>
      current.socials.includes(network)
        ? current
        : { ...current, socials: [...current.socials, network] }
    );
  }, []);

  const verifyDocument = useCallback(() => {
    setVerifications((current) => ({ ...current, document: true }));
  }, []);

  const recordCompletedSend = useCallback(() => {
    setVerifications((current) => ({ ...current, completedSends: current.completedSends + 1 }));
  }, []);

  const value = useMemo(() => {
    const level = levelFor(verifications);
    return {
      verifications,
      level,
      limits: limitsFor(level),
      nextStep: nextStepFor(verifications),
      connectSocial,
      verifyDocument,
      recordCompletedSend,
    };
  }, [verifications, connectSocial, verifyDocument, recordCompletedSend]);

  return <LimitsContext.Provider value={value}>{children}</LimitsContext.Provider>;
}

export function useLimits() {
  const context = useContext(LimitsContext);
  if (!context) {
    throw new Error("useLimits must be used within LimitsProvider");
  }
  return context;
}
