"use client";

import type { ReactNode } from "react";
import { PrivyProvider } from "./privy-provider";
import { I18nProvider } from "@/lib/i18n/i18n-context";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider>
      <I18nProvider>{children}</I18nProvider>
    </PrivyProvider>
  );
}
