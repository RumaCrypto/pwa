"use client";

import { useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";

import { fetchDepositStatus } from "./api";
import type { IntentDeposit } from "./deposits";
import { isTerminal, phaseFor } from "./status";

const POLL_MS = 5000;

/**
 * Polls Aurora while the deposit screen is open, from the moment the address
 * is shown until the USDC lands on Base or the deposit is refunded. Network
 * errors are swallowed and retried: the screen already says it is waiting.
 */
export function useDepositStatus(
  deposit: IntentDeposit | null | undefined,
  onUpdate: (patch: Partial<IntentDeposit>) => void
): void {
  const { getAccessToken } = usePrivy();
  const address = deposit?.depositAddress;
  const memo = deposit?.depositMemo;
  const terminal = deposit ? isTerminal(deposit.phase) : true;

  useEffect(() => {
    if (!address || terminal) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    async function tick() {
      try {
        const result = await fetchDepositStatus(address!, memo, await getAccessToken());
        if (stopped) return;
        const phase = phaseFor(result.status);
        onUpdate({
          phase,
          receivedFormatted: result.receivedFormatted,
          destinationTxHash: result.destinationTxHash,
          ...(phase === "completed" ? { completedAt: new Date() } : {}),
        });
        if (isTerminal(phase)) return;
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
  }, [address, memo, terminal, onUpdate, getAccessToken]);
}
