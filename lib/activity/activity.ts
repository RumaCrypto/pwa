"use client";

import { useEffect, useState } from "react";
import { fromNumber, type Money } from "@/lib/money/money";

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
 * Placeholder until an indexer is wired up. CoinGecko cannot serve this — it
 * publishes token prices, not per-wallet transaction history — so the real
 * implementation will read from an indexer such as the sibling `ruma/indexer`,
 * Basescan, or Alchemy. Only this object is replaced.
 */
export const mockActivityProvider: ActivityProvider = {
  async list() {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const now = Date.now();

    return [
      {
        id: "RM-719049",
        kind: "sent",
        counterparty: "Rosa",
        amount: fromNumber(-200, "USD"),
        status: "delivered",
        occurredAt: new Date(now - 20 * 3_600_000),
      },
      {
        id: "RM-718912",
        kind: "paid",
        counterparty: "Tienda Don Beto",
        amount: fromNumber(-20, "USD"),
        status: "delivered",
        occurredAt: new Date(now - 30 * 3_600_000),
      },
      {
        id: "RM-718340",
        kind: "received",
        counterparty: "Juan Carlos",
        amount: fromNumber(150, "USD"),
        status: "delivered",
        occurredAt: new Date(now - 76 * 3_600_000),
      },
    ];
  },
};

export function useActivity(address: string | undefined, provider: ActivityProvider = mockActivityProvider) {
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null);

  useEffect(() => {
    if (!address) return;
    let active = true;
    provider.list(address).then((result) => active && setEntries(result));
    return () => {
      active = false;
    };
  }, [address, provider]);

  return { entries, loading: entries === null };
}
