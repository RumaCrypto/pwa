"use client";

import { createContext, useContext, type ReactNode } from "react";
import { usePrivy } from "@privy-io/react-auth";

import { useResidency } from "@/lib/settings/residency-context";
import { useTxLimits, type TxLimits } from "@/hooks/use-tx-limits";

interface LimitsContextType {
  /** On-chain limits in the user's own corridor; null while loading or on error. */
  limits: TxLimits | null;
  loading: boolean;
  /** Re-reads the limits, e.g. after a verification credits reputation. */
  refetch: () => Promise<void>;
}

const LimitsContext = createContext<LimitsContextType | undefined>(undefined);

/** Shares one read of the user's limits so home and /limits never disagree. */
export function LimitsProvider({ children }: { children: ReactNode }) {
  const { user } = usePrivy();
  const { country } = useResidency();
  const value = useTxLimits(user?.wallet?.address, country);

  return <LimitsContext.Provider value={value}>{children}</LimitsContext.Provider>;
}

export function useLimits() {
  const context = useContext(LimitsContext);
  if (!context) {
    throw new Error("useLimits must be used within LimitsProvider");
  }
  return context;
}
