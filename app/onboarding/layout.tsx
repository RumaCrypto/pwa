"use client";

import type { ReactNode } from "react";
import { SupportFab } from "@/components/support/support-fab";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SupportFab />
      {children}
    </>
  );
}
