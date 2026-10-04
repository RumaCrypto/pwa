"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";

import { fetchDepositStatus } from "./api";
import { isExpired, type IntentDeposit } from "./deposits";
import { isTerminal, phaseFor } from "./status";

const POLL_MS = 5000;

/**
 * Polls Aurora while the deposit screen is open, from the moment the address
 * is shown until the USDC lands on Base, the deposit is refunded, or the
 * address expires unused. Network errors are swallowed and retried: the screen
 * already says it is waiting. Returns whether the address has expired.
 */
export function useDepositStatus(
  deposit: IntentDeposit | null | undefined,
  onUpdate: (patch: Partial<IntentDeposit>) => void
): boolean {
  const { getAccessToken } = usePrivy();
  // Keyed by address so a stale "expired" never leaks onto another deposit.
  const [expiredAddress, setExpiredAddress] = useState<string | null>(null);
  const address = deposit?.depositAddress;
  const memo = deposit?.depositMemo;
  const phase = deposit?.phase;
  // A number, not the Date: every update revives a new Date object.
  const deadline = deposit?.deadline.getTime();
  const terminal = phase ? isTerminal(phase) : true;

  useEffect(() => {
    if (!address || !phase || deadline === undefined || terminal) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    async function tick() {
      // Nothing from Aurora marks the deadline passing, so it is re-checked
      // against the clock on every tick, before spending a status call.
      if (isExpired({ phase: phase!, deadline: new Date(deadline!) }, new Date())) {
        setExpiredAddress(address!);
        return;
      }
      try {
        const result = await fetchDepositStatus(address!, memo, await getAccessToken());
        if (stopped) return;
        const next = phaseFor(result.status);
        onUpdate({
          phase: next,
          receivedFormatted: result.receivedFormatted,
          destinationTxHash: result.destinationTxHash,
          ...(next === "completed" ? { completedAt: new Date() } : {}),
        });
        if (isTerminal(next)) return;
      } catch (err) {
        console.error("Failed to fetch Aurora deposit status", err);
      }
      if (!stopped) timer = setTimeout(tick, POLL_MS);
    }

    tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [address, memo, phase, deadline, terminal, onUpdate, getAccessToken]);

  return expiredAddress !== null && expiredAddress === address;
}
