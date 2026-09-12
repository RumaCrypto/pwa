"use client";

import type { ReactNode } from "react";
import { Check, ChevronRight } from "lucide-react";
import clsx from "clsx";
import { typography } from "@/constants/typography";

interface ListRowProps {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  chevron?: boolean;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  chevron,
  selected,
  onClick,
  className,
}: ListRowProps) {
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      onClick={onClick}
      className={clsx(
        "flex w-full items-center gap-3 px-4 py-3.5 text-left",
        onClick && "active:bg-card",
        className
      )}
    >
      {leading}
      <span className="min-w-0 flex-1">
        <span style={typography.body1} className="line-clamp-2 block">
          {title}
        </span>
        {subtitle && (
          // Wraps to a second line, as the designs do, before it ellipsizes.
          <span style={typography.body4} className="mt-0.5 line-clamp-2 block text-text-secondary">
            {subtitle}
          </span>
        )}
      </span>
      {trailing}
      {selected && <Check size={18} className="shrink-0 text-primary" />}
      {chevron && <ChevronRight size={18} className="shrink-0 text-text-secondary" />}
    </Tag>
  );
}
