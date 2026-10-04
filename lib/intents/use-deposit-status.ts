"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";

import { fetchDepositStatus } from "./api";
import { nextPollAction, type IntentDeposit } from "./deposits";
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
      // The stored phase can be stale (the deposit may have settled while the
      // app was closed), so status is always fetched once before deciding the
      // address expired. Only a failed fetch falls back to the stored phase.
      let current = phase!;
      try {
        const result = await fetchDepositStatus(address!, memo, await getAccessToken());
        if (stopped) return;
        current = phaseFor(result.status);
        onUpdate({
          phase: current,
          receivedFormatted: result.receivedFormatted,
          destinationTxHash: result.destinationTxHash,
          ...(current === "completed" ? { completedAt: new Date() } : {}),
        });
      } catch (err) {
        console.error("Failed to fetch Aurora deposit status", err);
      }
      if (stopped) return;
      // Nothing from Aurora marks the deadline passing, so it is checked
      // against the clock after every attempt.
      const action = nextPollAction(current, new Date(deadline!), new Date());
      if (action === "expired") setExpiredAddress(address!);
      if (action === "continue") timer = setTimeout(tick, POLL_MS);
    }

    tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [address, memo, phase, deadline, terminal, onUpdate, getAccessToken]);

  return expiredAddress !== null && expiredAddress === address;
}
