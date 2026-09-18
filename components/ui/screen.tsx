"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import clsx from "clsx";
import { typography } from "@/constants/typography";
import { Stepper } from "./stepper";

interface ScreenProps {
  children: ReactNode;
  /** Omit for screens with no header bar, such as the home page. */
  title?: string;
  /** Shown only alongside a title. Defaults to `router.back()`. */
  onBack?: () => void;
  backLabel?: string;
  step?: { current: number; total: number };
  /** Pinned to the bottom, above the content, as the primary call to action. */
  footer?: ReactNode;
  className?: string;
}

export function Screen({ children, title, onBack, backLabel, step, footer, className }: ScreenProps) {
  const router = useRouter();

  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      {title !== undefined && (
        <header className="px-6 pt-6">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack ?? (() => router.back())}
              aria-label={backLabel ?? "Back"}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border-light bg-white active:opacity-70"
            >
              <ArrowLeft size={18} />
            </button>
            <h1 style={typography.heading2}>{title}</h1>
          </div>
          {step && (
            <div className="mt-4 pl-13">
              <Stepper {...step} />
            </div>
          )}
        </header>
      )}

      <div className={clsx("relative flex flex-1 flex-col px-6 pb-8", title === undefined ? "pt-6" : "pt-8", className)}>
        {children}
      </div>

      {footer && (
        <div className="sticky bottom-0 bg-background/80 px-6 pb-8 pt-2 backdrop-blur">{footer}</div>
      )}
    </div>
  );
}
