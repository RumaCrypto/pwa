import type { ReactNode } from "react";
import clsx from "clsx";

interface CardProps {
  children: ReactNode;
  /** Draws a hairline between direct children — list groups in the designs. */
  divided?: boolean;
  padded?: boolean;
  className?: string;
}

export function Card({ children, divided, padded, className }: CardProps) {
  return (
    <div
      className={clsx(
        "overflow-hidden rounded-2xl border border-border-light bg-white",
        padded && "px-4 py-4",
        divided && "[&>*+*]:border-t [&>*+*]:border-border-light",
        className
      )}
    >
      {children}
    </div>
  );
}
