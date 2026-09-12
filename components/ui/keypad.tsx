"use client";

import { Delete } from "lucide-react";
import clsx from "clsx";
import { typography } from "@/constants/typography";

interface KeypadProps {
  onDigit: (digit: string) => void;
  onDecimal: () => void;
  onBackspace: () => void;
  /** The locale's decimal separator, so the key matches what the figure shows. */
  decimalSeparator: string;
  backspaceLabel?: string;
}

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function Keypad({
  onDigit,
  onDecimal,
  onBackspace,
  decimalSeparator,
  backspaceLabel,
}: KeypadProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {DIGITS.map((digit) => (
        <Key key={digit} onClick={() => onDigit(digit)}>
          {digit}
        </Key>
      ))}
      <Key onClick={onDecimal}>{decimalSeparator}</Key>
      <Key onClick={() => onDigit("0")}>0</Key>
      <Key onClick={onBackspace} ariaLabel={backspaceLabel} tone="muted">
        <Delete size={20} />
      </Key>
    </div>
  );
}

function Key({
  children,
  onClick,
  ariaLabel,
  tone = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  ariaLabel?: string;
  tone?: "default" | "muted";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      style={typography.heading2}
      className={clsx(
        "flex h-14 items-center justify-center rounded-xl border border-border-light transition-colors active:bg-card",
        tone === "muted" ? "bg-primary-light text-primary-dark" : "bg-white"
      )}
    >
      {children}
    </button>
  );
}
