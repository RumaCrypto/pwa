"use client";

import type { ReactNode } from "react";
import { PrivyProvider } from "./privy-provider";
import { I18nProvider } from "@/lib/i18n/i18n-context";
import { MoneyProvider } from "@/lib/money/money-context";
import { ContactsProvider } from "@/lib/contacts/contacts-context";
import { LimitsProvider } from "@/lib/limits/limits-context";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider>
      <I18nProvider>
        {/* Inside I18n: money formatting follows the active language. */}
        <MoneyProvider>
          <ContactsProvider>
            <LimitsProvider>{children}</LimitsProvider>
          </ContactsProvider>
        </MoneyProvider>
      </I18nProvider>
    </PrivyProvider>
  );
}
