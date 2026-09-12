import type { ReactNode } from "react";
import clsx from "clsx";
import { typography } from "@/constants/typography";

type Variant = "light" | "dark" | "outline";

interface BadgeProps {
  children: ReactNode;
  variant?: Variant;
  className?: string;
}

export function Badge({ children, variant = "light", className }: BadgeProps) {
  return (
    <span
      style={typography.label4}
      className={clsx(
        "inline-flex shrink-0 items-center justify-center rounded-full px-3 py-1.5",
        variant === "light" && "bg-primary-light text-primary-dark",
        variant === "dark" && "bg-black text-white",
        variant === "outline" && "border border-border-light bg-white text-text-secondary",
        className
      )}
    >
      {children}
    </span>
  );
}
