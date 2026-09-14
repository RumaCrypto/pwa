"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { typography } from "@/constants/typography";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Sheet({ open, onClose, title, closeLabel, children, footer }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    // Stops the page behind from scrolling while the sheet is up.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button aria-label={closeLabel} onClick={onClose} className="absolute inset-0 bg-black/40" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[90dvh] w-full max-w-md flex-col rounded-t-3xl bg-background"
      >
        <div className="flex items-center justify-between gap-3 px-6 pb-2 pt-6">
          <h2 style={typography.heading2}>{title}</h2>
          <button
            onClick={onClose}
            aria-label={closeLabel}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border-light bg-white active:opacity-70"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>

        {footer && <div className="px-6 pb-8 pt-2">{footer}</div>}
      </div>
    </div>
  );
}
