"use client";

import { ButtonHTMLAttributes } from "react";
import clsx from "clsx";
import { typography } from "@/constants/typography";

type Variant = "primary" | "secondary" | "black";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = "primary", className, style, ...props }: ButtonProps) {
  return (
    <button
      style={{ ...typography.button1, ...style }}
      className={clsx(
        "flex h-14 w-full items-center justify-center gap-2.5 rounded-xl transition-opacity disabled:opacity-50",
        variant === "primary" && "bg-primary text-white active:opacity-80",
        variant === "secondary" && "bg-card text-text active:opacity-80",
        variant === "black" && "bg-black text-white active:opacity-80",
        className
      )}
      {...props}
    />
  );
}
