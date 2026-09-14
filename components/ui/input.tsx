"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";
import { typography } from "@/constants/typography";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Rendered inside the field, before the text — a search icon, for instance. */
  leading?: ReactNode;
}

export function Input({ leading, className, style, ...props }: InputProps) {
  return (
    <div
      className={clsx(
        "flex h-14 items-center gap-2.5 rounded-xl border border-border-light bg-white px-4",
        "focus-within:border-primary",
        className
      )}
    >
      {leading}
      <input
        style={{ ...typography.body1, ...style }}
        className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-text-secondary"
        {...props}
      />
    </div>
  );
}
