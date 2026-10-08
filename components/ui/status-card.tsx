import type { ReactNode } from "react";
import clsx from "clsx";
import { typography } from "@/constants/typography";
import { ProgressBar } from "./progress-bar";

interface StatusCardProps {
  /** Small line above the headline, such as "Your balance" or "On its way to Rosa". */
  label?: ReactNode;
  children: ReactNode;
  /** Line under the headline. */
  caption?: ReactNode;
  /** 0 to 1; shown between the headline and the caption. */
  progress?: number;
  /** Sits below a hairline rule at the bottom of the card. */
  footer?: ReactNode;
  /** Public path of an image drawn over the solid background colour. */
  backgroundImage?: string;
  className?: string;
}

export function StatusCard({ label, children, caption, progress, footer, backgroundImage, className }: StatusCardProps) {
  return (
    <div
      className={clsx("rounded-3xl bg-primary-dark bg-cover bg-center px-6 py-6 text-white", className)}
      style={backgroundImage ? { backgroundImage: `url(${backgroundImage})` } : undefined}
    >
      {label && (
        <p style={typography.extralight1} className="font-extralight text-text-lightblue">
          {label}
        </p>
      )}

      <div className="mt-1">{children}</div>

      {progress !== undefined && <ProgressBar value={progress} tone="onDark" className="mt-4" />}

      {caption && (
        <p style={typography.extralight1} className="mt-3 font-extralight text-text-lightblue">
          {caption}
        </p>
      )}

      {footer && (
        <p
          style={typography.label4}
          className="mt-5 border-t border-white/15 pt-4 text-text-lightblue"
        >
          {footer}
        </p>
      )}
    </div>
  );
}
