"use client";

import type { ReactNode } from "react";
import { PrivyProvider } from "./privy-provider";
import { I18nProvider } from "@/lib/i18n/i18n-context";
import { MoneyProvider } from "@/lib/money/money-context";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider>
      <I18nProvider>
        {/* Inside I18n: money formatting follows the active language. */}
        <MoneyProvider>{children}</MoneyProvider>
      </I18nProvider>
    </PrivyProvider>
  );
}
