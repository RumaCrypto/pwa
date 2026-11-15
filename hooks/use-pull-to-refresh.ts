"use client";

import { useEffect, useRef, useState } from "react";

/** How far (px, after resistance) the finger must pull before letting go refreshes. */
export const PULL_THRESHOLD = 64;
const MAX_PULL = 96;
/** The finger travels twice as far as the indicator, so the pull feels weighted. */
const RESISTANCE = 0.5;
/** Keep the spinner up long enough to read, even when the network answers instantly. */
const MIN_REFRESH_MS = 500;

/**
 * iOS home-screen web apps have no native pull-to-refresh, so we draw our own there.
 * `navigator.standalone` exists only on iOS, which keeps Android and every browser tab
 * on their own native gesture instead of refreshing twice.
 */
function isIosStandalone() {
  return typeof navigator !== "undefined" && (navigator as { standalone?: boolean }).standalone === true;
}

/**
 * Listens for a pull-down at the top of the page and calls `onRefresh` when it passes
 * the threshold. Listeners are passive and never cancel scrolling: the iOS rubber band
 * still moves the page, and `pull` only drives the indicator drawn on top of it.
 */
export function usePullToRefresh(onRefresh: () => Promise<unknown>) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!isIosStandalone()) return;

    let startY: number | null = null;
    let current = 0;
    let busy = false;

    const update = (value: number) => {
      current = value;
      setPull(value);
    };

    const onStart = (event: TouchEvent) => {
      // Only a single finger starting at the very top; scrollY dips below 0 while bouncing.
      startY = !busy && event.touches.length === 1 && window.scrollY <= 0 ? event.touches[0].clientY : null;
    };

    const onMove = (event: TouchEvent) => {
      if (startY === null) return;
      const distance = event.touches[0].clientY - startY;
      update(distance > 0 ? Math.min(MAX_PULL, distance * RESISTANCE) : 0);
    };

    const onEnd = async () => {
      if (startY === null) return;
      startY = null;
      const triggered = current >= PULL_THRESHOLD;
      update(0);
      if (!triggered) return;

      busy = true;
      setRefreshing(true);
      try {
        await Promise.all([onRefreshRef.current(), new Promise((resolve) => setTimeout(resolve, MIN_REFRESH_MS))]);
      } finally {
        busy = false;
        setRefreshing(false);
      }
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  return { pull, refreshing };
}
