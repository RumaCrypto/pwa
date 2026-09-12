"use client";

import type { ReactNode } from "react";
import clsx from "clsx";
import { typography } from "@/constants/typography";

interface RadioCardProps {
  title: ReactNode;
  description?: ReactNode;
  /** Small tag above the title, such as "Advanced". */
  tag?: ReactNode;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

export function RadioCard({ title, description, tag, selected, disabled, onSelect }: RadioCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={clsx(
        "flex w-full items-start gap-3 rounded-2xl border px-4 py-4 text-left transition-colors",
        selected ? "border-primary bg-primary-light" : "border-border-light bg-white",
        disabled && "opacity-50"
      )}
    >
      <span className="min-w-0 flex-1">
        {tag && (
          <span
            style={typography.label5}
            className="mb-1.5 inline-block rounded-full border border-border-light bg-white px-2 py-0.5 text-text-secondary"
          >
            {tag}
          </span>
        )}
        <span style={typography.heading4} className="block">
          {title}
        </span>
        {description && (
          <span style={typography.body4} className="mt-1 block text-text-secondary">
            {description}
          </span>
        )}
      </span>

      <span
        aria-hidden
        className={clsx(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
          selected ? "border-primary" : "border-border-light"
        )}
      >
        {selected && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
      </span>
    </button>
  );
}
