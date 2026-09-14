"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import clsx from "clsx";
import { typography } from "@/constants/typography";

interface AccordionItemProps {
  title: ReactNode;
  children: ReactNode;
  leading?: ReactNode;
  defaultOpen?: boolean;
}

export function AccordionItem({ title, children, leading, defaultOpen = false }: AccordionItemProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-card"
      >
        {leading}
        <span style={typography.heading4} className="min-w-0 flex-1">
          {title}
        </span>
        <ChevronDown
          size={18}
          className={clsx("shrink-0 text-text-secondary transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div style={typography.body3} className="px-4 pb-4 text-text-secondary">
          {children}
        </div>
      )}
    </div>
  );
}
