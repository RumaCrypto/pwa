"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Card, CardSetup, CardStatus, SpendingControls } from "./card";
import type { CardProvider } from "./card-provider";
import { mockCardProvider } from "./mock-card-provider";

interface CardContextType {
  setup: CardSetup | null;
  controls: SpendingControls | null;
  busy: boolean;
  startKyc: () => Promise<void>;
  requestEndorsement: () => Promise<void>;
  approveSpending: () => Promise<void>;
  createCard: (type: Card["type"]) => Promise<void>;
  setStatus: (status: CardStatus) => Promise<void>;
  updateControls: (controls: Partial<SpendingControls>) => Promise<void>;
  revealDetails: () => Promise<{ pan: string; cvv: string; expiry: string }>;
}

const CardContext = createContext<CardContextType | undefined>(undefined);

export function CardProviderContext({
  children,
  provider = mockCardProvider,
}: {
  children: ReactNode;
  provider?: CardProvider;
}) {
  const [setup, setSetup] = useState<CardSetup | null>(null);
  const [controls, setControls] = useState<SpendingControls | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([provider.getSetup(), provider.getSpendingControls()]).then(([nextSetup, nextControls]) => {
      if (!active) return;
      setSetup(nextSetup);
      setControls(nextControls);
    });
    return () => {
      active = false;
    };
  }, [provider]);

  const run = useCallback(async (action: () => Promise<CardSetup>) => {
    setBusy(true);
    try {
      setSetup(await action());
    } finally {
      setBusy(false);
    }
  }, []);

  const startKyc = useCallback(() => run(() => provider.startKyc()), [run, provider]);
  const requestEndorsement = useCallback(() => run(() => provider.requestEndorsement()), [run, provider]);

  const approveSpending = useCallback(async () => {
    // The real flow sends this with the wallet before recording it; the call is
    // built by the provider so the UI never encodes Bridge's contract itself.
    const approval = await provider.buildApproval();
    await run(() => provider.recordApproval(`0x${approval.to.slice(2, 10)}${Date.now().toString(16)}`));
  }, [run, provider]);

  const createCard = useCallback((type: Card["type"]) => run(() => provider.createCard(type)), [run, provider]);
  const setStatus = useCallback((status: CardStatus) => run(() => provider.setStatus(status)), [run, provider]);

  const updateControls = useCallback(
    async (next: Partial<SpendingControls>) => {
      setControls(await provider.setSpendingControls(next));
    },
    [provider]
  );

  const revealDetails = useCallback(() => provider.revealDetails(), [provider]);

  const value = useMemo(
    () => ({
      setup,
      controls,
      busy,
      startKyc,
      requestEndorsement,
      approveSpending,
      createCard,
      setStatus,
      updateControls,
      revealDetails,
    }),
    [setup, controls, busy, startKyc, requestEndorsement, approveSpending, createCard, setStatus, updateControls, revealDetails]
  );

  return <CardContext.Provider value={value}>{children}</CardContext.Provider>;
}

export function useCard() {
  const context = useContext(CardContext);
  if (!context) {
    throw new Error("useCard must be used within CardProviderContext");
  }
  return context;
}
