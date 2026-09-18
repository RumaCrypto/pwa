"use client";

import type { ReactNode } from "react";
import { PrivyProvider } from "./privy-provider";
import { I18nProvider } from "@/lib/i18n/i18n-context";
import { MoneyProvider } from "@/lib/money/money-context";
import { ResidencyProvider } from "@/lib/settings/residency-context";
import { ContactsProvider } from "@/lib/contacts/contacts-context";
import { LimitsProvider } from "@/lib/limits/limits-context";
import { CardProviderContext } from "@/lib/card/card-context";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider>
      <I18nProvider>
        {/* Inside I18n: money formatting follows the active language. */}
        <MoneyProvider>
          {/* Inside Money: picking a residency country sets the display currency. */}
          <ResidencyProvider>
            <ContactsProvider>
              <LimitsProvider>
                <CardProviderContext>{children}</CardProviderContext>
              </LimitsProvider>
            </ContactsProvider>
          </ResidencyProvider>
        </MoneyProvider>
      </I18nProvider>
    </PrivyProvider>
  );
}
