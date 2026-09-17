"use client";

import { typography } from "@/constants/typography";

interface QrFrameProps {
  /**
   * Fires when a merchant QR has been captured. Decoding is not wired up yet:
   * the frame is a placeholder, and tapping it stands in for a successful scan
   * so the rest of the flow can be exercised. Swapping in a real decoder means
   * replacing the body of this component and calling `onScanned` with its result.
   */
  onScanned: () => void;
  label: string;
  hint?: string;
}

export function QrFrame({ onScanned, label, hint }: QrFrameProps) {
  return (
    <button
      onClick={onScanned}
      aria-label={label}
      className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-3xl bg-primary-dark active:opacity-90"
    >
      <Corner className="left-6 top-6 border-l-2 border-t-2 rounded-tl-xl" />
      <Corner className="right-6 top-6 border-r-2 border-t-2 rounded-tr-xl" />
      <Corner className="bottom-6 left-6 border-b-2 border-l-2 rounded-bl-xl" />
      <Corner className="bottom-6 right-6 border-b-2 border-r-2 rounded-br-xl" />

      <span style={typography.body3} className="text-white/40">
        {hint ?? label}
      </span>
    </button>
  );
}

function Corner({ className }: { className: string }) {
  return <span className={`absolute h-12 w-12 border-primary ${className}`} />;
}
