"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";

import { fetchPersistentHistory } from "./api";
import type { PersistentHistory } from "./persistent";

/** Each poll costs four calls to Aurora; a deposit takes minutes, so this is plenty. */
const POLL_MS = 15000;

export interface PersistentHistoryState {
  history: PersistentHistory | null;
  /** The last attempt failed; `history` still holds the last good answer, if any. */
  failed: boolean;
}

/**
 * Polls a permanent address's deposits for as long as the screen is open. A
 * permanent address never "finishes", so there is no stop condition; polling
 * pauses while the tab is hidden and catches up when it is shown again.
 */
export function usePersistentHistory(address: string | null): PersistentHistoryState {
  const { getAccessToken } = usePrivy();
  // Keyed by address so a previous address's history never shows under a new one.
  const [state, setState] = useState<PersistentHistoryState & { address: string | null }>({
    address: null,
    history: null,
    failed: false,
  });

  useEffect(() => {
    if (!address) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // The tab coming back can call tick while one is still waiting on Aurora; one loop only.
    let inFlight = false;

    async function tick() {
      if (inFlight) return;
      clearTimeout(timer);
      if (document.visibilityState === "visible") {
        inFlight = true;
        try {
          const history = await fetchPersistentHistory(address!, await getAccessToken());
          if (!stopped) setState({ address, history, failed: false });
        } catch (err) {
          if (!stopped) {
            console.error("Failed to fetch persistent deposit history", err);
            setState((prev) => ({ address, history: prev.address === address ? prev.history : null, failed: true }));
          }
        } finally {
          inFlight = false;
        }
      }
      if (!stopped) timer = setTimeout(tick, POLL_MS);
    }

    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };

    tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [address, getAccessToken]);

  return state.address === address ? { history: state.history, failed: state.failed } : { history: null, failed: false };
}
