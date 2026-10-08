"use client";

import { useEffect, useState } from "react";
import type { Money } from "@/lib/money/money";
import { alchemyActivityProvider } from "./alchemy";

export type ActivityKind = "sent" | "received" | "paid";
export type ActivityStatus = "delivered" | "pending" | "failed";

export interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  /** Contact name, or merchant name for a QR payment. */
  counterparty: string;
  /** Signed: negative when money left the account. */
  amount: Money;
  status: ActivityStatus;
  occurredAt: Date;
}

export interface ActivityProvider {
  list(address: string): Promise<ActivityEntry[]>;
}

/**
 * Without an Alchemy key there is no history to read. Showing nothing is honest;
 * the mock that used to stand in made real users see transfers that never happened.
 */
export const emptyActivityProvider: ActivityProvider = {
  async list() {
    return [];
  },
};

/** Alchemy needs a key; without one the list stays empty (Aurora rows still show on home). */
export const defaultActivityProvider: ActivityProvider = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
  ? alchemyActivityProvider
  : emptyActivityProvider;

export function useActivity(
  address: string | undefined,
  provider: ActivityProvider = defaultActivityProvider
) {
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!address) return;
    let active = true;

    provider.list(address).then(
      (result) => active && setEntries(result),
      (failure: Error) => {
        if (!active) return;
        setError(failure);
        setEntries([]);
      }
    );

    return () => {
      active = false;
    };
  }, [address, provider]);

  return { entries, error, loading: entries === null };
}
