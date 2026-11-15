"use client";

import { RefreshCw } from "lucide-react";
import clsx from "clsx";
import { PULL_THRESHOLD } from "@/hooks/use-pull-to-refresh";

interface PullIndicatorProps {
  /** Pull distance in px from `usePullToRefresh`. */
  pull: number;
  refreshing: boolean;
  label: string;
}

/** The circle that follows a pull-to-refresh: it turns with the finger, then spins while fetching. */
export function PullIndicator({ pull, refreshing, label }: PullIndicatorProps) {
  if (pull === 0 && !refreshing) return null;

  const progress = refreshing ? 1 : Math.min(1, pull / PULL_THRESHOLD);
  // While fetching the page has bounced back, so sit just under the top edge instead of over the content.
  const offset = refreshing ? 8 : pull / 2;

  return (
    <div
      role="status"
      aria-label={label}
      className="pointer-events-none fixed inset-x-0 top-[env(safe-area-inset-top,0px)] z-50 flex justify-center"
      style={{ transform: `translateY(${offset}px)` }}
    >
      <span
        className="flex h-9 w-9 items-center justify-center rounded-full border border-border-light bg-white text-primary shadow-sm transition-opacity"
        style={{ opacity: Math.max(0.3, progress) }}
      >
        <RefreshCw
          size={16}
          className={clsx(refreshing && "motion-safe:animate-spin")}
          style={refreshing ? undefined : { transform: `rotate(${progress * 270}deg)` }}
        />
      </span>
    </div>
  );
}
