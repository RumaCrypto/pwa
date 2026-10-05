"use client";

import { useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";

import { fetchDepositStatus } from "./api";
import { isWithdrawalSettled, withdrawalPhaseFor, type IntentWithdrawal } from "./withdrawals";

const POLL_MS = 5000;
/** Past the deadline Aurora refunds anything late on its own; an hour later there is nothing left to learn. */
const STOP_AFTER_DEADLINE_MS = 60 * 60 * 1000;

/**
 * Polls Aurora while the track screen is open. Unlike deposits it also polls a
 * withdrawal still "awaiting_transfer": the app may have closed right after
 * broadcasting, and Aurora seeing the deposit is how that gets resolved.
 */
export function useWithdrawalStatus(
  withdrawal: IntentWithdrawal | null | undefined,
  onUpdate: (patch: Partial<IntentWithdrawal>) => void
): void {
  const { getAccessToken } = usePrivy();
  const address = withdrawal?.depositAddress;
  const phase = withdrawal?.phase;
  // A number, not the Date: every update revives a new Date object.
  const deadline = withdrawal?.deadline.getTime();
  const settled = phase ? isWithdrawalSettled(phase) : true;

  useEffect(() => {
    if (!address || !phase || deadline === undefined || settled) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    async function tick() {
      try {
        const result = await fetchDepositStatus(address!, undefined, await getAccessToken());
        if (stopped) return;
        const next = withdrawalPhaseFor(phase!, result.status);
        onUpdate({
          phase: next,
          receivedFormatted: result.receivedFormatted,
          destinationTxHash: result.destinationTxHash,
          ...(next === "completed" ? { completedAt: new Date() } : {}),
        });
        if (isWithdrawalSettled(next)) return;
      } catch (err) {
        console.error("Failed to fetch Aurora withdrawal status", err);
      }
      if (stopped || Date.now() > deadline! + STOP_AFTER_DEADLINE_MS) return;
      timer = setTimeout(tick, POLL_MS);
    }

    tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [address, phase, deadline, settled, onUpdate, getAccessToken]);
}
