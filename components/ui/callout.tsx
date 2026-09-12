import type { ReactNode } from "react";
import clsx from "clsx";
import { typography } from "@/constants/typography";

interface CalloutProps {
  children: ReactNode;
  title?: ReactNode;
  className?: string;
}

export function Callout({ children, title, className }: CalloutProps) {
  return (
    <div className={clsx("rounded-2xl bg-primary-light px-4 py-4 text-primary-dark", className)}>
      {title && (
        <p style={typography.heading4} className="mb-1">
          {title}
        </p>
      )}
      <div style={typography.body3}>{children}</div>
    </div>
  );
}
