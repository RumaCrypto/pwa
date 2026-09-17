import type { ReactNode } from "react";
import clsx from "clsx";
import { typography } from "@/constants/typography";

interface DetailRowProps {
  label: ReactNode;
  value: ReactNode;
  /** Totals and headline figures in the review screens. */
  emphasis?: boolean;
  className?: string;
}

export function DetailRow({ label, value, emphasis, className }: DetailRowProps) {
  return (
    <div className={clsx("flex items-baseline justify-between gap-4 py-2.5", className)}>
      <span style={typography.body2} className="text-text-tertiary">
        {label}
      </span>
      <span
        style={emphasis ? typography.heading4 : { ...typography.body2, fontWeight: 600 }}
        className="text-right"
      >
        {value}
      </span>
    </div>
  );
}
